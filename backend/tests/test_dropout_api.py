"""API tests for dropout-risk predictions."""

import json
from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token
from app.ml.dropout.types import DropoutRiskResult
from app.models.academic import Department, Program, University
from app.models.people import Cohort, Student, UserRole
from tests.test_guardrails_rbac import _create_catalog, _create_scoped_user


@pytest.fixture
async def ml_dropout_schema(db_session: AsyncSession) -> None:
    """Attach sqlite ml schema tables used by dropout endpoints."""
    await db_session.execute(text("ATTACH DATABASE ':memory:' AS ml"))
    await db_session.execute(
        text(
            """
            CREATE TABLE ml.model_run (
                id INTEGER PRIMARY KEY,
                model_name TEXT NOT NULL,
                model_version TEXT NOT NULL,
                status TEXT NOT NULL,
                feature_set TEXT NOT NULL,
                metrics TEXT,
                artifact_uri TEXT,
                trained_at TEXT NOT NULL,
                UNIQUE(model_name, model_version)
            )
            """
        )
    )
    await db_session.execute(
        text(
            """
            CREATE TABLE ml.student_dropout_prediction (
                id INTEGER PRIMARY KEY,
                model_run_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                dropout_probability REAL NOT NULL,
                risk_level TEXT NOT NULL,
                top_factors TEXT,
                scored_at TEXT NOT NULL,
                UNIQUE(model_run_id, student_id)
            )
            """
        )
    )
    await db_session.flush()


async def _seed_dropout_prediction(db_session: AsyncSession, student_id: int) -> None:
    await db_session.execute(
        text(
            """
            INSERT INTO ml.model_run
                (id, model_name, model_version, status, feature_set, metrics, artifact_uri, trained_at)
            VALUES
                (1, 'dropout_classifier', 'vtest', 'completed', '[]', '{}', '/tmp/x.joblib', :trained_at)
            """
        ),
        {"trained_at": datetime.now(UTC).isoformat()},
    )
    await db_session.execute(
        text(
            """
            INSERT INTO ml.student_dropout_prediction
                (id, model_run_id, student_id, dropout_probability, risk_level, top_factors, scored_at)
            VALUES
                (1, 1, :student_id, 0.42, 'medium', :factors, :scored_at)
            """
        ),
        {
            "student_id": student_id,
            "factors": json.dumps([{"feature": "fail_rate", "impact": 0.2}]),
            "scored_at": datetime.now(UTC).isoformat(),
        },
    )
    await db_session.flush()


async def test_dropout_risk_returns_prediction(
    client: AsyncClient,
    db_session: AsyncSession,
    ml_dropout_schema: None,
) -> None:
    university = University(code="EPU", name="Electric Power University")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="CNTT", name="CNTT")
    db_session.add(department)
    await db_session.flush()
    program = Program(department_id=department.id, code="IT", name="IT")
    cohort = Cohort(code="K21", year_start=2021)
    db_session.add_all([program, cohort])
    await db_session.flush()
    student = Student(
        program_id=program.id,
        cohort_id=cohort.id,
        student_code="DROP-001",
        full_name="Dropout Test",
    )
    db_session.add(student)
    await db_session.flush()
    await _seed_dropout_prediction(db_session, student.id)

    response = await client.get(f"/api/v1/predictions/students/{student.id}/dropout-risk")

    assert response.status_code == 200
    body = response.json()
    assert body["student_id"] == student.id
    assert body["dropout_probability"] == pytest.approx(0.42)
    assert body["risk_level"] == "medium"
    assert body["model_name"] == "dropout_classifier"


async def test_dropout_risk_not_found(
    client: AsyncClient,
    db_session: AsyncSession,
    ml_dropout_schema: None,
) -> None:
    university = University(code="EPU2", name="EPU2")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="CNTT2", name="CNTT2")
    db_session.add(department)
    await db_session.flush()
    program = Program(department_id=department.id, code="IT2", name="IT2")
    cohort = Cohort(code="K22", year_start=2022)
    db_session.add_all([program, cohort])
    await db_session.flush()
    student = Student(
        program_id=program.id,
        cohort_id=cohort.id,
        student_code="DROP-404",
        full_name="No Prediction",
    )
    db_session.add(student)
    await db_session.flush()

    response = await client.get(f"/api/v1/predictions/students/{student.id}/dropout-risk")

    assert response.status_code == 404


async def test_scoped_user_cannot_read_dropout_risk_outside_department(
    client: AsyncClient,
    db_session: AsyncSession,
    ml_dropout_schema: None,
) -> None:
    allowed_department, _, denied_program, _ = await _create_catalog(db_session)
    cohort = Cohort(code="K99", year_start=2026)
    db_session.add(cohort)
    await db_session.flush()
    student = Student(
        program_id=denied_program.id,
        cohort_id=cohort.id,
        student_code="DROP-IDOR",
        full_name="IDOR Dropout",
    )
    db_session.add(student)
    await db_session.flush()
    await _seed_dropout_prediction(db_session, student.id)

    manager = await _create_scoped_user(db_session, role=UserRole.manager, department_id=allowed_department.id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.get(f"/api/v1/predictions/students/{student.id}/dropout-risk")

    assert response.status_code == 403


async def test_admin_train_rejects_unknown_model(client: AsyncClient) -> None:
    response = await client.post("/api/v1/admin/ml/train?model=pass_fail")

    assert response.status_code == 400


@patch("app.api.v1.endpoints.analytics.predict_dropout_risk_for_student")
async def test_dropout_risk_predict_returns_live_result(
    mock_predict: object,
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    university = University(code="EPU3", name="EPU3")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="CNTT3", name="CNTT3")
    db_session.add(department)
    await db_session.flush()
    program = Program(department_id=department.id, code="IT3", name="IT3")
    cohort = Cohort(code="K23", year_start=2023)
    db_session.add_all([program, cohort])
    await db_session.flush()
    student = Student(
        program_id=program.id,
        cohort_id=cohort.id,
        student_code="DROP-LIVE",
        full_name="Live Predict",
    )
    db_session.add(student)
    await db_session.flush()

    scored_at = datetime.now(UTC)
    mock_predict.return_value = DropoutRiskResult(
        student_id=student.id,
        student_code=student.student_code,
        dropout_probability=0.61,
        risk_level="high",
        top_factors=[{"feature": "fail_rate", "impact": 0.4}],
        model_run_id=1,
        model_name="dropout_classifier",
        model_version="vtest",
        scored_at=scored_at,
        source="live",
    )

    response = await client.post(f"/api/v1/predictions/students/{student.id}/dropout-risk/predict")

    assert response.status_code == 200
    body = response.json()
    assert body["student_id"] == student.id
    assert body["dropout_probability"] == pytest.approx(0.61)
    assert body["risk_level"] == "high"
    assert body["source"] == "live"
    mock_predict.assert_called_once_with(student.id, model_run_id=None, persist=False)


@patch("app.api.v1.endpoints.analytics.predict_dropout_risk_for_student")
async def test_dropout_risk_predict_respects_rbac(
    mock_predict: object,
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    allowed_department, _, denied_program, _ = await _create_catalog(db_session)
    cohort = Cohort(code="K98", year_start=2026)
    db_session.add(cohort)
    await db_session.flush()
    student = Student(
        program_id=denied_program.id,
        cohort_id=cohort.id,
        student_code="DROP-LIVE-IDOR",
        full_name="Live IDOR",
    )
    db_session.add(student)
    await db_session.flush()

    manager = await _create_scoped_user(db_session, role=UserRole.manager, department_id=allowed_department.id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.post(f"/api/v1/predictions/students/{student.id}/dropout-risk/predict")

    assert response.status_code == 403
    mock_predict.assert_not_called()


@patch("app.api.v1.endpoints.analytics.predict_dropout_risk_for_student")
async def test_dropout_risk_predict_by_student_code(
    mock_predict: object,
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    university = University(code="EPU4", name="EPU4")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="CNTT4", name="CNTT4")
    db_session.add(department)
    await db_session.flush()
    program = Program(department_id=department.id, code="IT4", name="IT4")
    cohort = Cohort(code="K24", year_start=2024)
    db_session.add_all([program, cohort])
    await db_session.flush()
    student = Student(
        program_id=program.id,
        cohort_id=cohort.id,
        student_code="21810310019",
        full_name="By Code Predict",
    )
    db_session.add(student)
    await db_session.flush()

    scored_at = datetime.now(UTC)
    mock_predict.return_value = DropoutRiskResult(
        student_id=student.id,
        student_code=student.student_code,
        dropout_probability=0.88,
        risk_level="high",
        top_factors=[],
        model_run_id=1,
        model_name="dropout_classifier",
        model_version="vtest",
        scored_at=scored_at,
        source="live",
    )

    response = await client.post("/api/v1/predictions/students/by-code/21810310019/dropout-risk/predict")

    assert response.status_code == 200
    assert response.json()["dropout_probability"] == pytest.approx(0.88)
    mock_predict.assert_called_once_with(student.id, model_run_id=None, persist=False)

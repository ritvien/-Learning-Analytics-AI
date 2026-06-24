"""Unit tests for on-the-fly dropout prediction."""

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.ml.dropout.dataset import FEATURE_COLUMNS
from app.ml.dropout.score import (
    DropoutModelNotFoundError,
    DropoutStudentNotFoundError,
    predict_dropout_risk_for_student,
)
from app.ml.dropout.types import ModelBundle


def _build_test_bundle() -> ModelBundle:
    numeric_features = [c for c in FEATURE_COLUMNS if c != "program_id"]
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric_features),
            ("cat", OneHotEncoder(handle_unknown="ignore"), ["program_id"]),
        ],
    )
    model = LogisticRegression()
    rows = pd.DataFrame(
        [
            {
                "cohort_year": 2021,
                "program_id": 1,
                "total_registered_credits": 40,
                "total_failed_credits": 4,
                "fail_rate": 0.1,
                "cumulative_gpa": 3.0,
                "semesters_enrolled": 4,
                "avg_semester_gpa": 3.1,
            },
            {
                "cohort_year": 2022,
                "program_id": 2,
                "total_registered_credits": 30,
                "total_failed_credits": 12,
                "fail_rate": 0.4,
                "cumulative_gpa": 1.8,
                "semesters_enrolled": 3,
                "avg_semester_gpa": 1.7,
            },
        ],
    )
    labels = np.array([0, 1])
    pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])
    pipeline.fit(rows[FEATURE_COLUMNS], labels)
    return ModelBundle(
        model=pipeline.named_steps["model"],
        preprocessor=pipeline.named_steps["preprocessor"],
        feature_columns=FEATURE_COLUMNS,
        model_name="dropout_classifier",
        threshold=0.55,
    )


@patch("app.ml.dropout.score.joblib.load")
@patch("app.ml.dropout.score.pd.read_sql")
@patch("app.ml.dropout.score.create_engine")
def test_predict_dropout_risk_for_student_returns_live_result(
    mock_create_engine: MagicMock,
    mock_read_sql: MagicMock,
    mock_joblib_load: MagicMock,
) -> None:
    bundle = _build_test_bundle()
    mock_joblib_load.return_value = bundle
    mock_read_sql.return_value = pd.DataFrame(
        [
            {
                "student_id": 42,
                "student_code": "SV-042",
                "cohort_year": 2022,
                "program_id": 2,
                "status": "active",
                "total_registered_credits": 30,
                "total_failed_credits": 12,
                "fail_rate": 0.4,
                "cumulative_gpa": 1.8,
                "semesters_enrolled": 3,
                "avg_semester_gpa": 1.7,
            },
        ],
    )
    connection = MagicMock()
    connection.execute.return_value.one_or_none.return_value = MagicMock(
        id=7,
        model_name="dropout_classifier",
        model_version="vtest",
        artifact_uri="/tmp/model.joblib",
        status="completed",
    )
    engine = MagicMock()
    engine.dialect.name = "postgresql"
    engine.begin.return_value.__enter__.return_value = connection
    mock_create_engine.return_value = engine

    result = predict_dropout_risk_for_student(42, database_url="postgresql://x")

    assert result.student_id == 42
    assert result.student_code == "SV-042"
    assert 0.0 <= result.dropout_probability <= 1.0
    assert result.risk_level in {"low", "medium", "high"}
    assert result.model_run_id == 7
    assert result.model_version == "vtest"
    assert result.source == "live"
    assert result.top_factors


@patch("app.ml.dropout.score.create_engine")
def test_predict_dropout_risk_requires_postgresql(mock_create_engine: MagicMock) -> None:
    engine = MagicMock()
    engine.dialect.name = "sqlite"
    mock_create_engine.return_value = engine

    with pytest.raises(RuntimeError, match="PostgreSQL"):
        predict_dropout_risk_for_student(1, database_url="sqlite:///:memory:")


@patch("app.ml.dropout.score.joblib.load")
@patch("app.ml.dropout.score.pd.read_sql")
@patch("app.ml.dropout.score.create_engine")
def test_predict_dropout_risk_student_not_found(
    mock_create_engine: MagicMock,
    mock_read_sql: MagicMock,
    mock_joblib_load: MagicMock,
) -> None:
    mock_joblib_load.return_value = _build_test_bundle()
    connection = MagicMock()
    connection.execute.return_value.one_or_none.return_value = MagicMock(
        id=1,
        model_name="dropout_classifier",
        model_version="vtest",
        artifact_uri="/tmp/model.joblib",
        status="completed",
    )
    engine = MagicMock()
    engine.dialect.name = "postgresql"
    engine.begin.return_value.__enter__.return_value = connection
    mock_create_engine.return_value = engine
    mock_read_sql.return_value = pd.DataFrame()

    with pytest.raises(DropoutStudentNotFoundError, match="Student 99"):
        predict_dropout_risk_for_student(99, database_url="postgresql://x")


@patch("app.ml.dropout.score.create_engine")
def test_predict_dropout_risk_model_not_found(mock_create_engine: MagicMock) -> None:
    connection = MagicMock()
    connection.execute.return_value.one_or_none.return_value = None
    engine = MagicMock()
    engine.dialect.name = "postgresql"
    engine.begin.return_value.__enter__.return_value = connection
    mock_create_engine.return_value = engine

    with pytest.raises(DropoutModelNotFoundError, match="No completed dropout model"):
        predict_dropout_risk_for_student(1, database_url="postgresql://x")

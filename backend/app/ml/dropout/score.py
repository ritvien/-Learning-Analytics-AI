"""Batch scoring for dropout predictions."""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime

import joblib
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection

from app.config import get_settings
from app.ml.dropout.dataset import DROPOUT_FEATURE_QUERY
from app.ml.dropout.train import _sync_database_url
from app.ml.dropout.types import DropoutRiskResult, ModelBundle


class DropoutModelNotFoundError(ValueError):
    """Raised when no completed dropout model run is available."""


class DropoutStudentNotFoundError(ValueError):
    """Raised when a student has no rows in the dropout feature view."""


MIN_REGISTERED_CREDITS = 15
MIN_SEMESTERS_ENROLLED = 2


def _has_sufficient_history(row_features: pd.Series) -> bool:
    return (
        float(row_features.get("total_registered_credits") or 0) >= MIN_REGISTERED_CREDITS
        and float(row_features.get("semesters_enrolled") or 0) >= MIN_SEMESTERS_ENROLLED
    )


def _risk_level(probability: float, threshold: float) -> str:
    if probability >= threshold:
        return "high"
    if probability >= threshold * 0.5:
        return "medium"
    return "low"


def _safe_factor_value(value: object) -> float | None:
    """Return a JSON-safe rounded float, dropping NaN/inf."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return round(number, 4)


def _factor_payload(row_features: pd.Series, probability: float) -> list[dict[str, float]]:
    """Return lightweight explanation factors for one scored student."""
    factors: list[dict[str, float]] = []
    for feature in ("fail_rate", "cumulative_gpa"):
        impact = _safe_factor_value(row_features.get(feature))
        if impact is not None:
            factors.append({"feature": feature, "impact": impact})
    factors.append({"feature": "dropout_probability", "impact": round(float(probability), 4)})
    return factors[:3]


def _resolve_model_run(connection: Connection, model_run_id: int | None) -> tuple[int, str, str, ModelBundle]:
    """Load the requested or latest completed dropout model artifact."""
    if model_run_id is None:
        run = connection.execute(
            text(
                """
                SELECT id, model_name, model_version, artifact_uri, status
                FROM ml.model_run
                WHERE model_name = 'dropout_classifier' AND status = 'completed'
                ORDER BY trained_at DESC
                LIMIT 1
                """
            ),
        ).one_or_none()
    else:
        run = connection.execute(
            text(
                """
                SELECT id, model_name, model_version, artifact_uri, status
                FROM ml.model_run
                WHERE id = :model_run_id AND model_name = 'dropout_classifier'
                """
            ),
            {"model_run_id": model_run_id},
        ).one_or_none()
    if run is None:
        if model_run_id is None:
            raise DropoutModelNotFoundError("No completed dropout model run found")
        raise DropoutModelNotFoundError(f"Dropout model_run {model_run_id} not found")
    if run.status != "completed":
        raise DropoutModelNotFoundError(f"Model run {run.id} is not completed")
    bundle: ModelBundle = joblib.load(run.artifact_uri)
    return run.id, run.model_name, run.model_version, bundle


def _predict_probability(bundle: ModelBundle, row_features: pd.Series) -> float:
    """Score one feature row with a trained dropout bundle."""
    matrix = row_features[bundle.feature_columns].to_frame().T
    return float(bundle.model.predict_proba(bundle.preprocessor.transform(matrix))[:, 1][0])


def _build_dropout_result(
    *,
    student_id: int,
    student_code: str | None,
    row_features: pd.Series,
    probability: float,
    model_run_id: int,
    model_name: str,
    model_version: str,
    risk_threshold: float,
    scored_at: datetime,
    source: str = "live",
) -> DropoutRiskResult:
    return DropoutRiskResult(
        student_id=student_id,
        student_code=student_code,
        dropout_probability=probability,
        risk_level=_risk_level(probability, risk_threshold),
        top_factors=_factor_payload(row_features, probability),
        model_run_id=model_run_id,
        model_name=model_name,
        model_version=model_version,
        scored_at=scored_at,
        source=source,
    )


def predict_dropout_risk_for_student(
    student_id: int,
    *,
    model_run_id: int | None = None,
    database_url: str | None = None,
    persist: bool = False,
) -> DropoutRiskResult:
    """Run on-the-fly dropout inference for one student from DWH features."""
    settings = get_settings()
    sync_url = _sync_database_url(database_url or settings.database_url)
    engine = create_engine(sync_url)
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Dropout scoring requires PostgreSQL")

    with engine.begin() as connection:
        resolved_run_id, model_name, model_version, bundle = _resolve_model_run(connection, model_run_id)
        frame = pd.read_sql(
            text(DROPOUT_FEATURE_QUERY + " WHERE student_id = :student_id"),
            connection,
            params={"student_id": student_id},
        )
        if frame.empty:
            raise DropoutStudentNotFoundError(
                f"Student {student_id} not found in dwh.v_student_dropout_features"
            )

        row = frame.iloc[0]
        if not _has_sufficient_history(row):
            raise DropoutStudentNotFoundError(
                f"Student {student_id} does not have enough academic history for dropout scoring"
            )
        probability = _predict_probability(bundle, row)
        scored_at = datetime.now(UTC)
        result = _build_dropout_result(
            student_id=student_id,
            student_code=row.get("student_code"),
            row_features=row,
            probability=probability,
            model_run_id=resolved_run_id,
            model_name=model_name,
            model_version=model_version,
            risk_threshold=bundle.threshold,
            scored_at=scored_at,
            source="live",
        )

        if persist:
            connection.execute(
                text(
                    """
                    INSERT INTO ml.student_dropout_prediction
                        (model_run_id, student_id, dropout_probability, risk_level, top_factors, scored_at)
                    VALUES
                        (:model_run_id, :student_id, :probability, :risk_level, :top_factors, :scored_at)
                    ON CONFLICT (model_run_id, student_id) DO UPDATE SET
                        dropout_probability = EXCLUDED.dropout_probability,
                        risk_level = EXCLUDED.risk_level,
                        top_factors = EXCLUDED.top_factors,
                        scored_at = EXCLUDED.scored_at
                    """
                ),
                {
                    "model_run_id": resolved_run_id,
                    "student_id": student_id,
                    "probability": probability,
                    "risk_level": result.risk_level,
                    "top_factors": json.dumps(result.top_factors),
                    "scored_at": scored_at,
                },
            )
    return result


def score_dropout_predictions(model_run_id: int, *, database_url: str | None = None) -> int:
    """Score active students and upsert ml.student_dropout_prediction rows."""
    settings = get_settings()
    sync_url = _sync_database_url(database_url or settings.database_url)
    engine = create_engine(sync_url)
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Dropout scoring requires PostgreSQL")

    with engine.begin() as connection:
        resolved_run_id, model_name, model_version, bundle = _resolve_model_run(connection, model_run_id)
        connection.execute(
            text(
                """
                DELETE FROM ml.student_dropout_prediction p
                USING dwh.v_student_dropout_features f
                WHERE f.student_id = p.student_id
                  AND f.status = 'active'
                  AND (
                    f.total_registered_credits < :min_credits
                    OR f.semesters_enrolled < :min_semesters
                  )
                """
            ),
            {"min_credits": MIN_REGISTERED_CREDITS, "min_semesters": MIN_SEMESTERS_ENROLLED},
        )
        frame = pd.read_sql(
            text(
                DROPOUT_FEATURE_QUERY
                + (
                    " WHERE status = 'active'"
                    " AND total_registered_credits >= :min_credits"
                    " AND semesters_enrolled >= :min_semesters"
                )
            ),
            connection,
            params={"min_credits": MIN_REGISTERED_CREDITS, "min_semesters": MIN_SEMESTERS_ENROLLED},
        )
        connection.execute(
            text("DELETE FROM ml.student_dropout_prediction WHERE model_run_id = :model_run_id"),
            {"model_run_id": resolved_run_id},
        )
        if frame.empty:
            return 0

        scored_at = datetime.now(UTC)
        rows = 0
        for idx, student_id in enumerate(frame["student_id"].tolist()):
            row = frame.iloc[idx]
            probability = _predict_probability(bundle, row)
            result = _build_dropout_result(
                student_id=int(student_id),
                student_code=row.get("student_code"),
                row_features=row,
                probability=probability,
                model_run_id=resolved_run_id,
                model_name=model_name,
                model_version=model_version,
                risk_threshold=bundle.threshold,
                scored_at=scored_at,
                source="batch",
            )
            connection.execute(
                text(
                    """
                    INSERT INTO ml.student_dropout_prediction
                        (model_run_id, student_id, dropout_probability, risk_level, top_factors, scored_at)
                    VALUES
                        (:model_run_id, :student_id, :probability, :risk_level, :top_factors, :scored_at)
                    ON CONFLICT (model_run_id, student_id) DO UPDATE SET
                        dropout_probability = EXCLUDED.dropout_probability,
                        risk_level = EXCLUDED.risk_level,
                        top_factors = EXCLUDED.top_factors,
                        scored_at = EXCLUDED.scored_at
                    """
                ),
                {
                    "model_run_id": resolved_run_id,
                    "student_id": int(student_id),
                    "probability": probability,
                    "risk_level": result.risk_level,
                    "top_factors": json.dumps(result.top_factors),
                    "scored_at": scored_at,
                },
            )
            rows += 1
    return rows

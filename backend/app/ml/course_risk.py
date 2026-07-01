"""Rule-based course failure risk scoring.

This model is intentionally transparent: it estimates enrollment-level failure
risk from academic signals already available in the DWH/OLTP. It is a baseline
decision-support model, not a definitive judgement about a student.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text

from app.database import engine

MODEL_NAME = "course_failure_rule"
FEATURE_SET = [
    "component_average_at_prediction_cutoff",
    "component_weight_coverage",
    "student_cumulative_gpa",
    "student_prior_fail_count",
    "student_prior_failed_credits",
    "attempt_number",
    "dropout_probability",
]


@dataclass(frozen=True)
class CourseFailureRisk:
    """One enrollment-level course failure prediction."""

    pass_probability: float
    fail_probability: float
    predicted_status: str
    explanation: dict[str, Any]


def _clamp_probability(value: float) -> float:
    return max(0.00001, min(0.99999, value))


def _risk_level(fail_probability: float) -> str:
    if fail_probability >= 0.6:
        return "high"
    if fail_probability >= 0.3:
        return "medium"
    return "low"


def estimate_course_failure_risk(
    *,
    current_grade: float | None,
    cumulative_gpa: float | None,
    prior_fail_count: int,
    attempt_number: int,
    prior_failed_credits: int = 0,
    dropout_probability: float | None = None,
) -> CourseFailureRisk:
    """Estimate failure risk for one course enrollment from explainable signals."""
    score = 0.08
    reasons: list[str] = []

    if current_grade is None:
        score += 0.12
        reasons.append("Chưa có điểm hiện tại, cần theo dõi dữ liệu bổ sung")
    elif current_grade < 4.0:
        score += 0.62
        reasons.append("Điểm hiện tại dưới 4.0")
    elif current_grade < 5.0:
        score += 0.45
        reasons.append("Điểm hiện tại dưới ngưỡng đạt")
    elif current_grade < 5.5:
        score += 0.25
        reasons.append("Điểm hiện tại sát ngưỡng đạt")
    elif current_grade < 6.5:
        score += 0.10
        reasons.append("Điểm hiện tại ở vùng cần theo dõi")
    else:
        score -= 0.06

    if cumulative_gpa is None:
        score += 0.08
        reasons.append("Chưa có GPA tích lũy")
    elif cumulative_gpa < 2.0:
        score += 0.24
        reasons.append("GPA tích lũy thấp")
    elif cumulative_gpa < 2.5:
        score += 0.14
        reasons.append("GPA tích lũy cần theo dõi")

    if prior_fail_count >= 5:
        score += 0.20
        reasons.append("Lịch sử có nhiều học phần chưa đạt")
    elif prior_fail_count >= 2:
        score += 0.12
        reasons.append("Có lịch sử học phần chưa đạt")
    elif prior_fail_count == 1:
        score += 0.06
        reasons.append("Có một học phần chưa đạt trước đó")

    if prior_failed_credits >= 15:
        score += 0.12
        reasons.append("Số tín chỉ chưa đạt tích lũy cao")
    elif prior_failed_credits >= 6:
        score += 0.06
        reasons.append("Có nhiều tín chỉ chưa đạt trước đó")

    if attempt_number > 1:
        score += min(0.12, 0.04 * (attempt_number - 1))
        reasons.append("Đây là lượt học lại hoặc đăng ký lại")

    if dropout_probability is not None:
        if dropout_probability >= 0.7:
            score += 0.12
            reasons.append("ML dropout risk cao, dùng như tín hiệu phụ")
        elif dropout_probability >= 0.4:
            score += 0.06
            reasons.append("ML dropout risk cần theo dõi")

    fail_probability = round(_clamp_probability(score), 5)
    pass_probability = round(1 - fail_probability, 5)
    predicted_status = "fail" if fail_probability >= 0.5 else "pass"
    return CourseFailureRisk(
        pass_probability=pass_probability,
        fail_probability=fail_probability,
        predicted_status=predicted_status,
        explanation={
            "risk_level": _risk_level(fail_probability),
            "reasons": reasons or ["Tín hiệu học tập hiện tại chưa cho thấy rủi ro nổi bật"],
            "model_type": "transparent_rule_baseline",
            "confidence_note": "Dùng để ưu tiên hỗ trợ học vụ; không phải kết luận chắc chắn.",
        },
    )


def _float(value: object) -> float | None:
    return None if value is None else float(value)


async def score_course_failure_predictions(*, aggregate: bool = True) -> dict[str, int | str]:
    """Persist enrollment predictions and optionally aggregate student-semester credits."""
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Course failure scoring requires PostgreSQL")

    version = datetime.now(UTC).strftime("v%Y%m%d.%H%M%S")
    scored_at = datetime.now(UTC)
    async with engine.begin() as connection:
        model_run_id = (
            await connection.execute(
                text(
                    """
                    INSERT INTO ml.model_run
                        (model_name, model_version, status, feature_set, metrics, artifact_uri, trained_at)
                    VALUES
                        (:model_name, :model_version, 'completed', :feature_set, :metrics, NULL, NOW())
                    RETURNING id
                    """
                ),
                {
                    "model_name": MODEL_NAME,
                    "model_version": version,
                    "feature_set": json.dumps(FEATURE_SET),
                    "metrics": json.dumps(
                        {
                            "method": "transparent weighted rule baseline",
                            "purpose": "course failure early-warning and expected-credit aggregation",
                        }
                    ),
                },
            )
        ).scalar_one()

        rows = (
            await connection.execute(
                text(
                    """
                    WITH latest_dropout AS (
                        SELECT DISTINCT ON (p.student_id)
                            p.student_id,
                            p.dropout_probability
                        FROM ml.student_dropout_prediction p
                        JOIN ml.model_run r ON r.id = p.model_run_id
                        WHERE r.status = 'completed'
                        ORDER BY p.student_id, p.scored_at DESC
                    ),
                    component_signal AS (
                        SELECT
                            gc.enrollment_id,
                            ROUND(
                                SUM((gc.score / NULLIF(gc.max_score, 0)) * 10 * gct.weight)
                                    / NULLIF(SUM(gct.weight), 0),
                                2
                            ) AS component_average,
                            ROUND(SUM(gct.weight), 4) AS component_weight_coverage
                        FROM public.grade_components gc
                        JOIN public.grade_component_types gct ON gct.id = gc.component_type_id
                        WHERE gc.score IS NOT NULL
                          AND (gc.assessed_at IS NULL OR gc.assessed_at <= :prediction_cutoff)
                        GROUP BY gc.enrollment_id
                    ),
                    prior_failures AS (
                        SELECT
                            history.student_id,
                            COUNT(*)::INTEGER AS fail_count,
                            COALESCE(SUM(course.credits), 0)::INTEGER AS failed_credits
                        FROM public.enrollments history
                        JOIN public.sections history_section ON history_section.id = history.section_id
                        JOIN public.courses course ON course.id = history_section.course_id
                        WHERE history.is_passed IS FALSE
                        GROUP BY history.student_id
                    )
                    SELECT
                        e.id AS enrollment_id,
                        cs.component_average,
                        cs.component_weight_coverage,
                        e.attempt_number,
                        s.gpa_cumulative,
                        COALESCE(pf.fail_count, 0) AS prior_fail_count,
                        COALESCE(pf.failed_credits, 0) AS prior_failed_credits,
                        ld.dropout_probability
                    FROM public.enrollments e
                    JOIN public.students s ON s.id = e.student_id
                    LEFT JOIN component_signal cs ON cs.enrollment_id = e.id
                    LEFT JOIN prior_failures pf ON pf.student_id = e.student_id
                    LEFT JOIN latest_dropout ld ON ld.student_id = e.student_id
                    WHERE e.status = 'enrolled'
                      AND e.completed_at IS NULL
                      AND e.final_grade IS NULL
                      AND e.is_passed IS NULL
                      AND cs.component_average IS NOT NULL
                    """
                ),
                {"prediction_cutoff": scored_at},
            )
        ).mappings().all()

        upserted = 0
        high = 0
        medium = 0
        low = 0
        for row in rows:
            risk = estimate_course_failure_risk(
                current_grade=_float(row["component_average"]),
                cumulative_gpa=_float(row["gpa_cumulative"]),
                prior_fail_count=int(row["prior_fail_count"] or 0),
                prior_failed_credits=int(row["prior_failed_credits"] or 0),
                attempt_number=int(row["attempt_number"] or 1),
                dropout_probability=_float(row["dropout_probability"]),
            )
            risk.explanation["component_weight_coverage"] = _float(row["component_weight_coverage"])
            risk.explanation["availability"] = "ready"
            level = risk.explanation["risk_level"]
            if level == "high":
                high += 1
            elif level == "medium":
                medium += 1
            else:
                low += 1
            await connection.execute(
                text(
                    """
                    INSERT INTO ml.enrollment_prediction (
                        model_run_id, enrollment_id, prediction_cutoff,
                        pass_probability, fail_probability, predicted_status,
                        explanation, scored_at
                    )
                    VALUES (
                        :model_run_id, :enrollment_id, :prediction_cutoff,
                        :pass_probability, :fail_probability, :predicted_status,
                        :explanation, :scored_at
                    )
                    ON CONFLICT (model_run_id, enrollment_id, prediction_cutoff) DO UPDATE SET
                        pass_probability = EXCLUDED.pass_probability,
                        fail_probability = EXCLUDED.fail_probability,
                        predicted_status = EXCLUDED.predicted_status,
                        explanation = EXCLUDED.explanation,
                        scored_at = EXCLUDED.scored_at
                    """
                ),
                {
                    "model_run_id": model_run_id,
                    "enrollment_id": int(row["enrollment_id"]),
                    "prediction_cutoff": scored_at,
                    "pass_probability": risk.pass_probability,
                    "fail_probability": risk.fail_probability,
                    "predicted_status": risk.predicted_status,
                    "explanation": json.dumps(risk.explanation, ensure_ascii=False),
                    "scored_at": scored_at,
                },
            )
            upserted += 1

        await connection.execute(
            text("UPDATE ml.model_run SET metrics = :metrics WHERE id = :model_run_id"),
            {
                "model_run_id": model_run_id,
                "metrics": json.dumps(
                    {
                        "method": "transparent weighted rule baseline",
                        "purpose": "course failure early-warning and expected-credit aggregation",
                        "rows_scored": upserted,
                        "risk_distribution": {"high": high, "medium": medium, "low": low},
                    }
                ),
            },
        )

    aggregated = 0
    if aggregate:
        from app.ml.scoring import aggregate_student_semester_predictions

        aggregated = await aggregate_student_semester_predictions(model_run_id)
    return {
        "status": "completed",
        "model_run_id": model_run_id,
        "model_version": version,
        "rows_upserted": upserted,
        "semester_rows_upserted": aggregated,
    }

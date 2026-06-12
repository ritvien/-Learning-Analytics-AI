"""Persist student-semester credit summaries from enrollment predictions."""

import argparse
import asyncio

from sqlalchemy import text

from app.database import engine


async def aggregate_student_semester_predictions(model_run_id: int, *, high_risk_threshold: float = 0.5) -> int:
    """Upsert expected credit summaries for one completed model run."""
    if engine.dialect.name != "postgresql":
        raise RuntimeError("ML prediction aggregation requires PostgreSQL")
    if not 0 <= high_risk_threshold <= 1:
        raise ValueError("high_risk_threshold must be between 0 and 1")

    statement = text(
        """
        INSERT INTO ml.student_semester_prediction (
            model_run_id, student_id, semester_id, registered_credits,
            expected_passed_credits, expected_failed_credits,
            high_risk_failed_credits, risk_level, scored_at
        )
        SELECT
            p.model_run_id,
            e.student_id,
            sec.semester_id,
            SUM(c.credits)::INTEGER,
            ROUND(SUM(c.credits * p.pass_probability), 2),
            ROUND(SUM(c.credits * p.fail_probability), 2),
            COALESCE(SUM(c.credits) FILTER (WHERE p.fail_probability >= :threshold), 0)::INTEGER,
            CASE
                WHEN AVG(p.fail_probability) >= 0.60 THEN 'high'
                WHEN AVG(p.fail_probability) >= 0.30 THEN 'medium'
                ELSE 'low'
            END,
            NOW()
        FROM ml.enrollment_prediction p
        JOIN public.enrollments e ON e.id = p.enrollment_id
        JOIN public.sections sec ON sec.id = e.section_id
        JOIN public.courses c ON c.id = sec.course_id
        WHERE p.model_run_id = :model_run_id
        GROUP BY p.model_run_id, e.student_id, sec.semester_id
        ON CONFLICT (model_run_id, student_id, semester_id) DO UPDATE SET
            registered_credits = EXCLUDED.registered_credits,
            expected_passed_credits = EXCLUDED.expected_passed_credits,
            expected_failed_credits = EXCLUDED.expected_failed_credits,
            high_risk_failed_credits = EXCLUDED.high_risk_failed_credits,
            risk_level = EXCLUDED.risk_level,
            scored_at = NOW()
        """
    )
    async with engine.begin() as connection:
        result = await connection.execute(
            statement,
            {"model_run_id": model_run_id, "threshold": high_risk_threshold},
        )
    return result.rowcount


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(description="Aggregate enrollment predictions into expected credits")
    parser.add_argument("model_run_id", type=int)
    parser.add_argument("--high-risk-threshold", type=float, default=0.5)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    rows = asyncio.run(
        aggregate_student_semester_predictions(
            args.model_run_id,
            high_risk_threshold=args.high_risk_threshold,
        )
    )
    print(f"Upserted {rows} student-semester predictions")

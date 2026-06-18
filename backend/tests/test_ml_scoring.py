"""Unit tests for ML scoring."""

import pytest

from app.ml.scoring import aggregate_student_semester_predictions


@pytest.mark.asyncio
async def test_scoring_requires_postgresql():
    """aggregate_student_semester_predictions requires PostgreSQL."""
    # Since our tests run on SQLite memory DB, this should raise a RuntimeError
    with pytest.raises(RuntimeError, match="requires PostgreSQL"):
        await aggregate_student_semester_predictions(1)


@pytest.mark.asyncio
async def test_scoring_edge_cases_threshold():
    """Invalid high_risk_threshold raises ValueError."""
    # Temporary mock engine dialect to bypass the PostgreSQL check
    from app.ml.scoring import engine
    original_dialect = engine.dialect.name
    engine.dialect.name = "postgresql"
    
    try:
        with pytest.raises(ValueError, match="high_risk_threshold must be between 0 and 1"):
            await aggregate_student_semester_predictions(1, high_risk_threshold=-0.1)

        with pytest.raises(ValueError, match="high_risk_threshold must be between 0 and 1"):
            await aggregate_student_semester_predictions(1, high_risk_threshold=1.5)
    finally:
        engine.dialect.name = original_dialect

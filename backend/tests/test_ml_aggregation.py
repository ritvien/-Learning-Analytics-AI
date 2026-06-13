"""Tests for enrollment-to-credit prediction aggregation."""

import pytest

from app.ml.aggregation import EnrollmentRisk, aggregate_credit_prediction


def test_aggregate_credit_prediction() -> None:
    """Expected credits are weighted by enrollment pass probability."""
    result = aggregate_credit_prediction(
        [
            EnrollmentRisk(credits=3, pass_probability=0.8),
            EnrollmentRisk(credits=2, pass_probability=0.25),
        ]
    )

    assert result.registered_credits == 5
    assert result.expected_passed_credits == 2.9
    assert result.expected_failed_credits == 2.1
    assert result.high_risk_failed_credits == 2


def test_aggregate_credit_prediction_rejects_invalid_probability() -> None:
    """Invalid model output is rejected before it reaches persistence."""
    with pytest.raises(ValueError, match="valid"):
        aggregate_credit_prediction([EnrollmentRisk(credits=3, pass_probability=1.2)])

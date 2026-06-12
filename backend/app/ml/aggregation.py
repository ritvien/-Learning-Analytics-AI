"""Aggregate enrollment-level pass probabilities into expected credits."""

from dataclasses import dataclass


@dataclass(frozen=True)
class EnrollmentRisk:
    """One enrollment prediction used for credit aggregation."""

    credits: int
    pass_probability: float


@dataclass(frozen=True)
class CreditPrediction:
    """Expected credit totals for one student-semester."""

    registered_credits: int
    expected_passed_credits: float
    expected_failed_credits: float
    high_risk_failed_credits: int


def aggregate_credit_prediction(
    risks: list[EnrollmentRisk],
    *,
    high_risk_threshold: float = 0.5,
) -> CreditPrediction:
    """Aggregate pass probabilities without training a separate credit model."""
    if not 0 <= high_risk_threshold <= 1:
        raise ValueError("high_risk_threshold must be between 0 and 1")
    for risk in risks:
        if risk.credits < 0 or not 0 <= risk.pass_probability <= 1:
            raise ValueError("credits and pass_probability must be valid")

    registered = sum(risk.credits for risk in risks)
    expected_passed = sum(risk.credits * risk.pass_probability for risk in risks)
    expected_failed = registered - expected_passed
    high_risk_failed = sum(risk.credits for risk in risks if 1 - risk.pass_probability >= high_risk_threshold)
    return CreditPrediction(
        registered_credits=registered,
        expected_passed_credits=round(expected_passed, 2),
        expected_failed_credits=round(expected_failed, 2),
        high_risk_failed_credits=high_risk_failed,
    )

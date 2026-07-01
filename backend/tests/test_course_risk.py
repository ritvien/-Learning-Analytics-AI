"""Tests for transparent course-failure risk scoring."""

from app.ml.course_risk import estimate_course_failure_risk


def test_course_failure_risk_prioritizes_low_current_grade() -> None:
    result = estimate_course_failure_risk(
        current_grade=4.2,
        cumulative_gpa=2.4,
        prior_fail_count=3,
        attempt_number=1,
        dropout_probability=0.45,
    )

    assert result.fail_probability >= 0.6
    assert result.predicted_status == "fail"
    assert result.explanation["risk_level"] == "high"
    assert any("ngưỡng đạt" in reason for reason in result.explanation["reasons"])


def test_course_failure_risk_keeps_stable_student_low() -> None:
    result = estimate_course_failure_risk(
        current_grade=8.0,
        cumulative_gpa=3.0,
        prior_fail_count=0,
        attempt_number=1,
        dropout_probability=0.05,
    )

    assert result.fail_probability < 0.3
    assert result.predicted_status == "pass"
    assert result.explanation["risk_level"] == "low"


def test_course_failure_risk_treats_dropout_as_supporting_signal() -> None:
    without_dropout = estimate_course_failure_risk(
        current_grade=6.8,
        cumulative_gpa=2.8,
        prior_fail_count=0,
        attempt_number=1,
    )
    with_dropout = estimate_course_failure_risk(
        current_grade=6.8,
        cumulative_gpa=2.8,
        prior_fail_count=0,
        attempt_number=1,
        dropout_probability=0.8,
    )

    assert with_dropout.fail_probability > without_dropout.fail_probability
    assert with_dropout.fail_probability < 0.6

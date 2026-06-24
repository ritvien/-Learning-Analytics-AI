"""Tests for dropout feature view SQL hook."""

from app.analytics.etl import DROPOUT_FEATURE_VIEW_SQL


def test_dropout_feature_view_sql_declares_expected_columns() -> None:
    for column in (
        "student_id",
        "cohort_year",
        "program_id",
        "status",
        "total_registered_credits",
        "fail_rate",
        "cumulative_gpa",
        "semesters_enrolled",
    ):
        assert column in DROPOUT_FEATURE_VIEW_SQL

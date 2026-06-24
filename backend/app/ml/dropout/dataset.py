"""Dataset loading and label rules for dropout classification."""

from __future__ import annotations

import pandas as pd

from app.ml.dropout.types import SplitConfig

FEATURE_COLUMNS = [
    "cohort_year",
    "program_id",
    "total_registered_credits",
    "total_failed_credits",
    "fail_rate",
    "cumulative_gpa",
    "semesters_enrolled",
    "avg_semester_gpa",
]

NUMERIC_FEATURES = [
    "cohort_year",
    "total_registered_credits",
    "total_failed_credits",
    "fail_rate",
    "cumulative_gpa",
    "semesters_enrolled",
    "avg_semester_gpa",
]

CATEGORICAL_FEATURES = ["program_id"]

FORBIDDEN_FEATURES = {"status", "student_code", "student_id", "gender", "full_name"}

DROPOUT_FEATURE_QUERY = """
SELECT
    student_id,
    student_code,
    cohort_year,
    program_id,
    status,
    total_registered_credits,
    total_failed_credits,
    fail_rate,
    cumulative_gpa,
    semesters_enrolled,
    avg_semester_gpa
FROM dwh.v_student_dropout_features
"""


def assign_dropout_label(status: str) -> int | None:
    """Map student status to binary dropout label; None means exclude from training."""
    if status in ("expelled", "withdrawn"):
        return 1
    if status == "active":
        return 0
    return None


def filter_training_population(frame: pd.DataFrame, config: SplitConfig | None = None) -> pd.DataFrame:
    """Keep labeled rows and apply negative cohort cutoff."""
    cfg = config or SplitConfig()
    working = frame.copy()
    working["is_dropout"] = working["status"].map(assign_dropout_label)
    working = working[working["is_dropout"].notna()].copy()
    negatives = (working["is_dropout"] == 0) & (working["cohort_year"] <= cfg.max_negative_cohort_year)
    positives = working["is_dropout"] == 1
    return working[positives | negatives].reset_index(drop=True)


def split_by_cohort(
    frame: pd.DataFrame,
    config: SplitConfig | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split labeled data into train, validation, and test by cohort year."""
    cfg = config or SplitConfig()
    train = frame[frame["cohort_year"] <= cfg.train_max_year].copy()
    val = frame[frame["cohort_year"] == cfg.val_year].copy()
    test = frame[frame["cohort_year"] == cfg.test_year].copy()
    return train, val, test


def assert_no_forbidden_features(columns: list[str]) -> None:
    """Reject feature sets that would leak labels or identifiers."""
    overlap = FORBIDDEN_FEATURES.intersection(columns)
    if overlap:
        raise ValueError(f"Forbidden features in training matrix: {sorted(overlap)}")

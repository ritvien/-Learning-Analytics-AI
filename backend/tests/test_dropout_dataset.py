"""Unit tests for dropout dataset rules."""

import pandas as pd
import pytest

from app.ml.dropout.dataset import (
    FEATURE_COLUMNS,
    assert_no_forbidden_features,
    assign_dropout_label,
    filter_training_population,
    split_by_cohort,
)


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"student_id": 1, "status": "expelled", "cohort_year": 2020},
            {"student_id": 2, "status": "withdrawn", "cohort_year": 2021},
            {"student_id": 3, "status": "active", "cohort_year": 2023},
            {"student_id": 4, "status": "active", "cohort_year": 2024},
            {"student_id": 5, "status": "graduated", "cohort_year": 2020},
        ]
    )


def test_assign_dropout_label() -> None:
    assert assign_dropout_label("expelled") == 1
    assert assign_dropout_label("withdrawn") == 1
    assert assign_dropout_label("active") == 0
    assert assign_dropout_label("graduated") is None


def test_filter_training_population() -> None:
    filtered = filter_training_population(_sample_frame())
    assert set(filtered["student_id"].tolist()) == {1, 2, 3}


def test_split_by_cohort() -> None:
    labeled = filter_training_population(_sample_frame())
    train, val, test = split_by_cohort(labeled)
    assert set(train["student_id"]) == {1, 2}
    assert test["student_id"].tolist() == [3]
    assert val.empty


def test_assert_no_forbidden_features_rejects_status() -> None:
    with pytest.raises(ValueError, match="Forbidden features"):
        assert_no_forbidden_features(["status", "fail_rate"])


def test_feature_columns_exclude_forbidden() -> None:
    assert_no_forbidden_features(FEATURE_COLUMNS)

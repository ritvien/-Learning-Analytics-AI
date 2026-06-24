"""Tests for dropout cross-validation and feature importance."""

from unittest.mock import patch

import numpy as np
import pandas as pd

from app.ml.dropout.evaluate import (
    _aggregate_transformed_importance,
    cross_validate_dropout,
)


def test_aggregate_transformed_importance_groups_program_dummies() -> None:
    names = ["num__fail_rate", "num__cumulative_gpa", "cat__program_id_1", "cat__program_id_2"]
    values = np.array([0.5, 0.3, 0.1, 0.1])
    aggregated = _aggregate_transformed_importance(names, values)
    assert aggregated["fail_rate"] > aggregated["cumulative_gpa"]
    assert aggregated["program_id"] > 0


@patch("app.ml.dropout.evaluate.load_feature_frame")
def test_cross_validate_dropout_returns_ten_folds(mock_load: object) -> None:
    rows = []
    for idx in range(200):
        rows.append({
            "cohort_year": 2020 + (idx % 4),
            "program_id": (idx % 3) + 1,
            "status": "expelled" if idx < 40 else "active",
            "total_registered_credits": 30 + idx % 10,
            "total_failed_credits": idx % 8,
            "fail_rate": (idx % 8) / 30,
            "cumulative_gpa": 2.0 + (idx % 5) * 0.2,
            "semesters_enrolled": 2 + idx % 4,
            "avg_semester_gpa": 2.1 + (idx % 3) * 0.1,
        })
    mock_load.return_value = pd.DataFrame(rows)

    result = cross_validate_dropout(n_splits=10)

    assert result["n_splits"] == 10
    assert len(result["models"]["logistic_regression"]["folds"]) == 10
    assert "pr_auc" in result["models"]["xgboost"]["summary"]

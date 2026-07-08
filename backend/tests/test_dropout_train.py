"""Training module smoke tests without PostgreSQL."""

from app.ml.dropout.dataset import FEATURE_COLUMNS
from app.ml.dropout.types import ModelMetrics


def test_model_metrics_dataclass() -> None:
    metrics = ModelMetrics(
        precision=0.5,
        recall=0.8,
        f1=0.62,
        pr_auc=0.7,
        roc_auc=0.75,
        confusion_matrix=[[10, 2], [3, 5]],
        threshold=0.4,
    )
    assert metrics.threshold == 0.4
    assert metrics.recall == 0.8


def test_training_feature_set_matches_spec() -> None:
    assert "status" not in FEATURE_COLUMNS
    assert "cohort_year" not in FEATURE_COLUMNS
    assert "program_id" not in FEATURE_COLUMNS
    assert "fail_rate" in FEATURE_COLUMNS

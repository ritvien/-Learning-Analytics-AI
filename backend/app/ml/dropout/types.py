"""Shared types for the dropout ML pipeline."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class SplitConfig:
    """Temporal cohort split boundaries."""

    train_max_year: int = 2021
    val_year: int = 2022
    test_year: int = 2023
    max_negative_cohort_year: int = 2023


@dataclass
class ModelMetrics:
    """Classification metrics for one evaluation split."""

    precision: float
    recall: float
    f1: float
    pr_auc: float
    roc_auc: float
    confusion_matrix: list[list[int]]
    threshold: float = 0.5


@dataclass
class TrainResult:
    """Outcome of a dropout training run."""

    model_run_id: int
    model_version: str
    selected_model: str
    feature_names: list[str]
    metrics: dict[str, Any]
    artifact_path: str
    threshold: float


@dataclass
class ModelBundle:
    """Serialized training artifact."""

    model: Any
    preprocessor: Any
    feature_columns: list[str]
    model_name: str
    threshold: float
    top_feature_names: list[str] = field(default_factory=list)


@dataclass
class DropoutRiskResult:
    """One student dropout-risk prediction from the ML classifier."""

    student_id: int
    student_code: str | None
    dropout_probability: float
    risk_level: str
    top_factors: list[dict[str, float]]
    model_run_id: int
    model_name: str
    model_version: str
    scored_at: datetime
    source: str = "live"

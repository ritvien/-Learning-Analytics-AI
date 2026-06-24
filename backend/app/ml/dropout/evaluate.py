"""Cross-validation and feature-importance evaluation for dropout ML."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.base import clone
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

from app.ml.dropout.dataset import FEATURE_COLUMNS, filter_training_population
from app.ml.dropout.train import _build_preprocessor, load_feature_frame
from app.ml.dropout.types import SplitConfig

CV_SCORING = {
    "precision": "precision",
    "recall": "recall",
    "f1": "f1",
    "pr_auc": "average_precision",
    "roc_auc": "roc_auc",
}


@dataclass(frozen=True)
class CvSummary:
    """Mean and std of a metric across CV folds."""

    mean: float
    std: float


def _aggregate_transformed_importance(
    feature_names: list[str],
    importances: np.ndarray,
) -> dict[str, float]:
    """Roll one-hot / scaled columns back to raw MVP feature names."""
    aggregated = {column: 0.0 for column in FEATURE_COLUMNS}
    for name, value in zip(feature_names, importances, strict=False):
        magnitude = abs(float(value))
        if name.startswith("num__"):
            raw = name.removeprefix("num__")
            if raw in aggregated:
                aggregated[raw] += magnitude
        elif name.startswith("cat__"):
            aggregated["program_id"] += magnitude
    total = sum(aggregated.values()) or 1.0
    return {
        key: round(score / total, 4)
        for key, score in sorted(aggregated.items(), key=lambda item: item[1], reverse=True)
    }


def _summarize_cv_scores(cv_results: dict[str, np.ndarray]) -> dict[str, CvSummary]:
    summary: dict[str, CvSummary] = {}
    for metric in CV_SCORING:
        values = cv_results[f"test_{metric}"]
        summary[metric] = CvSummary(mean=round(float(np.mean(values)), 4), std=round(float(np.std(values)), 4))
    return summary


def _build_model_pipelines(y: np.ndarray) -> dict[str, Pipeline]:
    pos_count = int((y == 1).sum())
    neg_count = int((y == 0).sum())
    scale_pos_weight = neg_count / max(pos_count, 1)
    preprocessor = _build_preprocessor()
    return {
        "logistic_regression": Pipeline([
            ("prep", preprocessor),
            (
                "clf",
                LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42),
            ),
        ]),
        "xgboost": Pipeline([
            ("prep", clone(preprocessor)),
            (
                "clf",
                XGBClassifier(
                    scale_pos_weight=scale_pos_weight,
                    eval_metric="logloss",
                    n_estimators=100,
                    max_depth=4,
                    random_state=42,
                ),
            ),
        ]),
    }


def cross_validate_dropout(
    *,
    n_splits: int = 10,
    database_url: str | None = None,
    split_config: SplitConfig | None = None,
    random_state: int = 42,
) -> dict[str, Any]:
    """Run stratified k-fold CV on the labeled dropout population."""
    frame = load_feature_frame(database_url)
    labeled = filter_training_population(frame, split_config or SplitConfig())
    if labeled.empty:
        raise RuntimeError("No labeled rows available for cross-validation")

    x_matrix = labeled[FEATURE_COLUMNS]
    y_vector = labeled["is_dropout"].astype(int).to_numpy()

    if len(np.unique(y_vector)) < 2:
        raise RuntimeError("Cross-validation requires both classes in the labeled population")

    splitter = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    pipelines = _build_model_pipelines(y_vector)

    results: dict[str, Any] = {
        "n_splits": n_splits,
        "n_samples": len(labeled),
        "n_positive": int((y_vector == 1).sum()),
        "n_negative": int((y_vector == 0).sum()),
        "positive_rate": round(float(y_vector.mean()), 4),
        "models": {},
    }

    for model_name, pipeline in pipelines.items():
        cv_results = cross_validate(
            pipeline,
            x_matrix,
            y_vector,
            cv=splitter,
            scoring=CV_SCORING,
            n_jobs=1,
        )
        fold_metrics = []
        for fold_idx in range(n_splits):
            fold_metrics.append({
                metric: round(float(cv_results[f"test_{metric}"][fold_idx]), 4)
                for metric in CV_SCORING
            })
        results["models"][model_name] = {
            "summary": {k: v.__dict__ for k, v in _summarize_cv_scores(cv_results).items()},
            "folds": fold_metrics,
        }

    return results


def compute_feature_importance(
    *,
    database_url: str | None = None,
    split_config: SplitConfig | None = None,
    random_state: int = 42,
    n_repeats: int = 10,
) -> dict[str, Any]:
    """Estimate feature influence on dropout using permutation + model-native signals."""
    frame = load_feature_frame(database_url)
    labeled = filter_training_population(frame, split_config or SplitConfig())
    x_matrix = labeled[FEATURE_COLUMNS]
    y_vector = labeled["is_dropout"].astype(int).to_numpy()

    pipelines = _build_model_pipelines(y_vector)
    importance: dict[str, Any] = {
        "n_samples": len(labeled),
        "models": {},
    }

    for model_name, pipeline in pipelines.items():
        fitted = pipeline.fit(x_matrix, y_vector)
        preprocessor = fitted.named_steps["prep"]
        classifier = fitted.named_steps["clf"]
        feature_names = preprocessor.get_feature_names_out().tolist()

        if hasattr(classifier, "coef_"):
            native = _aggregate_transformed_importance(feature_names, np.abs(classifier.coef_[0]))
        elif hasattr(classifier, "feature_importances_"):
            native = _aggregate_transformed_importance(feature_names, classifier.feature_importances_)
        else:
            native = {}

        perm = permutation_importance(
            fitted,
            x_matrix,
            y_vector,
            n_repeats=n_repeats,
            random_state=random_state,
            scoring="average_precision",
            n_jobs=1,
        )
        perm_transformed = _aggregate_transformed_importance(feature_names, perm.importances_mean)

        importance["models"][model_name] = {
            "permutation_importance": perm_transformed,
            "native_importance": native,
            "top_features": list(perm_transformed.keys())[:5],
        }

    return importance


def run_full_evaluation(
    *,
    n_splits: int = 10,
    database_url: str | None = None,
) -> dict[str, Any]:
    """Cross-validation plus feature-importance report payload."""
    return {
        "cross_validation": cross_validate_dropout(n_splits=n_splits, database_url=database_url),
        "feature_importance": compute_feature_importance(database_url=database_url),
    }


if __name__ == "__main__":
    import json

    print(json.dumps(run_full_evaluation(), indent=2))

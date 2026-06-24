"""Train and evaluate the dropout classifier."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sqlalchemy import create_engine, text
from xgboost import XGBClassifier

from app.config import get_settings
from app.ml.dropout.dataset import (
    CATEGORICAL_FEATURES,
    DROPOUT_FEATURE_QUERY,
    FEATURE_COLUMNS,
    NUMERIC_FEATURES,
    assert_no_forbidden_features,
    filter_training_population,
    split_by_cohort,
)
from app.ml.dropout.types import ModelBundle, ModelMetrics, SplitConfig, TrainResult

MODEL_NAME = "dropout_classifier"


def resolve_artifact_dir() -> Path:
    """Return a writable directory for joblib model artifacts."""
    configured = get_settings().ml_artifact_dir.strip()
    if configured:
        path = Path(configured)
    else:
        path = Path(__file__).resolve().parents[3] / "ml_artifacts"
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write_probe"
        probe.touch()
        probe.unlink(missing_ok=True)
        return path
    except OSError:
        fallback = Path("/tmp/ml_artifacts")
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _sync_database_url(async_url: str) -> str:
    return async_url.replace("postgresql+asyncpg://", "postgresql://").replace("sqlite+aiosqlite://", "sqlite://")


def _build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]),
                NUMERIC_FEATURES,
            ),
            (
                "cat",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("encoder", OneHotEncoder(handle_unknown="ignore")),
                ]),
                CATEGORICAL_FEATURES,
            ),
        ]
    )


def _evaluate(y_true: np.ndarray, probabilities: np.ndarray, threshold: float) -> ModelMetrics:
    predictions = (probabilities >= threshold).astype(int)
    return ModelMetrics(
        precision=float(precision_score(y_true, predictions, zero_division=0)),
        recall=float(recall_score(y_true, predictions, zero_division=0)),
        f1=float(f1_score(y_true, predictions, zero_division=0)),
        pr_auc=float(average_precision_score(y_true, probabilities)) if len(np.unique(y_true)) > 1 else 0.0,
        roc_auc=float(roc_auc_score(y_true, probabilities)) if len(np.unique(y_true)) > 1 else 0.0,
        confusion_matrix=confusion_matrix(y_true, predictions).tolist(),
        threshold=threshold,
    )


def _tune_threshold(y_true: np.ndarray, probabilities: np.ndarray) -> float:
    best_threshold = 0.5
    best_f1 = -1.0
    for threshold in np.arange(0.1, 0.91, 0.05):
        score = f1_score(y_true, (probabilities >= threshold).astype(int), zero_division=0)
        if score > best_f1:
            best_f1 = score
            best_threshold = float(threshold)
    return best_threshold


def _top_factors(model: object, feature_names: list[str], *, limit: int = 3) -> list[dict[str, float]]:
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        importances = np.abs(model.coef_[0])
    else:
        return []

    pairs = sorted(zip(feature_names, importances, strict=False), key=lambda item: item[1], reverse=True)
    return [{"feature": name, "impact": round(float(value), 4)} for name, value in pairs[:limit]]


def load_feature_frame(database_url: str | None = None) -> pd.DataFrame:
    """Load the dropout feature view into a pandas DataFrame."""
    settings = get_settings()
    url = _sync_database_url(database_url or settings.database_url)
    engine = create_engine(url)
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Dropout training requires PostgreSQL with DWH schema")
    return pd.read_sql(DROPOUT_FEATURE_QUERY, engine)


def train_dropout_model(
    *,
    database_url: str | None = None,
    model_version: str | None = None,
    split_config: SplitConfig | None = None,
) -> TrainResult:
    """Train dropout models, persist artifact, and insert ml.model_run."""
    cfg = split_config or SplitConfig()
    frame = load_feature_frame(database_url)
    labeled = filter_training_population(frame, cfg)
    train_df, val_df, test_df = split_by_cohort(labeled, cfg)

    if train_df.empty or val_df.empty:
        raise RuntimeError("Insufficient training data after cohort split")

    assert_no_forbidden_features(FEATURE_COLUMNS)

    x_train = train_df[FEATURE_COLUMNS]
    y_train = train_df["is_dropout"].astype(int).to_numpy()
    x_val = val_df[FEATURE_COLUMNS]
    y_val = val_df["is_dropout"].astype(int).to_numpy()
    x_test = test_df[FEATURE_COLUMNS]
    y_test = test_df["is_dropout"].astype(int).to_numpy()

    pos_count = int((y_train == 1).sum())
    neg_count = int((y_train == 0).sum())
    scale_pos_weight = neg_count / max(pos_count, 1)

    preprocessor = _build_preprocessor()
    x_train_p = preprocessor.fit_transform(x_train)
    x_val_p = preprocessor.transform(x_val)

    feature_names = preprocessor.get_feature_names_out().tolist()

    candidates: dict[str, Any] = {
        "logistic_regression": LogisticRegression(class_weight="balanced", max_iter=1000),
        "xgboost": XGBClassifier(
            scale_pos_weight=scale_pos_weight,
            eval_metric="logloss",
            n_estimators=100,
            max_depth=4,
            random_state=42,
        ),
    }

    best_val_pr_auc = 0.0
    best_val_recall = 0.0
    candidate_val_metrics: dict[str, dict[str, object]] = {}

    for name, model in candidates.items():
        model.fit(x_train_p, y_train)
        val_probs = model.predict_proba(x_val_p)[:, 1]
        candidate_val_metrics[name] = _evaluate(y_val, val_probs, 0.5).__dict__
        val_pr_auc = float(candidate_val_metrics[name]["pr_auc"])
        val_recall = float(candidate_val_metrics[name]["recall"])
        if val_pr_auc > best_val_pr_auc or (val_pr_auc == best_val_pr_auc and val_recall > best_val_recall):
            best_name = name
            best_model = model
            best_val_pr_auc = val_pr_auc
            best_val_recall = val_recall

    val_probs = best_model.predict_proba(x_val_p)[:, 1]
    threshold = _tune_threshold(y_val, val_probs)

    train_val_x = pd.concat([train_df, val_df], ignore_index=True)[FEATURE_COLUMNS]
    train_val_y = pd.concat([train_df, val_df], ignore_index=True)["is_dropout"].astype(int).to_numpy()
    final_preprocessor = _build_preprocessor()
    x_final = final_preprocessor.fit_transform(train_val_x)
    final_model = candidates[best_name]
    final_model.fit(x_final, train_val_y)

    test_probs = (
        final_model.predict_proba(final_preprocessor.transform(x_test))[:, 1]
        if not test_df.empty
        else np.array([])
    )
    val_metrics = _evaluate(y_val, val_probs, threshold)
    test_metrics = (
        _evaluate(y_test, test_probs, threshold)
        if len(test_probs)
        else ModelMetrics(0, 0, 0, 0, 0, [[0, 0], [0, 0]], threshold)
    )

    version = model_version or datetime.now(UTC).strftime("v%Y%m%d.%H%M%S")
    artifact_dir = resolve_artifact_dir()
    artifact_path = artifact_dir / f"dropout_{version}.joblib"
    bundle = ModelBundle(
        model=final_model,
        preprocessor=final_preprocessor,
        feature_columns=FEATURE_COLUMNS,
        model_name=best_name,
        threshold=threshold,
        top_feature_names=[item["feature"] for item in _top_factors(final_model, feature_names)],
    )
    joblib.dump(bundle, artifact_path)

    metrics_payload = {
        "validation": val_metrics.__dict__,
        "test": test_metrics.__dict__,
        "dataset": {
            "train_rows": len(train_df),
            "val_rows": len(val_df),
            "test_rows": len(test_df),
            "positive_rate_train": float(y_train.mean()),
        },
        "selected_model": best_name,
        "threshold": threshold,
        "validation_candidates": candidate_val_metrics,
    }

    settings = get_settings()
    sync_url = _sync_database_url(database_url or settings.database_url)
    engine = create_engine(sync_url)
    with engine.begin() as connection:
        model_run_id = connection.execute(
            text(
                """
                INSERT INTO ml.model_run
                    (model_name, model_version, status, feature_set, metrics, artifact_uri, trained_at)
                VALUES
                    (:model_name, :model_version, 'completed', :feature_set, :metrics, :artifact_uri, NOW())
                RETURNING id
                """
            ),
            {
                "model_name": MODEL_NAME,
                "model_version": version,
                "feature_set": json.dumps(FEATURE_COLUMNS),
                "metrics": json.dumps(metrics_payload),
                "artifact_uri": str(artifact_path),
            },
        ).scalar_one()

    return TrainResult(
        model_run_id=model_run_id,
        model_version=version,
        selected_model=best_name,
        feature_names=FEATURE_COLUMNS,
        metrics=metrics_payload,
        artifact_path=str(artifact_path),
        threshold=threshold,
    )

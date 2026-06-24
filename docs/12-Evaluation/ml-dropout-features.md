# H25a — Dropout ML feature specification

> Task **H25a** · Sprint 3 · Depends on **T52a** · Feeds **T52c**

## Problem

Binary classification: predict whether a student will **drop out** (`expelled` or `withdrawn`) before completing the program.

**Grain:** one row per student; features are cumulative through the latest semester with enrollment data (`dwh.v_student_dropout_features`).

## Label rules

| `is_dropout` | Condition |
|:-------------|:----------|
| **1 (positive)** | `status IN ('expelled', 'withdrawn')` |
| **0 (negative)** | `status = 'active'` AND `cohort_year <= 2023` |
| **Exclude** | `graduated`; `active` with `cohort_year > 2023` (outcome unknown) |

Train on **`status`**, not `is_active`. `is_active` is for OLTP CRUD only (T52a).

## Feature set (MVP)

Source view: `dwh.v_student_dropout_features` (refreshed by ETL after facts load).

| Feature | Type | Source | Notes |
|:--------|:-----|:-------|:------|
| `cohort_year` | numeric | `dim_cohort.year_start` | Temporal context for split |
| `program_id` | categorical | `dim_student.program_id` | One-hot encoded |
| `total_registered_credits` | numeric | sum `fact_student_semester` | Progress |
| `total_failed_credits` | numeric | sum failed credits | Risk signal |
| `fail_rate` | numeric | failed / registered | Primary risk signal |
| `cumulative_gpa` | numeric | credit-weighted GPA | Academic history |
| `semesters_enrolled` | numeric | count semesters | Duration |
| `avg_semester_gpa` | numeric | mean semester GPA | Trend |

### Forbidden features (leakage / policy)

| Forbidden | Reason |
|:----------|:-------|
| `status` | Label |
| `student_code`, `full_name` | Identifiers |
| `gender` | Sensitive attribute (ML_DWH_Architecture §7) |
| `final_grade` / `is_passed` from current incomplete term | Outcome leakage |
| Post-dropout enrollments | Not applicable at student_latest grain when status is terminal |

## Sampling

- After population filter: ~1,100 negatives, ~120 positives (~10:1 imbalance).
- **No SMOTE** in MVP (small positive class → overfit risk).
- **Class imbalance handling:** `scale_pos_weight = n_negative / n_positive` for XGBoost; `class_weight='balanced'` for Logistic Regression baseline.

## Train / validation / test split

Temporal split by `cohort_year` (no random shuffle across cohorts):

| Split | `cohort_year` |
|:------|:--------------|
| Train | `<= 2021` |
| Validation | `2022` |
| Test | `2023` |

Dropout positives in train/val/test follow their cohort assignment. Active negatives in cohort 2023 form the primary test negatives.

## Preprocessing (`sklearn.compose.ColumnTransformer`)

- **Numeric** (`cohort_year`, credits, fail_rate, GPA fields, `semesters_enrolled`): `SimpleImputer(strategy='median')` → `StandardScaler`
- **Categorical** (`program_id`): `OneHotEncoder(handle_unknown='ignore')`
- Persist preprocessor + model together in a joblib bundle under `backend/ml_artifacts/`.

## Model candidates (T52c)

1. **Baseline:** `LogisticRegression(class_weight='balanced', max_iter=1000)`
2. **Primary:** `XGBClassifier(scale_pos_weight=…, eval_metric='logloss', n_estimators=100, max_depth=4)`

**Selection criterion (validation):** maximize **PR-AUC**, tie-break by **Recall** (prefer catching at-risk students).

**Threshold tuning:** scan 0.1–0.9 on validation; pick threshold maximizing F1, then re-evaluate on test.

**Risk levels** (post-threshold):

| Level | Condition |
|:------|:----------|
| `low` | `p < 0.30` |
| `medium` | `0.30 <= p < 0.60` |
| `high` | `p >= 0.60` |

## Storage

- Training metadata: `ml.model_run` (`model_name='dropout_classifier'`)
- Predictions: `ml.student_dropout_prediction`
- Artifact: `backend/ml_artifacts/dropout_<version>.joblib` (gitignored)

## Evaluation report

Kết quả thí nghiệm (temporal split, 10-fold CV, feature importance): [ml-dropout-baseline.md](./ml-dropout-baseline.md)

## References

- [T52.md](../07-Sprint-Planning/stories/T52.md)
- [ML_DWH_Architecture.md](../10-References/ML_DWH_Architecture.md)
- [ADR-006](../decisions/0006-ml-agent-boundary.md)

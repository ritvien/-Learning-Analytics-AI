# H25b — Dropout ML Experiment Report

> **Task:** H25b · Sprint 3 · Gate G3  
> **Author:** Hoàng · **Date:** 2026-06-24  
> **Feature spec:** [ml-dropout-features.md](./ml-dropout-features.md)  
> **Pipeline tasks:** T52a–d · **Artifact JSON:** `backend/ml_artifacts/cv_eval_report.json`

---

## 1. Tóm tắt điều hành

Chúng tôi xây dựng pipeline dự đoán **dropout toàn chương trình** (grain: 1 student / 1 prediction) trên seed H46 (1.277 sinh viên, 120 nhãn dropout). Ba thí nghiệm chính:

| # | Thí nghiệm | Mục tiêu | Kết luận ngắn |
|:-:|:-----------|:---------|:---------------|
| **E1** | Temporal split (cohort) | Chọn model + threshold cho production | **Logistic Regression**, threshold **0.55** |
| **E2** | 10-fold stratified CV | Độ ổn định metric trên 791 mẫu labeled | LR PR-AUC **0.980 ± 0.041**, Recall **0.983 ± 0.033** |
| **E3** | Feature importance | Feature nào ảnh hưởng target | **`avg_semester_gpa`**, **`total_failed_credits`** (permutation) |

Model production (`model_run_id = 1`) đã score **1.157** sinh viên active; phân bố risk: 966 low / 134 medium / 57 high.

**Cảnh báo:** Metric rất cao trên seed tổng hợp — phù hợp demo G3, cần theo dõi drift khi triển khai thật.

---

## 2. Bối cảnh và phạm vi

### 2.1 Bài toán

- **Target:** `is_dropout = 1` nếu `status IN ('expelled', 'withdrawn')`.
- **Negative:** `status = 'active'` và `cohort_year <= 2023`.
- **Loại trừ:** `graduated`; active cohort > 2023 (outcome chưa biết).
- **Grain:** Features tích lũy đến học kỳ mới nhất (`dwh.v_student_dropout_features`).

### 2.2 Stack

| Thành phần | Công nghệ |
|:-----------|:----------|
| Data | PostgreSQL `public` + `dwh` (ETL) |
| Training | scikit-learn + XGBoost |
| Storage | `ml.model_run`, `ml.student_dropout_prediction` |
| Artifact | `backend/ml_artifacts/dropout_<version>.joblib` |
| Serving | `GET /predictions/students/{id}/dropout-risk`, agent tool `get_student_dropout_risk` |

### 2.3 Ranh giới ADR-006

LLM/agent **chỉ explain** prediction từ schema `ml` — không tự sinh xác suất dropout.

---

## 3. Nhật ký thí nghiệm (chronological)

| Thời điểm | Hoạt động | Kết quả |
|:----------|:----------|:--------|
| 2026-06-24 | Bootstrap Docker + `alembic upgrade head` | Migration `a3b4c5d6e7f8` (view + prediction table) |
| 2026-06-24 | Import `seed-academic-v2.json.gz` | 1.277 SV, 56.301 enrollments, acceptance **passed** |
| 2026-06-24 | ETL `app.analytics.etl` | Run #2, DQ reconciliation **passed** |
| 2026-06-24 | Verify labels | expelled 87 + withdrawn 33 = **120**; `is_active` khớp `status` |
| 2026-06-24 | **E1** Train temporal split | `model_run_id=1`, LR selected, threshold 0.55 |
| 2026-06-24 | Score active students | 1.157 predictions; fix NaN trong `top_factors` |
| 2026-06-24 | **E2** 10-fold CV | `app.ml.dropout.evaluate` |
| 2026-06-24 | **E3** Feature importance | Permutation + native importance |

### 3.1 Sự cố hạ tầng đã xử lý

| Vấn đề | Nguyên nhân | Fix |
|:-------|:------------|:----|
| `PermissionError: /app/ml_artifacts` | Container chạy user `app`, volume root-owned | Bind mount `./backend/ml_artifacts`, `ML_ARTIFACT_DIR=/tmp/ml_artifacts` |
| JSON `NaN` trong `top_factors` | `cumulative_gpa` null khi score | `_safe_factor_value()` bỏ NaN trước khi ghi DB |

---

## 4. Dữ liệu

### 4.1 OLTP sau import

| `status` | `is_active` | Count |
|:---------|:------------|------:|
| active | true | 1.157 |
| expelled | false | 87 |
| withdrawn | false | 33 |
| **Tổng** | | **1.277** |

Không có `graduated` trong snapshot này.

### 4.2 Population ML (labeled)

| Nhóm | Điều kiện | Count |
|:-----|:----------|------:|
| Positive | expelled + withdrawn | 120 |
| Negative (eligible) | active, cohort ≤ 2023 | 671 |
| Excluded | active cohort > 2023 | 486 |
| **Labeled total (E2/E3)** | | **791** |

Positive rate labeled: **15.2%**.

### 4.3 Feature view

- Nguồn: `dwh.v_student_dropout_features` — **1.277** rows.
- 1.053 SV có `fail_rate > 0`; 3 SV không có semester enrollment (GPA null → impute median).

### 4.4 Feature set (8 cột MVP)

`cohort_year`, `program_id`, `total_registered_credits`, `total_failed_credits`, `fail_rate`, `cumulative_gpa`, `semesters_enrolled`, `avg_semester_gpa`.

**Forbidden:** `status`, identifiers, `gender`, điểm cuối kỳ chưa kết thúc.

---

## 5. Thí nghiệm E1 — Temporal split (production model)

### 5.1 Thiết kế

| Tham số | Giá trị |
|:--------|:--------|
| Split | Train cohort ≤ 2021 · Val 2022 · Test 2023 |
| Candidates | LogisticRegression (`class_weight='balanced'`) vs XGBClassifier (`scale_pos_weight`) |
| Selection | Max validation **PR-AUC**, tie-break **Recall** |
| Threshold | Scan 0.1–0.9 (step 0.05) trên val, maximize **F1** → **0.55** |
| Retrain | Train + val → evaluate test |

### 5.2 Kích thước split

| Split | Rows | Ghi chú |
|:------|-----:|:--------|
| Train | 169 | 29.0% positive trong split |
| Validation | 263 | Threshold tuning |
| Test | 341 | Hold-out cohort 2023 |

### 5.3 So sánh model (validation, threshold = 0.5)

| Model | Precision | Recall | F1 | PR-AUC | ROC-AUC |
|:------|----------:|-------:|---:|-------:|--------:|
| **Logistic Regression** | 0.906 | 1.000 | 0.951 | **0.998** | **1.000** |
| XGBoost | 0.853 | 1.000 | 0.921 | 0.871 | 0.989 |

**→ Chọn Logistic Regression.**

### 5.4 Model đã chọn — validation (threshold = 0.55)

| Metric | Value |
|:-------|------:|
| Precision | 0.967 |
| Recall | 1.000 |
| F1 | 0.983 |
| PR-AUC | 0.998 |
| ROC-AUC | 1.000 |

```text
Confusion matrix (validation):
              Predicted 0    Predicted 1
Actual 0         233             1
Actual 1           0            29
```

### 5.5 Model đã chọn — test holdout (threshold = 0.55)

| Metric | Value |
|:-------|------:|
| Precision | 0.889 |
| Recall | 1.000 |
| F1 | 0.941 |
| PR-AUC | 0.997 |
| ROC-AUC | 1.000 |

```text
Confusion matrix (test):
              Predicted 0    Predicted 1
Actual 0         314             3
Actual 1           0            24
```

### 5.6 Production artifact

| Field | Value |
|:------|:------|
| `model_run_id` | 1 |
| `model_version` | `v20260624.093920` |
| Artifact path | `backend/ml_artifacts/dropout_v20260624.093920.joblib` |

### 5.7 Phân bố risk sau score (1.157 active)

| Risk level | Count | Rule |
|:-----------|------:|:-----|
| low | 966 | p < 0.30 |
| medium | 134 | 0.30 ≤ p < 0.60 |
| high | 57 | p ≥ 0.60 |

---

## 6. Thí nghiệm E2 — 10-fold stratified cross-validation

### 6.1 Thiết kế

| Tham số | Giá trị |
|:--------|:--------|
| Method | `StratifiedKFold(n_splits=10, shuffle=True, random_state=42)` |
| Population | 791 labeled rows (120 pos / 671 neg) |
| Threshold | 0.5 (default classifier) mỗi fold |
| Metrics | Precision, Recall, F1, PR-AUC, ROC-AUC |
| Code | `app/ml/dropout/evaluate.py` → `cross_validate_dropout()` |

**Lưu ý phương pháp:** CV **bổ sung** E1 — không thay temporal split khi deploy (tránh leakage thời gian trong production). CV đo **độ ổn định** khi shuffle cohort trong population đã labeled.

### 6.2 Tổng hợp (mean ± std)

| Model | Precision | Recall | F1 | PR-AUC | ROC-AUC |
|:------|----------:|-------:|---:|-------:|--------:|
| **Logistic Regression** | 0.950 ± 0.069 | **0.983 ± 0.033** | 0.965 ± 0.040 | **0.980 ± 0.041** | **0.998 ± 0.005** |
| XGBoost | 0.928 ± 0.082 | 0.950 ± 0.055 | 0.936 ± 0.046 | 0.952 ± 0.071 | 0.993 ± 0.008 |

### 6.3 Chi tiết từng fold — Logistic Regression

| Fold | Precision | Recall | F1 | PR-AUC | ROC-AUC |
|:----:|----------:|-------:|---:|-------:|--------:|
| 1 | 0.800 | 1.000 | 0.889 | 1.000 | 1.000 |
| 2 | 0.917 | 0.917 | 0.917 | 0.909 | 0.989 |
| 3 | 0.857 | 1.000 | 0.923 | 0.888 | 0.988 |
| 4 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| 5 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| 6 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| 7 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| 8 | 0.923 | 1.000 | 0.960 | 1.000 | 1.000 |
| 9 | 1.000 | 0.917 | 0.957 | 1.000 | 1.000 |
| 10 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |

Fold yếu nhất LR: fold 1 (precision 0.80, PR-AUC 1.0) và fold 2–3 (PR-AUC ~0.89).

### 6.4 Chi tiết từng fold — XGBoost

| Fold | Precision | Recall | F1 | PR-AUC | ROC-AUC |
|:----:|----------:|-------:|---:|-------:|--------:|
| 1 | 0.800 | 1.000 | 0.889 | 0.961 | 0.993 |
| 2 | 0.917 | 0.917 | 0.917 | 0.888 | 0.988 |
| 3 | 0.857 | 1.000 | 0.923 | **0.764** | 0.973 |
| 4 | 0.786 | 0.917 | 0.846 | 0.969 | 0.993 |
| 5 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| 6 | 1.000 | 0.833 | 0.909 | 0.962 | 0.990 |
| 7 | 1.000 | 0.917 | 0.957 | 0.976 | 0.994 |
| 8 | 0.923 | 1.000 | 0.960 | 1.000 | 1.000 |
| 9 | 1.000 | 0.917 | 0.957 | 1.000 | 1.000 |
| 10 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |

XGBoost biến động hơn (fold 3 PR-AUC 0.764; recall drop ở fold 6, 7, 9).

---

## 7. Thí nghiệm E3 — Feature importance

### 7.1 Thiết kế

| Phương pháp | Mô tả | Ưu tiên giải thích |
|:------------|:------|:-------------------|
| **Permutation importance** | Hoán vị từng feature → đo giảm PR-AUC (`n_repeats=10`) | **Cao** |
| **Native importance** | \|LR coefficient\| hoặc XGB gain, gom về 8 feature gốc | Tham chiếu |

Population: 791 labeled · Code: `compute_feature_importance()`.

### 7.2 Permutation importance (ảnh hưởng thực tế tới target)

| Feature | LR | XGBoost |
|:--------|---:|--------:|
| `avg_semester_gpa` | **0.404** | 0.140 |
| `total_failed_credits` | **0.360** | **0.814** |
| `cohort_year` | 0.139 | 0.023 |
| `cumulative_gpa` | 0.061 | 0.002 |
| `semesters_enrolled` | 0.016 | 0.003 |
| `total_registered_credits` | 0.010 | 0.001 |
| `program_id` | 0.009 | 0.017 |
| `fail_rate` | 0.002 | 0.000 |

### 7.3 Native model importance

| Feature | LR (|coef|) | XGBoost (gain) |
|:--------|------------:|---------------:|
| `program_id` | **0.301** | 0.093 |
| `semesters_enrolled` | 0.190 | **0.609** |
| `total_registered_credits` | 0.175 | 0.029 |
| `cohort_year` | 0.148 | 0.010 |
| `fail_rate` | 0.100 | 0.022 |
| `cumulative_gpa` | 0.053 | 0.009 |
| `avg_semester_gpa` | 0.027 | 0.215 |
| `total_failed_credits` | 0.008 | 0.014 |

### 7.4 Diễn giải

1. **Permutation vs native khác nhau** — LR native nhấn `program_id` (one-hot nhiều chiều) nhưng permutation cho thấy **GPA và tín chỉ trượt** mới là driver dự đoán dropout.
2. **`fail_rate` gần như redundant** khi đã có `total_failed_credits` và `avg_semester_gpa`.
3. **XGBoost** nhạy mạnh với `total_failed_credits` (permutation 81%); LR cân bằng hơn giữa GPA và failed credits.
4. **`cohort_year`** — context phụ, không phải tín hiệu học thuật chính.

**Top-3 khuyến nghị cho narrative agent/UI:**

1. `avg_semester_gpa`
2. `total_failed_credits`
3. `cohort_year` (bối cảnh)

---

## 8. So sánh với baseline rule-based

| Tiêu chí | DWH heuristic (V20 fallback) | ML pipeline |
|:---------|:----------------------------|:------------|
| Tín hiệu | `gpa_cumulative < 2.0`, fail cao | 8 features DWH + probability |
| Output | At-risk count / badge | `dropout_probability` + risk band |
| Giải thích | Rule cố định | `top_factors` + agent tool |
| Calibration | Không | Có threshold tuning |

---

## 9. Kết luận và khuyến nghị

### 9.1 Kết luận

- Pipeline T52a–d **hoàn tất** trên Docker + PostgreSQL; model production là **Logistic Regression**.
- **E1 (temporal):** Test PR-AUC **0.997**, Recall **1.0** — đủ cho demo G3/V20.
- **E2 (10-fold CV):** LR ổn định hơn XGB (PR-AUC 0.980 ± 0.041 vs 0.952 ± 0.071).
- **E3 (importance):** Dropout gắn với **thành tích học tập tích lũy** (GPA HK, tín chỉ trượt), không phải `fail_rate` đơn lẻ.

### 9.2 Khuyến nghị

| Ưu tiên | Hành động |
|:--------|:----------|
| Demo G3 | Dùng `model_run_id=1`; API + agent tool đã sẵn sàng |
| Slide/video | Ghi rõ metric cao trên seed; nhấn Recall + feature story |
| Sprint sau | Theo dõi metric theo cohort mới; cân nhắc bỏ `fail_rate` khỏi feature set |
| Ops | Retrain thủ công qua `/admin/ml/train` + `/admin/ml/score-dropout` |

### 9.3 Hạn chế

- Một trường, ~120 positive labels, không external validation.
- CV shuffle cohort — optimistic hơn strict temporal forecast.
- Không auto-retrain; artifact local bind mount.

---

## 10. Tái lập thí nghiệm

```powershell
# Hạ tầng
docker compose up -d --build
docker compose exec backend alembic upgrade head

# Data
cd backend
python scripts/import_academic_dataset.py `
  --artifact db/seed-academic-v2.json.gz --apply --expected-students 1277 `
  --database-url postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight
docker compose exec backend python -m app.analytics.etl

# E1 — train + score
docker compose exec backend python -c "from app.ml.dropout.train import train_dropout_model; print(train_dropout_model())"
docker compose exec backend python -c "from app.ml.dropout.score import score_dropout_predictions; print(score_dropout_predictions(1))"

# E2 + E3 — CV + feature importance
docker compose exec backend python -m app.ml.dropout.evaluate > ml_artifacts/cv_eval_report.json
```

### Truy vấn kiểm tra

```sql
-- Labels
SELECT status, COUNT(*) FROM students GROUP BY status;

-- Model metrics
SELECT id, model_version, metrics FROM ml.model_run WHERE model_name = 'dropout_classifier';

-- Scoring distribution
SELECT risk_level, COUNT(*) FROM ml.student_dropout_prediction GROUP BY risk_level;
```

---

## 11. Acceptance checklist (H25b / G3)

- [x] Test set PR-AUC reported (0.997)
- [x] 10-fold stratified CV documented (LR PR-AUC 0.980 ± 0.041)
- [x] Per-fold metrics archived
- [x] Feature importance — permutation + native
- [x] Recall prioritized and reported (1.0 val/test temporal; 0.983 CV mean)
- [x] No forbidden features in `feature_set`
- [x] Agent reads `ml` only (ADR-006)
- [x] Raw JSON artifact: `backend/ml_artifacts/cv_eval_report.json`

---

## Phụ lục A — File liên quan

| File | Vai trò |
|:-----|:--------|
| `app/ml/dropout/train.py` | E1 training |
| `app/ml/dropout/evaluate.py` | E2 + E3 |
| `app/ml/dropout/score.py` | Batch scoring |
| `app/analytics/etl.py` | DWH + feature view refresh |
| `migrations/a3b4c5d6e7f8_*.py` | View + prediction table |
| `tests/test_dropout_*.py` | Unit + API tests |

## Phụ lục B — Tham chiếu

- [T52.md](../07-Sprint-Planning/stories/T52.md)
- [ML_DWH_Architecture.md](../10-References/ML_DWH_Architecture.md)
- [ADR-006](../decisions/0006-ml-agent-boundary.md)

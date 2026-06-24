# Sprint 3 — Gate G3 & scope pivot

> **21/06 – 28/06/2026** · Cập nhật **24/06/2026**  
> **Goal:** Đóng Gate G3 trước **25/06 23:59**; sau đó ML dropout + polish Demo 2.  
> **Tham chiếu:** [Sprint2.md](./Sprint2.md) · [H46-Implementation.md](./H46-Implementation.md) · [gate3_eval_metrics.md](../12-Evaluation/gate3_eval_metrics.md)

**Pivot 24/06:** Ưu tiên **ML dropout** (T52), **error handling** (H52), **FE RBAC** (V41). `H49–H51`, `T49` → Sprint 4.

**Dữ liệu ML:** Nhãn dropout trong git — `backend/db/seed-academic-v2.json.gz` (`expelled` 87 + `withdrawn` 33). Hưng `git pull` + seed/import + ETL; **không cần** file crawl trên máy Hoàng.

**URL demo:** Ngrok + `/api/v1` proxy **ổn định** (G3-1 ✅).

---

## Gate G3 — Deadline 25/06/2026 23:59

| # | Deliverable | Trạng thái | Owner | Task |
|:-:|:------------|:----------:|:-----|:-----|
| G3-1 | Public URL | [x] | Hưng + Hiếu | Ngrok smoke: login, dashboard, tree, chat |
| G3-2 | Eval metrics (≥3 baseline) | [x] | Hoàng | [gate3_eval_metrics.md](../12-Evaluation/gate3_eval_metrics.md) |
| G3-3 | Guardrails | [ ] | Hoàng + Hiếu | Xem bảng G3-3 bên dưới |
| G3-4 | Demo video draft 3–5 phút | [ ] | Hiếu + Hoàng | V34 + H44 + **V35** — nộp **25/06** |
| G3-5 | Cost report | [x] | Hoàng | [gate3_cost_report.md](../12-Evaluation/gate3_cost_report.md) |

### G3-3 Guardrails — tiến độ

| Hạng mục | Task | Owner | Trạng thái |
|:---------|:-----|:------|:----------:|
| RBAC API, tool scope, timeout contract | **T40** | Hưng | [x] |
| Structured logs, trace ID | **T41** | Hưng | [x] |
| RBAC UI (nav, route, CRUD) | **V41** | Hiếu | [ ] |
| Error handling 3 tầng + HTTP layer | **H52** | Hoàng | [ ] |
| Prompt scope + injection | **H40** | Hoàng | [ ] |
| LLM chỉ explain `ml`, không generate probability | **T52d** + ADR-006 | Hưng + Hoàng | [ ] |

**G3-3 done khi:** evidence link trong `docs/12-Evaluation/`; RBAC live (V41); H52 pytest pass; 1 scene guardrail chat trên video.

### G3-4 — Kịch bản quay (V35, deadline 25/06)

Slide (V34): metric + cost từ file G3 đã có · pitch ngắn.

Live trên Ngrok (~3 phút): login → tree → dropout risk (V20 nếu kịp, else DWH at-risk) → đổi role (V41) → câu ngoài scope (H40).

Script: **H44** (draft 24/06, chốt sáng 25/06). **V37** (chỉnh video) có thể 26–27/06 — không thuộc Gate.

---

## Lịch 24–25/06 (trước deadline Gate)

| Ngày | Hưng | Hoàng | Hiếu |
|:-----|:-----|:------|:-----|
| **24/06** | T52a → T52b | H52 + H25a + H44 draft | V41 + V34 draft |
| **25/06** | T52c → T52d | H52 tests + H40 + H44 finalize | V41 + V20* + **V35 quay** + V34 finalize |

\* V20: dùng T52d API; nếu chưa kịp → quay fallback DWH at-risk, không trễ G3-4.

**Checkpoint 25/06 18:00:** T52d API smoke · V41 pass · slide+script duyệt · sẵn sàng quay.

---

## Hưng — Backend / ML

### Đã xong (không làm lại)

T50, T51, T42, T43, T41, **T40**, T45, T46, T48, H46 (artifact 1.277 SV).

### Còn làm — tuần tự

| Task | Việc | Done |
|:-----|:-----|:-----|
| **T52a** | `STATUS_MAP`, `is_active` cho expelled/withdrawn; verify ~120 dropout trong DB | SQL + pytest import |
| **T52b** | DWH feature view (GPA, fail rate, cohort, credits owed) | Query 1 dropout + 1 active |
| **T52c** | Train classifier → `ml.model_run`; `/admin/ml/train` | Metric file; H25a OK |
| **T52d** | API `.../dropout-risk` + RBAC; agent đọc `ml` | API 200 trên Ngrok |

**Bootstrap DB** (nếu chưa có 1.277 SV):

```powershell
git pull origin main
docker compose up -d
cd backend && alembic upgrade head
python scripts/import_academic_dataset.py --artifact db/seed-academic-v2.json.gz --apply --expected-students 1277 --database-url postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight
docker compose exec backend python -m app.analytics.etl
```

```sql
SELECT status, COUNT(*) FROM students GROUP BY status;
```

**Verify:** `cd backend && ruff check . && pytest -v`  
**Không sửa:** agent graph (H52), frontend (V41/V20).

---

## Hoàng — AI / Evaluation

### Đã xong

H45, T44, H46, H42, H43, H48.

### Còn làm

| Task | Việc | Done | Deadline |
|:-----|:-----|:-----|:---------|
| **H52** | Error handling 3 tầng — ref `docs/4.9-error-handling.md` | ≥3 pytest; agent không crash | 25/06 |
| **H25a** | `ml-dropout-features.md` — feature, label, anti-leakage | Hưng sign-off trước T52c | 25/06 |
| **H25b** | `ml-dropout-baseline.md` — P/R/F1/PR-AUC | Sau T52d | 26/06* |
| **H44** | Script demo cho Hiếu | Draft 24/06 | 25/06 |
| **H40** | Prompt scope + injection (G3-3) | Evidence link | 25/06 |

\* H25b sau Gate — không block G3.

**Verify:** `cd backend && pytest -v`  
**Không sửa:** `import_academic_dataset.py`, train pipeline (T52c), FE (V41).

---

## Hiếu — Frontend / QA

### Đã xong

V36, V38, V39, V40.

### Còn làm

| Task | Việc | Done | Deadline |
|:-----|:-----|:-----|:---------|
| **V41** | Route guard, nav/CRUD theo 5 role, `/forbidden` | Playwright ≥3 role | 25/06 |
| **V34** | Slide pitch + metric/cost | 8–10 slide | 25/06 |
| **V35** | Quay video 3–5 phút | File nộp G3-4 | **25/06** |
| **V20** | Dropout badge + probability (T52d) | UI trên student/analytics | 25/06* |
| **V37** | Chỉnh video sau review | Asset pack | 26–27/06 |

\* Fallback nếu T52 chậm: bỏ dropout UI, giữ tree + RBAC + guardrail.

**Verify:** `cd frontend && npm run lint && npm test`  
**Phụ thuộc:** V20 ← T52d · V35 ← V34 + H44 + V41.

---

## Phụ thuộc chính

`T52a → T52b → T52c → T52d → V20` · `T52a → H25a → T52c` · `T40 ✅ + V41 → G3-3` · `H52 + H40 → G3-3` · `V34 + H44 → V35`

---

## Sprint 4 (không block Gate)

`H49`, `H50`, `H51`, `T49`, `H30`, `V18`, `V19`, `V21`, `V22`, `V23`

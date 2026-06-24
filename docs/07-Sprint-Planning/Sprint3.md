# Sprint 3 — Gate G3 & scope pivot

> **21/06 – 28/06/2026** · Cập nhật **24/06/2026**  
> **Goal:** Đóng Gate G3 trước **25/06 23:59**; sau đó ML eval + polish Demo 2.  
> **Tham chiếu:** [Sprint2.md](./Sprint2.md) · [H46-Implementation.md](./H46-Implementation.md) · [gate3_eval_metrics.md](../12-Evaluation/gate3_eval_metrics.md)

**Pivot 24/06:** Ưu tiên **ML dropout** (T52), **error handling** (H52), **FE RBAC** (V41). `H49–H51`, `T49` → Sprint 4.

**Dữ liệu ML:** Nhãn trong `backend/db/seed-academic-v2.json.gz` (`expelled` 87 + `withdrawn` 33). Hưng `git pull` + seed + ETL — không cần crawl trên máy Hoàng.

**URL demo:** Ngrok + `/api/v1` proxy **ổn định** (G3-1 ✅).

---

## Gate G3 — Deadline 25/06/2026 23:59

| # | Deliverable | Định nghĩa done | Owner | Deadline | Status |
|:-:|:------------|:----------------|:------|:--------:|:------:|
| G3-1 | Public URL | Ngrok; login/dashboard/tree/chat smoke pass | Hưng + Hiếu | — | [x] |
| G3-2 | Eval metrics | ≥3 baseline: latency, tool success, answer quality | Hoàng | 25/06 | [x] |
| G3-3 | Guardrails | Evidence AI + backend (bảng dưới) | Hoàng + Hiếu | 25/06 | [ ] |
| G3-4 | Demo video draft | Slide + live demo 3–5 phút trên Ngrok | Hiếu + Hoàng | **25/06** | [ ] |
| G3-5 | Cost report | Cost/user/month + assumption | Hoàng | 25/06 | [x] |

### G3-3 Guardrails

| Hạng mục | Task | Owner | Status |
|:---------|:-----|:------|:------:|
| RBAC API, tool scope, timeout | **T40** | Hưng | [x] |
| Structured logs, trace ID | **T41** | Hưng | [x] |
| RBAC UI — nav, route, CRUD | **V41** | Hiếu | [ ] |
| Error handling 3 tầng + HTTP | **H52** | Hoàng | [ ] |
| Prompt scope + injection | **H40** | Hoàng | [ ] |
| LLM chỉ explain `ml` (ADR-006) | **T52d** | Hưng | [ ] |

### G3-4 — Kịch bản quay (V35, nộp 25/06)

**Slide (V34):** metric + cost từ `gate3_eval_metrics.md`, `gate3_cost_report.md`.

**Live (~3 phút):** login → tree → dropout risk (V20 hoặc fallback DWH) → đổi role (V41) → câu ngoài scope (H40).

**Script:** H44 (draft 24/06, chốt 25/06). **V37** chỉnh video 26–27/06 — ngoài Gate.

---

## Lịch 24–25/06

| Ngày | Hưng | Hoàng | Hiếu |
|:-----|:-----|:------|:-----|
| **24/06** | T52a → T52b | H52 + H25a + H44 draft | V41 + V34 draft |
| **25/06** | T52c → T52d | H52 + H40 + H44 finalize | V41 + V20* + V35 quay + V34 finalize |

\* V20 fallback: DWH at-risk nếu T52d chưa kịp — không trễ G3-4.

**Checkpoint 25/06 18:00:** T52d API smoke · V41 · slide+script duyệt.

---

## Task theo thành viên

### Hoàng — AI / Evaluation

| Task | Mô tả | Khung | P | Depends | Status |
|:-----|:------|:-----|:-:|:--------|:------:|
| H45 | Architecture 3-tier Khoa → Ngành → Chuyên ngành | 21–22/06 | P0 | — | [x] |
| T44 | Tree API + migration 3-tier | 21–22/06 | P0 | H45 | [x] |
| H46 | Seed 1.277 SV thực; artifact `seed-academic-v2.json.gz` | 21–25/06 | P0 | H45, T44 | [x] |
| H42 | Evaluation metrics framework + baseline G3 | 21–22/06 | P1 | H46 | [x] |
| H43 | Cost report G3-5 | 22/06 | P1 | H42 | [x] |
| H48 | Universal chatbot core; `route_decision` inline/full_chat | 23–24/06 | P0 | T41, T42, T43 | [x] |
| **H52** | Error handling 3 tầng — ref `docs/4.9-error-handling.md`; tool/node/graph + HTTP | 24–25/06 | **P0** | H48 | [ ] |
| **H25a** | Feature spec + label rule + anti-leakage (`ml-dropout-features.md`) | 24–25/06 | **P0** | T52a | [ ] |
| **H25b** | ML eval report P/R/F1/PR-AUC (`ml-dropout-baseline.md`) | 26/06 | P1 | T52d | [ ] |
| H44 | Demo video script / narrative cho Hiếu | 24–25/06 | P1 | — | [ ] |
| H40 | Guardrails prompt — scope + injection (G3-3) | 25/06 | P1 | H52 | [ ] |
| H49 | Cross-module data access chatbot | — | P2 | H48 | [ ] S4 |
| H50 | Expanded agent tool registry | — | P2 | H49 | [ ] S4 |
| H51 | RAG retrieval integration | — | P2 | H48, T49 | [ ] S4 |
| H30 | Agent safety eval mở rộng | 28/06 | P2 | H52 | [ ] |

**Verify:** `cd backend && pytest -v` · **Không sửa:** `import_academic_dataset.py` (T52a), train (T52c), FE (V41).

---

### Hưng — Backend / DevOps / ML

| Task | Mô tả | Khung | P | Depends | Status |
|:-----|:------|:-----|:-:|:--------|:------:|
| T50 | Schema `ml` + prediction tables; verify migration | 21–22/06 | P0 | T26 | [x] |
| T51 | Fix reload / deep-link authenticated routes | 21/06 | P0 | — | [x] |
| T42 | DWH + ETL foundation; DQ check | 21–22/06 | P0 | T44 | [x] |
| T43 | Analytics/report API + RBAC contract | 21–22/06 | P0 | T42 | [x] |
| T41 | Observability — session, trace, event log | 21–22/06 | P0 | — | [x] |
| T40 | Guardrails backend + RBAC API (G3-3) | 25/06 | P1 | T41, T43 | [x] |
| T45 | Deploy runbook — Ngrok, restart, health check | 25/06 | P2 | — | [x] |
| T46 | Integration defect fix (từ V39) | 25/06 | P1 | T40, V39 | [x] |
| T48 | Release candidate verification | 25/06 | P1 | T45, T46, V39 | [x] |
| **T52a** | Dropout labels — `STATUS_MAP`, `is_active`, verify ~120 SV | 24/06 | **P0** | H46, T50 | [ ] |
| **T52b** | DWH feature view cho ML (GPA, fail rate, cohort…) | 24–25/06 | **P0** | T52a | [ ] |
| **T52c** | Train classifier → `ml.model_run`; `/admin/ml/train` | 25/06 | **P0** | T52b, H25a | [ ] |
| **T52d** | API dropout-risk + RBAC; agent tool đọc `ml` | 25/06 | **P0** | T52c | [ ] |
| T49 | RAG corpus preparation | — | P2 | — | [ ] S4 |

**Bootstrap DB** (nếu chưa có 1.277 SV):

```powershell
git pull origin main && docker compose up -d
cd backend && alembic upgrade head
python scripts/import_academic_dataset.py --artifact db/seed-academic-v2.json.gz --apply --expected-students 1277 --database-url postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight
docker compose exec backend python -m app.analytics.etl
```

**Verify:** `ruff check . && pytest -v` · SQL: `SELECT status, COUNT(*) FROM students GROUP BY status;`  
**Không sửa:** agent graph (H52), frontend (V41/V20).

---

### Hiếu — Frontend / QA

| Task | Mô tả | Khung | P | Depends | Status |
|:-----|:------|:-----|:-:|:--------|:------:|
| V36 | Academic Tree 5 tầng Trường → Khoa → Ngành → CN → Môn | 21–22/06 | P0 | T44 | [x] |
| V38 | Chat thinking status stack — collapsed + timeline | 21–22/06 | P1 | — | [x] |
| V39 | Playwright E2E — auth, tree, report, chat, responsive | 22–24/06 | P0 | V36, V38, T51 | [x] |
| V40 | Global chat shell + route handoff `/chatbot` | 23–24/06 | P0 | H48, T41 | [x] |
| **V41** | FE RBAC — route guard, nav/CRUD theo role, `/forbidden` | 24–25/06 | **P0** | T40 | [ ] |
| **V20** | Dropout risk UI — badge + probability (T52d API) | 25/06 | P1 | T52d | [ ] |
| V34 | Demo slides — pitch + metric/cost | 24–25/06 | P1 | V39 | [ ] |
| V35 | Demo video recording 3–5 phút (G3-4) | **25/06** | P1 | V34, H44, V41 | [ ] |
| V37 | Final QA + chỉnh video | 26–27/06 | P1 | V35 | [ ] |
| V18 + V21 | CRUD polish + responsive/dark | — | P2 | — | [ ] S4 |
| V19, V22, V23 | Chart, FE unit tests, credit prediction UI | — | P2 | — | [ ] S4 |

**Verify:** `cd frontend && npm run lint && npm test` · Playwright sau V41.  
**Phụ thuộc:** V20 ← T52d · V35 ← V34 + H44 + V41.

---

## Phụ thuộc chính

`T52a → T52b → T52c → T52d → V20` · `T52a → H25a → T52c` · `T40 ✅ + V41 → G3-3` · `H52 + H40 → G3-3` · `V34 + H44 → V35`

## Sprint 4 (không block Gate)

`H49`, `H50`, `H51`, `T49`, `H30`, `V18`, `V19`, `V21`, `V22`, `V23`

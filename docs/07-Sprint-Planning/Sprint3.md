# Sprint 3 — Sẵn sàng triển khai & Gate G3

> **Thời gian:** 21/06 – 28/06/2026
> **Sprint Goal:** _Hoàn thành Gate G3 (metrics ✅, cost ✅, URL ✅) — tập trung **ML dropout**, **error handling**, **FE RBAC**, rồi quay demo video **26/06**._
> **Tham chiếu:** [Sprint2.md](./Sprint2.md) · [SprintPlanning.md](./SprintPlanning.md) · [gate2_eval_report.md](../12-Evaluation/gate2_eval_report.md)
> **Cập nhật lần cuối:** 24/06/2026

> [!IMPORTANT]
> **Scope pivot 24/06:** Ưu tiên trước khi quay video — **ML dropout** (T52), **error handling** (H52), **FE RBAC** (V41). Chatbot `H49–H51` và RAG `T49` lùi Sprint 4.

> [!NOTE]
> **Dữ liệu dropout:** Không cần file crawl trên máy Hoàng. Nhãn đã nằm trong artifact git `backend/db/seed-academic-v2.json.gz` (`expelled` 87 + `withdrawn` 33 = **120 SV**). Sau `git pull`, Hưng seed/import + ETL là đủ để train ML.

> [!NOTE]
> **Production URL:** Ngrok + Next.js proxy `/api/v1` **đã ổn định** (G3-1 ✅). `Vercel`/`Railway`/`Cloud Run` chỉ là fallback.

---

## Gate G3 — Mục tiêu và Deliverables

> **Deadline tuyệt đối:** 25/06/2026 23:59

### Checklist Deliverable Gate G3

- [x] G3-1: Có public URL dùng chung; frontend và backend qua `/api/v1` proxy đều smoke test pass
- [x] G3-2: Có ít nhất 3 evaluation metrics với baseline số
- [ ] G3-3: Có evidence guardrails phía AI và backend
- [ ] G3-4: Có demo video draft 3-5 phút
- [x] G3-5: Có cost report rõ assumption và công thức tính

| # | Deliverable | Định nghĩa done | Owner chính | Deadline nội bộ | Trạng thái |
|:-:|:------------|:----------------|:-----------:|:---------------:|:----------:|
| G3-1 | Public production URL | Ngrok ổn định; login/dashboard/tree/chat smoke pass | Hưng + Hiếu | — | [x] |
| G3-2 | Evaluation metrics | ≥ 3 metric baseline: latency p95, tool success, answer quality (+ cost/query) | Hoàng | 24/06 | [x] |
| G3-3 | Guardrails | Evidence AI + backend: scope, RBAC, error handling, structured log | Hoàng + Hưng | 25/06 | [ ] |
| G3-4 | Demo video draft | Slide pitch + live demo 3–5 phút trên Ngrok | Hiếu | **26/06** | [ ] |
| G3-5 | Cost report | Cost/user/month, assumption + công thức | Hoàng | 25/06 | [x] |

### Gate G3 — Live demo tối thiểu (trước khi quay V35)

| Scene | Task | Bắt buộc |
|:------|:-----|:--------:|
| Login + dashboard + tree | G3-1 ✅ | ✅ |
| Dropout risk (probability + badge) | T52d + V20 | ✅ |
| Chat giải thích risk (đọc `ml`, không hallucinate) | T52d + H52 | Khuyến khích |
| RBAC — đổi role, nav/action khác | V41 | ✅ |
| Guardrail — câu ngoài scope | H40/H52 | Khuyến khích |
| Metrics + cost | Slide từ `gate3_eval_metrics.md`, `gate3_cost_report.md` | Slide only |
| Error handling 3 tầng | H52 evidence + slide | Không cần live |

---

## Nguyên tắc tổ chức Sprint 3

1. Mỗi thành viên có **một chuỗi task tuần tự riêng**, không đụng nhau về dependency chính.
2. Không bắt buộc mỗi ngày chỉ có 1 task; có thể gom thành **batch task** nếu cùng loại việc và không tạo conflict.
3. Từ `21/06` đến hết `25/06`, ưu tiên tuyệt đối cho deliverables Gate G3.
4. Các task **P0/P1 còn dang dở từ Sprint 2** sẽ được **kéo lên sớm** nếu chúng là enabler hoặc không làm block Gate G3.
5. Chỉ những task không cấp bách hoặc phụ thuộc sâu mới lùi về `26/06` – `28/06`.
6. Nếu task bị kẹt hơn 4 giờ, chuyển sang phương án fallback hoặc hạ scope để không chặn deliverable của người khác.

---

## Phạm vi Sprint 3

### Trong phạm vi (24/06 → quay video)

- ML dropout: nhãn từ crawl → train → API → UI (`T52a–d`, `H25a/b`, `V20`)
- Error handling agent 3 tầng (`H52`, ref `docs/4.9-error-handling.md`)
- FE phân quyền wire backend RBAC (`V41`)
- Demo assets: slide draft sớm (`V34`, `H44`), quay **26/06** (`V35`)
- Guardrails evidence G3-3 (`H52` + `T40` ✅ + `V41`)

### Ngoài phạm vi / Sprint 4

- `H49`, `H50`, `H51` — chatbot đa module + tool registry đầy đủ
- `T49` — RAG corpus manifest
- `V18`, `V19`, `V21`, `V22`, `V23` — UI polish mở rộng
- `H30` — agent safety eval mở rộng

---

## Ưu tiên thực thi (scope pivot 24/06)

| Lớp | Task | Owner | Ghi chú |
|:----|:-----|:------|:--------|
| **P0 — trước quay** | T52a → T52b → T52c → T52d | Hưng | ML dropout pipeline, làm tuần tự |
| **P0** | H25a | Hoàng | Feature spec + anti-leakage review (sau T52a) |
| **P0** | H52 | Hoàng | Error handling 3 tầng + HTTP layer |
| **P0** | V41 | Hiếu | Route guard, nav/CRUD theo role |
| **P1 — demo** | V20, H25b, H44, V34, V35 | Hiếu + Hoàng | UI risk + eval report + slide/script + quay 26/06 |
| **P2 — Sprint 4** | H49–H51, T49, H30, V18–V23 | — | Không block Gate G3 |

**Nhãn dropout (trong DB sau seed):** `status IN ('expelled','withdrawn')` → positive; `active` + khóa ≤ 2023 → negative; loại `Chờ tốt nghiệp` và SV chưa đủ thời gian quan sát.

---

## Dữ liệu & setup chung (cả team)

| Nguồn | Vị trí | Ai cần |
|:------|:-------|:-------|
| Artifact H46 (1.277 SV + status) | `backend/db/seed-academic-v2.json.gz` (trong git) | Hưng — seed/ML |
| Manifest đối soát | `backend/db/seed-academic-v2.manifest.json` | Hưng |
| Crawl thô (`epu_data_batch.json`) | Máy Hoàng, **ngoài repo** | Chỉ khi regenerate artifact |
| Eval / cost G3 | `docs/12-Evaluation/gate3_*.md` | Hoàng, Hiếu (slide) |

**Hưng — bootstrap DB (chạy một lần nếu chưa có 1.277 SV):**

```powershell
git pull origin main
docker compose up -d
cd backend
alembic upgrade head
python scripts/import_academic_dataset.py `
  --artifact db/seed-academic-v2.json.gz --apply --expected-students 1277 `
  --database-url postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight
docker compose exec backend python -m app.analytics.etl
```

**Verify nhãn dropout:**

```sql
SELECT status, COUNT(*) FROM students GROUP BY status;
-- Kỳ vọng: active ~1157, expelled ~87, withdrawn ~33
```

**Verify chung trước quay video:** `.\scripts\verify.ps1` · Ngrok URL · login manager/lecturer/viewer.

---

## Hướng dẫn theo thành viên

### Hưng — Backend / ML (`T52a → d`)

**Mục tiêu:** Pipeline dropout end-to-end; bàn giao API cho Hiếu (`V20`) và agent tool cho Hoàng.

| Task | Việc làm | Done khi |
|:-----|:---------|:---------|
| **T52a** | Mở rộng `STATUS_MAP` trong `import_academic_dataset.py`; `is_active=False` cho expelled/withdrawn; export `backend/db/dropout-labels.json` từ artifact hoặc query DB | Verify SQL 120 dropout; pytest import pass |
| **T52b** | ETL/feature view: `dwh.dim_student.status` + feature (GPA, fail rate, cohort, credits owed) | Query 1 SV dropout + 1 active đủ cột |
| **T52c** | Train baseline classifier → `ml.model_run`; `/admin/ml/train` hoạt động | Metric file; Hoàng sign-off H25a |
| **T52d** | Batch score; `GET /api/v1/predictions/students/{id}/dropout-risk`; RBAC scope; agent đọc `ml` (ADR-006) | API 200; smoke trên Ngrok |

**Lệnh verify sau mỗi bước:**

```powershell
cd backend
ruff check .
pytest -v
```

**Không sửa:** `backend/app/agent/graph.py` core routing (Hoàng — H52) · frontend (`V41`, `V20`).

**Handoff:** Báo Hiếu khi T52d API contract ổn (field `dropout_probability`, `risk_level`, `model_version`).

---

### Hoàng — AI / Evaluation (`H52`, `H25a/b`, `H44`, `H40`)

**Mục tiêu:** Error handling G3-3; review ML; script + evidence cho video.

| Task | Việc làm | Done khi |
|:-----|:---------|:---------|
| **H52** | Ref `docs/4.9-error-handling.md`: custom `handle_tool_errors`, node fallback, HTTP 429/500 (dev vs prod) | ≥ 3 pytest; agent không crash khi tool fail |
| **H25a** | Doc `docs/12-Evaluation/ml-dropout-features.md` — feature list, label rule, leakage tests | Hưng OK spec trước T52c |
| **H25b** | `docs/12-Evaluation/ml-dropout-baseline.md` — P/R/F1/PR-AUC | Sau T52d |
| **H44** | Script demo 3–5 phút (draft **24/06**) | Hiếu dùng cho V35 |
| **H40** | Prompt scope + injection tối thiểu (TC14/TC15 đã pass) | Link evidence G3-3 |

**Lệnh verify:**

```powershell
cd backend
pytest -v
python scripts/run_evaluation.py   # optional, tốn token
```

**Không sửa:** `import_academic_dataset.py` (T52a) · FE RBAC (`V41`) · train pipeline (`T52c`).

**Handoff:** Gửi Hiếu script H44 + slide metric/cost; link guardrails evidence cho G3-3.

---

### Hiếu — Frontend / QA (`V41`, `V20`, `V34`, `V35`, `V37`)

**Mục tiêu:** RBAC UI; dropout UI; slide + quay video **26/06**.

| Task | Việc làm | Done khi |
|:-----|:---------|:---------|
| **V41** | `RequireRole` route guard; sidebar + CRUD theo 5 role; `/forbidden`; Playwright ≥ 3 role | Deep-link trái quyền → forbidden |
| **V20** | Badge risk + `dropout_probability` từ T52d API | Hiển thị trên student/analytics |
| **V34** | Slide draft **24/06** → finalize **25/06** | 8–10 slide; metric/cost từ `gate3_*.md` |
| **V35** | Quay 3–5 phút trên Ngrok (**26/06**) | Pitch + live: login → tree → dropout → RBAC → guardrail chat |
| **V37** | QA + chỉnh video **27/06** | Asset pack sẵn nộp G3-4 |

**Live demo script (gợi ý thứ tự quay):**

1. Login manager → dashboard → Academic Tree  
2. Mở SV có risk cao → badge + probability (`V20`)  
3. Chat: “Giải thích nguy cơ bỏ học SV này” (agent đọc `ml`)  
4. Logout → login lecturer/viewer → nav khác (`V41`)  
5. Câu ngoài scope → từ chối (`H40`)  

**Lệnh verify:**

```powershell
cd frontend
npm run lint
npm test
npx playwright test   # sau V41
```

**Phụ thuộc:** `V20` chờ T52d · `V35` chờ V34 + H44 + V41 (V20 nếu kịp).

**Fallback nếu T52 chậm:** Demo analytics at-risk từ DWH; slide ghi “ML pipeline đang rollout”.

---

## Task theo thành viên — tuần tự, không conflict

### Hoàng — AI / Evaluation

| Task | Mô tả | Khung | P | Depends | Status |
|:-----|:------|:-----|:-:|:--------|:------:|
| H45 | Architecture 3-tier Khoa → Ngành → Chuyên ngành | 21–22/06 | P0 | — | [x] |
| T44 | Tree API + migration 3-tier | 21–22/06 | P0 | H45 | [x] |
| H46 | Seed 1.277 SV thực, upsert không reset DB | 21–25/06 | P0 | H45, T44 | [x] |
| H42 | Evaluation metrics framework | 21–22/06 | P1 | H46 | [x] |
| H43 | Cost report | 22/06 | P1 | H42 | [x] |
| H48 | Universal chatbot core + route decision | 23–24/06 | P0 | T41, T42, T43 | [x] |
| **H52** | **Error handling 3 tầng** — tool/node/graph + HTTP chat (dev vs prod) | 24–25/06 | **P0** | H48 | [ ] |
| **H25a** | **ML review** — feature spec, label rule, anti-leakage tests | 24–25/06 | **P0** | T52a | [ ] |
| **H25b** | **ML eval report** — P/R/F1/PR-AUC, sign-off T52 | 26/06 | P1 | T52d | [ ] |
| H44 | Demo video script / narrative | 24/06 draft | P1 | — | [ ] |
| H40 | Guardrails prompt — scope + injection (tối thiểu G3-3) | 25/06 | P1 | H52 | [ ] |
| H49 | Cross-module data access chatbot | — | P2 | H48 | [ ] ➜ S4 |
| H50 | Expanded agent tool registry | — | P2 | H49 | [ ] ➜ S4 |
| H51 | RAG retrieval integration | — | P2 | H48, T49 | [ ] ➜ S4 |
| H30 | Agent safety eval mở rộng | 28/06 | P2 | H52 | [ ] |

### Hưng — Backend / DevOps

| Task | Mô tả | Khung | P | Depends | Status |
|:-----|:------|:-----|:-:|:--------|:------:|
| T50 | Schema `ml` + prediction tables | 21–22/06 | P0 | T26 | [x] |
| T51 | Fix reload / deep-link | 21/06 | P0 | — | [x] |
| T42 | DWH + ETL foundation | 21–22/06 | P0 | T44 | [x] |
| T43 | Analytics/report API + RBAC | 21–22/06 | P0 | T42 | [x] |
| T41 | User behavior observability | 21–22/06 | P0 | — | [x] |
| T40 | Guardrails backend + RBAC | 25/06 | P1 | T41, T43 | [x] |
| T45 | Deploy runbook | 25/06 | P2 | — | [x] |
| T46 | Integration defect fix | 25/06 | P1 | T40, V39 | [x] |
| T48 | Release candidate verification | 25/06 | P1 | T45, T46, V39 | [x] |
| **T52a** | **Dropout labels** — `STATUS_MAP`, `is_active`, export `dropout-labels.json` từ artifact/DB | 24/06 | **P0** | H46 ✅, T50 ✅ | [ ] |
| **T52b** | **DWH features** — `dim_student` + feature view cho ML | 24–25/06 | **P0** | T52a | [ ] |
| **T52c** | **Train pipeline** — baseline classifier, ghi `ml.model_run` | 25/06 | **P0** | T52b, H25a | [ ] |
| **T52d** | **Score + API** — batch predict, `GET .../dropout-risk`, agent tool đọc `ml` | 25–26/06 | **P0** | T52c | [ ] |
| T49 | RAG corpus preparation | — | P2 | — | [ ] ➜ S4 |

**Hưng đã hoàn thiện trong Sprint 3 tính đến 22/06/2026**

- [x] `T50`: đã kéo main, xử lý lệch migration/DB, đưa DB local lên Alembic head và xác nhận schema mới chạy ổn.
- [x] `T51`: đã khôi phục frontend từ main, xử lý lỗi reload/deep-link và xác nhận route authenticated chạy lại.
- [x] `T42`: đã import dataset main lên `1,277` sinh viên, `56,301` enrollments, `147,286` grade components; chạy lại DWH ETL và CLO refresh.
- [x] `T43`: analytics/report API và dashboard dùng dữ liệu mới trả `200`, có RBAC/query contract nền để chatbot đọc tiếp.
- [x] `T41`: đã triển khai `obs.event_log`, session cookie `ei_session_id`, `request_id`, `trace_id`, frontend `page_view`, backend HTTP/chat/agent/tool structured events; evidence nằm ở `docs/19-User-Behavior-Observability/README.md`.
- [ ] `T49`: đã xác định nguồn dữ liệu/tài liệu nằm ở `crawl/`, `sample_syllabus.pdf`, `epu_data.json`, `backend/db/` và tạo TODO tại `docs/20-RAG-Corpus-Preparation/README.md`; chưa hoàn tất corpus sạch + manifest bàn giao cho H51 nên chưa tick done.

### Hiếu — Frontend / QA

| Task | Mô tả | Khung | P | Depends | Status |
|:-----|:------|:-----|:-:|:--------|:------:|
| V36 | Academic Tree 5 tầng | 21–22/06 | P0 | T44 | [x] |
| V38 | Chat thinking status stack | 21–22/06 | P1 | — | [x] |
| V39 | Playwright E2E + UI test | 22–24/06 | P0 | V36, V38, T51 | [x] |
| V40 | Global chat shell + route handoff | 23–24/06 | P0 | H48, T41 | [x] |
| **V41** | **FE RBAC** — route guard, nav/CRUD theo role, `/forbidden`, Playwright ≥ 3 role | 24–25/06 | **P0** | T40 | [ ] |
| **V20** | **Dropout risk UI** — probability + risk badge trên student/analytics | 26/06 | P1 | T52d | [ ] |
| V34 | Demo slides draft → finalize | 24–25/06 | P1 | V39 | [ ] |
| V35 | Demo video recording (3–5 phút) | **26/06** | P1 | V34, H44, V41, V20 | [ ] |
| V37 | Final QA + asset pack | 27/06 | P1 | V35 | [ ] |
| V18 + V21 | CRUD polish + responsive/dark | — | P2 | — | [ ] ➜ S4 |
| V19, V22, V23 | Chart, FE tests, credit prediction UI | — | P2 | — | [ ] ➜ S4 |

---

## Lịch thực thi theo mốc

| Ngày | Hoàng | Hưng | Hiếu |
|:-----|:------|:-----|:-----|
| **24/06** | H52 + H25a + H44 draft | T52a → T52b | V41 + V34 draft |
| **25/06** | H52 tests + H40 + H44 finalize | T52c → T52d (API) | V41 + V34 finalize |
| **26/06** | H25b | T52d (agent tool + smoke) | V20 + **V35 quay** |
| **27/06** | G3-3 evidence | buffer / fix | V37 QA + chỉnh video |
| **28/06** | H30 nếu còn buffer | — | Sprint 4 handoff |

**Checkpoint trước quay (25/06 20:00):** T52c trained · V41 smoke · V34+H44 draft duyệt.

### Chuỗi phụ thuộc chính

- `T52a → T52b → T52c → T52d → V20`
- `T52a → H25a → T52c → H25b`
- `H48 → H52`; `T40 ✅ + V41 → G3-3`
- `V34 + H44 → V35`; `V41 + V20 → V35`
- `H46 + T50 → T52a`

> [!NOTE]
> `H49–H51` và `T49` lùi Sprint 4 — không block quay video. Chat cơ bản + H48/V40 ✅ đủ cho demo.

---

## Task spec — scope pivot (tóm tắt)

### T52a — Dropout labels (Hưng)

Mở rộng `STATUS_MAP`; `is_active=False` cho expelled/withdrawn; export `dropout-labels.json` từ **artifact/DB** (không cần `crawl/`). Done: verify ~120 dropout trong `students.status`.

### T52b — DWH features (Hưng)

ETL `dwh.dim_student` + feature view (GPA, fail rate, credits owed, cohort). Done: query 1 SV dropout + 1 active.

### T52c — Train pipeline (Hưng)

Baseline binary classifier; ghi `ml.model_run`; `/admin/ml/train` hoạt động. Done: metric file, H25a sign-off.

### T52d — Score + API (Hưng)

Batch score → `dropout_probability` + `risk_level`; API có RBAC; agent tool đọc `ml` (ADR-006). Done: `GET .../dropout-risk` 200.

### H25a / H25b — ML review & eval (Hoàng)

**a:** feature spec + leakage tests (`docs/12-Evaluation/ml-dropout-features.md`). **b:** baseline report P/R/F1/PR-AUC (`ml-dropout-baseline.md`).

### H52 — Error handling (Hoàng)

Ref `docs/4.9-error-handling.md`: custom `handle_tool_errors`, node fallback, HTTP 429/500 dev vs prod, ≥ 3 pytest. Done: agent không crash khi tool fail.

### V41 — FE RBAC (Hiếu)

`RequireRole` route guard; nav + CRUD theo 5 role; lecturer scope; Playwright ≥ 3 role. Done: deep-link trái quyền → forbidden.

### V20 — Dropout UI (Hiếu)

Badge risk + probability từ T52d API. Done: hiển thị trên student detail hoặc analytics.

---

## Scope bổ sung — Global Chat, RAG và Progress UX

### H48 — Universal Chatbot Core

**Done khi:**

- Chatbot phân loại intent và độ phức tạp, orchestration đúng tool/retrieval, không chỉ giới hạn ở Report Center.
- Trả `route_decision` có schema tối thiểu: `mode: inline | full_chat`, `target_route`, `reason`, `preserve_context`.
- Câu hỏi đơn giản trả lời ngắn bằng page context; câu phức tạp, nhiều bước hoặc cần nhiều tool được chuyển sang full chatbot.
- Dùng chung session/memory store; route decision không làm mất lịch sử và luôn để backend kiểm tra lại RBAC/scope.
- **Integration (2026-06-23):** Frontend gửi `context.route` trong body stream; global chat shell đọc SSE `route_decision` (không suy từ `intent`). Smoke Ngrok: inline tại `/manager`, `target_route` đúng pathname.

### H49 — Page Context & Cross-module Data Access

Context contract tối thiểu:

```text
route
module
entity_type / entity_id
selected_filters
report_id / snapshot_id
user_role / department_scope
```

**Done khi:** backend tự resolve và validate lại entity/RBAC; chatbot có thể đọc dữ liệu từ dashboard, report, khoa/ngành/môn, lớp, sinh viên, CLO/PLO và data quality mà không tin mù quáng context do client gửi lên.

### H50 — Expanded Agent Tool Registry

Read tools ưu tiên:

```text
explain_metric
find_root_causes
compare_periods
get_student_risk_profile
get_program_or_course_context
get_report_snapshot
get_data_quality_summary
search_knowledge_base
generate_report_draft
```

- Tool output có `source`, `scope`, `timestamp`, `warnings` và audit log.
- Tool thay đổi dữ liệu như `create_task` hoặc `create_intervention` chỉ tạo pending action và bắt buộc người dùng xác nhận.
- Mỗi tool có input schema, RBAC test, timeout/fallback và ít nhất một test success/denied/error.

### T41 — User Behavior Observability

- Gắn `session_id`, `request_id`, `trace_id` xuyên suốt page event → chat message → agent run → tool/retrieval call.
- Ghi structured event cho route/view/filter/chat/tool/error/latency để quan sát hành vi và debug funnel.
- Không log nguyên văn password, token, cookie, prompt/tài liệu nhạy cảm; có retention và access scope cho log.
- Done khi truy được một hành trình người dùng end-to-end và đối chiếu được latency/error theo trace.

### T42 + T43 — Data/Analytics Backend cho chatbot

- `T42`: hoàn thiện DWH/ETL idempotent, lịch chạy, DQ reconciliation và query contract ổn định.
- `T43`: expose API/tool đọc report, metric, snapshot và dữ liệu đa module với RBAC/source/timestamp/warnings.
- Bàn giao schema mẫu, success/denied/error response và test để Hoàng dùng trực tiếp trong `H49/H50`.

### T49 — RAG Corpus Preparation

Hưng bàn giao corpus cùng manifest tối thiểu:

```text
document_id, title, source_path, document_type, owner,
version, updated_at, access_scope, checksum, language,
chunk_strategy, review_status
```

Tài liệu phải được deduplicate, bỏ nội dung lỗi/encoding xấu, gắn access scope và có danh sách tài liệu bị loại kèm lý do. Corpus ưu tiên quy chế, chương trình đào tạo, đề cương môn, hướng dẫn nghiệp vụ, định nghĩa metric và tài liệu sản phẩm đã được xác minh.

### T45/T46/T48 — Deploy, Fix và Release Evidence

- `T45`: runbook có lệnh restart Next.js/FastAPI/Ngrok, health checks, URL chính/fallback, owner và cách xác nhận proxy `/api/v1`.
- `T46`: chỉ xử lý blocker có issue ID do `V39` phát hiện; mỗi fix phải có root cause, commit/file liên quan và Playwright/manual retest.
- `T48`: khóa version/env, chạy migration/seed/health/Playwright, lưu artifact test, known issues và rollback commands; không còn là “submission support” chung chung.

### H51 — RAG Retrieval Integration

- `search_knowledge_base` lọc theo role/department/document scope trước retrieval.
- Câu trả lời dùng tài liệu phải kèm nguồn; không đủ evidence thì nói rõ không tìm thấy.
- Có test retrieval đúng nguồn, không lộ tài liệu ngoài scope và fallback khi index unavailable.

### V38 — Stacked Chat Thinking Status

- Collapsed mặc định: vùng status cao tối đa một hàng; status mới nhất nằm trên cùng, các status cũ được stack/overlay hoặc ẩn, không trượt thành nhiều dòng và không đẩy khung chat xuống.
- Có nút `Xem tiến trình (n)`/chevron để mở dropdown timeline đầy đủ.
- Expanded: hiển thị các bước theo thứ tự, trạng thái, tool và thời gian; có thể thu gọn lại.
- Có `aria-expanded`, điều khiển bằng bàn phím, responsive và animation tôn trọng `prefers-reduced-motion`.

### V39 — Playwright E2E + UI Test

- Test auth, refresh/deep-link, Tree 5 tầng, Report, global chat, route handoff, loading/error và responsive viewport.
- Có fixture/test data ổn định, screenshot/trace khi fail và lệnh chạy local/CI rõ ràng.

### V40 — Global Chat Shell & Route Handoff

- Mount một chat shell trong authenticated layout để xuất hiện ở mọi page được phép truy cập và giữ session khi chuyển route.
- Nhận `route_decision` từ chatbot core: `inline` hiển thị câu trả lời ngay cửa sổ page hiện tại; `full_chat` điều hướng sang `/chatbot` cùng conversation/page context.
- Có fallback khi route decision lỗi, không loop điều hướng, hỗ trợ mobile/keyboard và được V39 bao phủ.

---

## Mapping Deliverable -> Task

| Deliverable | Task map | Done when |
|:------------|:---------|:----------|
| G3-1 Public URL | Ngrok ✅ + T45 + V39 | Smoke login/dashboard/tree/chat |
| G3-2 Eval metrics | H42 ✅ | `gate3_eval_metrics.md` |
| G3-3 Guardrails | H52 + T40 ✅ + V41 + H40 | Evidence doc + RBAC live + scope chat |
| G3-4 Demo video | V34 + H44 + V35 + V20 + V41 | File 3–5 phút, quay 26/06 |
| G3-5 Cost report | H43 ✅ | `gate3_cost_report.md` |

---

## Deployment Strategy cho Gate G3

### Primary path — đã cấu hình và ổn định

- **Backend:** FastAPI cổng `8000` (local/personal server)
- **Proxy:** Next.js `/api/v1/*` → FastAPI
- **Public entry:** Ngrok cổng `3000` — **G3-1 ✅**
- **Runbook:** T45 ✅

### Fallback path

- Frontend lên `Vercel` nếu build ổn định và env đơn giản
- Mở tunnel backend riêng hoặc đưa backend lên `Render`/`Railway` chỉ khi shared Next.js proxy gặp lỗi
- Có thể dùng 1 URL chính + 1 URL backup, miễn là README và video chỉ rõ URL demo chính

### Acceptance cho deploy

1. Login được
2. Dashboard load được
3. Tree load được
4. Chat/Report trả về được ít nhất 1 response
5. Gọi API qua `<shared-public-url>/api/v1/*` nhận response hợp lệ
6. Có hướng dẫn restart tunnel/Next.js/FastAPI trong README hoặc runbook

---

## Evaluation Metrics bắt buộc

| Metric | Baseline bắt buộc | Nguồn |
|:-------|:------------------|:------|
| Latency p95 | Số giây p95 cho chat/report request | API timing log / manual run |
| Tool success rate | % request gọi tool thành công / tổng request cần tool | agent logs / evaluation sheet |
| Answer quality | Điểm đánh giá manual hoặc pass rate trên test set G2/G3 | eval sheet |
| Cost/query | Ước tính USD per query theo router/core split | token assumptions + provider pricing |

---

## Guardrails Checklist

### AI side

- [ ] Prompt giới hạn scope (`H40`)
- [ ] Jailbreak / injection cơ bản (`H40` / eval TC15)
- [ ] Error handling 3 tầng, agent không crash (`H52`)
- [ ] LLM chỉ explain prediction từ `ml`, không generate probability (T52d + ADR-006)

### Backend + Frontend

- [x] RBAC API (`T40`)
- [ ] RBAC UI — nav, route, CRUD (`V41`)
- [x] Structured error/agent logs (`T41`)
- [ ] Timeout + retry + tool fallback (`H52`)

---

## Risks và cách giảm

| Risk | Mức | Giảm thiểu |
|:-----|:---:|:-----------|
| T52 chưa kịp trước quay | Cao | Checkpoint 25/06; fallback demo DWH at-risk |
| V41 chưa xong | Trung bình | RBAC API đã có; demo login 2 role tối thiểu |
| Class imbalance ML (~9% dropout) | Trung bình | Stratified split; báo PR-AUC trong H25b |
| Video chưa duyệt kịp | Trung bình | V34+H44 draft 24/06; quay 26/06, chỉnh 27/06 |

---

## Sprint 3 Review và Handoff

**Checkpoint Gate G3:** 26/06/2026 (sau V35)  
**Checkpoint carry-over:** 28/06/2026

### Checklist review trước quay (25/06)

- [x] Ngrok URL ổn định
- [x] Metrics + cost report có file
- [ ] T52c trained + T52d API smoke
- [ ] V41 RBAC smoke
- [ ] V34 + H44 draft duyệt
- [ ] G3-3 evidence draft (`H52` + `V41`)

### Checklist sau quay (27/06)

- [ ] Video draft 3–5 phút
- [ ] G3-3 evidence link đầy đủ
- [ ] `T52a–d` + `V20` hoàn tất hoặc blocker ghi rõ
- [ ] `H52` pytest pass

### Backlog Sprint 4

- `H49`, `H50`, `H51`, `T49` — chatbot + RAG
- `V18`, `V19`, `V21`, `V22`, `V23` — UI polish
- `H30` — agent safety eval mở rộng

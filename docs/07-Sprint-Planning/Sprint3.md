# Sprint 3 — Sẵn sàng triển khai & Gate G3

> **Thời gian:** 21/06 – 28/06/2026
> **Sprint Goal:** _Đóng Sprint 2 sau khi Gate G2 đã nộp, tập trung hoàn thành 5 deliverables Gate G3 trước 25/06/2026 23:59, sau đó dùng phần thời gian còn lại để xử lý các task còn dang dở từ Sprint 2 theo thứ tự tuần tự, không conflict._
> **Tham chiếu:** [Sprint2.md](./Sprint2.md) · [SprintPlanning.md](./SprintPlanning.md) · [gate2_eval_report.md](../12-Evaluation/gate2_eval_report.md)
> **Cập nhật lần cuối:** 21/06/2026

> [!IMPORTANT]
> **Quyết định sprint:** Sprint 2 đã đóng scope tại Gate G2. Từ thời điểm này, mọi công việc cho **Gate G3** và mọi task **chưa hoàn thiện từ Sprint 2** đều được theo dõi tại file này.

> [!NOTE]
> **Chiến lược production cho Gate G3:** ưu tiên **Ngrok + personal server** cho frontend/backend vì nhanh và ít phụ thuộc tài khoản deploy. `Vercel`, `Railway`, `Render`, `Cloud Run` là phương án fallback nếu URL chính không ổn định.

---

## Gate G3 — Mục tiêu và Deliverables

> **Deadline tuyệt đối:** 25/06/2026 23:59

### Checklist Deliverable Gate G3

- [ ] G3-1: Có public URL dùng chung; frontend và backend qua `/api/v1` proxy đều smoke test pass
- [x] G3-2: Có ít nhất 3 evaluation metrics với baseline số
- [ ] G3-3: Có evidence guardrails phía AI và backend
- [ ] G3-4: Có demo video draft 3-5 phút
- [x] G3-5: Có cost report rõ assumption và công thức tính

| # | Deliverable | Định nghĩa done | Owner chính | Deadline nội bộ | Trạng thái |
|:-:|:------------|:----------------|:-----------:|:---------------:|:----------:|
| G3-1 | Public production URL | URL Ngrok dùng chung truy cập được; frontend + backend proxy `/api/v1` chạy login/chat/dashboard | Hưng + Hiếu | 23/06 | [ ] |
| G3-2 | Evaluation metrics | Có ít nhất 3 metric có baseline số: latency p95, tool success rate, answer quality; khuyến khích thêm cost/query | Hoàng | 24/06 | [x] |
| G3-3 | Guardrails | Có guardrails ở AI + backend: scope, fallback, tool limits, RBAC, error log | Hoàng + Hưng | 25/06 | [ ] |
| G3-4 | Demo video draft | Video 3-5 phút gồm slide pitch ngắn + live demo trên public URL | Hiếu | 25/06 | [ ] |
| G3-5 | Cost report | Ước tính cost / user / month dựa trên usage và routing model hiện tại | Hoàng | 25/06 | [x] |

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

### Trong phạm vi

- Public URL và smoke test end-to-end
- Evaluation metrics baseline và evidence
- Guardrails AI + backend
- Demo video draft
- Cost report
- Các task còn dang dở của Sprint 2 đã được chuyển sang Sprint 3
- Global chatbot có mặt trên mọi trang, nhận page context và truy cập dữ liệu đa module theo RBAC
- Mở rộng tool registry và chuẩn bị corpus tài liệu có metadata cho RAG
- Chat progress UI dạng compact stack, chỉ mở timeline đầy đủ khi người dùng yêu cầu

### Ngoài phạm vi

- Các tính năng mới ngoài danh sách task đã chốt, ngoại trừ scope Global Chat/RAG/Progress UX bổ sung ngày 20/06
- Refactor lớn không phục vụ trực tiếp deploy, evaluation, guardrails, demo hoặc carry-over

---

## Ưu tiên thực thi carry-over từ Sprint 2

> [!IMPORTANT]
> Không đẩy toàn bộ backlog Sprint 2 ra sau 25/06. Trong Sprint 3, nhóm task carry-over được chia làm 2 lớp:
>
> - **Lớp 1 — kéo lên trước 25/06:** `H45`, `T44`, `H46`, `V36`, `T50`, `T41`, `T42`, `T43`, `T49` và batch chatbot `H48–H51`/`V40`.
> - **Lớp 2 — xử lý sau batch chatbot:** `H25`, `H26`, `H30`, `H40`, `H44`, `T40`, `T45`, `T46`, `T48`, `V18`, `V19`, `V20`, `V21`, `V22`, `V23`.

| Nhóm | Task | Lý do ưu tiên |
|:-----|:-----|:--------------|
| Enabler P0 | H45 | Chốt spec 3-tier để backend và frontend chạy tiếp |
| Enabler P0 | T44 | Mở đường cho `V36` và `H46` |
| Enabler P0 | V36 | UI 3-tier là đầu ra nhìn thấy được cho Demo 2 |
| Enabler P0 | H46 | Scale data là nền cho metrics/prediction/report |
| Enabler P0 | T50 | Verify schema `ml`/prediction storage ngay 21–22/06 trước chatbot và baseline model |
| Carry-over P1 | H25 + H26 | Hoàng làm model và evaluation sau data scale + schema `ml` |
| Enabler P0 | T42 + T43 | Data/analytics backend và tool contract phải sẵn sàng trước khi Hoàng mở rộng chatbot |
| Enabler P0 | T41 | Observability cho session, hành vi người dùng, agent/tool/retrieval trace |
| Enabler P0 | T49 | Bàn giao corpus tài liệu sớm để Hoàng tích hợp RAG ngày 23–24/06 |
| Carry-over P1 | V18, V19, V20, V21, V22, V23 | UI/prediction/test mở rộng, không nên chặn Gate G3 |

---

## Task theo thành viên — tuần tự, không conflict

### Hoàng — AI / Evaluation

| Task | Mô tả | Khung thời gian | Priority | Depends on | Trạng thái |
|:-----|:------|:--------------:|:--------:|:-----------|:----------:|
| H45 | Nâng architecture 3-tier Khoa → Ngành → Chuyên ngành | 21/06 – 22/06 | P0 | - | [x] |
| T44 | Tree API + Migration 3-tier — chuyển ownership từ Hưng sang Hoàng | 21/06 – 22/06 | P0 | H45 | [x] |
| H46 | Seed 1.277 sinh viên thực, không trùng MSSV — upsert không reset DB | 21/06 – 25/06 | P0 | H45, T44 | [x] |
| H42 | Evaluation Metrics Framework | 21/06 – 22/06 | P1 | H46 | [x] |
| H43 | Cost Report | 22/06 | P1 | H42 | [x] |
| H48 | Universal Chatbot Core — phân loại ý định/độ phức tạp, orchestration hội thoại và route decision contract cho inline/full chatbot | 23/06 – 24/06 | P0 | T41, T42, T43 | [x] |
| H49 | Cross-module Data Access — chatbot truy vấn dashboard/report/khoa/ngành/môn/lớp/sinh viên/CLO-PLO đúng RBAC | 23/06 – 24/06 | P0 | H48, T42, T43 | [ ] |
| H50 | Expanded Agent Tool Registry — bộ read tools đa module, source/audit, timeout/fallback và confirmation cho write tools | 23/06 – 24/06 | P0 | H49, T42, T43 | [ ] |
| H51 | RAG Retrieval Integration — truy vấn toàn bộ corpus Hưng bàn giao, citation, scope filter và fallback khi thiếu tài liệu | 23/06 – 24/06 | P0 | H48, T49 | [ ] |
| H40 | Guardrails — Prompt & Report Safety | 25/06 | P1 | H48, H49, H50, H51 | [ ] |
| H25 | Feature engineering + baseline dự đoán pass/trượt, chống leakage | 27/06 | P1 | H46, T50 | [ ] |
| H30 | Agent Safety & Tools Evaluation | 27/06 – 28/06 | P2 | H40 | [ ] |
| H26 | Tổng hợp expected passed/failed credits và báo cáo evaluation | 28/06 | P1 | H25 | [ ] |

### Hưng — Backend / DevOps

| Task | Mô tả | Khung thời gian | Priority | Depends on | Trạng thái |
|:-----|:------|:--------------:|:--------:|:-----------|:----------:|
| T50 | ML Schema Ownership & Verification — duy trì migration `ml`, model run/prediction tables, verify upgrade/downgrade và storage contract | 21/06 – 22/06 | P0 | T26 | [x] |
| T51 | Fix Reload Page — sửa lỗi refresh/deep-link làm mất session, 404 hoặc sai state; verify trên các route authenticated | 21/06 | P0 | - | [x] |
| T42 | DWH + ETL Access Foundation — hoàn thiện dữ liệu analytics, lịch ETL idempotent, DQ check và query contract cho chatbot | 21/06 – 22/06 | P0 | T44 | [x] |
| T43 | Report/Analytics Tool Backend — API/tool truy vấn report, metrics và dữ liệu đa module; có RBAC, source metadata, timeout/error contract | 21/06 – 22/06 | P0 | T42 | [x] |
| T41 | User Behavior Observability — session/cookie, structured event log, correlation/trace ID cho page, chat, tool và retrieval để quan sát hành vi người dùng | 21/06 – 22/06 | P0 | - | [x] |
| T49 | RAG Corpus Preparation — tổng hợp, làm sạch, phân loại, access scope và manifest tài liệu; bàn giao corpus dùng được cho Hoàng | 21/06 – 23/06 | P0 | - | [ ] |
| T40 | Guardrails — Backend & RBAC | 25/06 | P1 | T41, T43 | [x] |
| T45 | Deployment/Proxy Recovery Runbook — lệnh restart Next.js/FastAPI/Ngrok, health check, URL fallback, owner và checklist xác minh | 25/06 | P2 | - | [x] |
| T46 | Integration Defect Fix Window — triage/fix blocker auth, reload, proxy, API và chat do Playwright/UI test phát hiện; có issue list + retest evidence | 25/06 | P1 | T40, V39 | [x] |
| T48 | Release Candidate Verification — freeze version/env, chạy migration/seed/health/Playwright, lưu evidence và rollback commands | 25/06 | P1 | T45, T46, V39 | [x] |

**Hưng đã hoàn thiện trong Sprint 3 tính đến 22/06/2026**

- [x] `T50`: đã kéo main, xử lý lệch migration/DB, đưa DB local lên Alembic head và xác nhận schema mới chạy ổn.
- [x] `T51`: đã khôi phục frontend từ main, xử lý lỗi reload/deep-link và xác nhận route authenticated chạy lại.
- [x] `T42`: đã import dataset main lên `1,277` sinh viên, `56,301` enrollments, `147,286` grade components; chạy lại DWH ETL và CLO refresh.
- [x] `T43`: analytics/report API và dashboard dùng dữ liệu mới trả `200`, có RBAC/query contract nền để chatbot đọc tiếp.
- [x] `T41`: đã triển khai `obs.event_log`, session cookie `ei_session_id`, `request_id`, `trace_id`, frontend `page_view`, backend HTTP/chat/agent/tool structured events; evidence nằm ở `docs/19-User-Behavior-Observability/README.md`.
- [ ] `T49`: đã xác định nguồn dữ liệu/tài liệu nằm ở `crawl/`, `sample_syllabus.pdf`, `epu_data.json`, `backend/db/` và tạo TODO tại `docs/20-RAG-Corpus-Preparation/README.md`; chưa hoàn tất corpus sạch + manifest bàn giao cho H51 nên chưa tick done.

### Hiếu — Frontend / QA

| Task | Mô tả | Khung thời gian | Priority | Depends on | Trạng thái |
|:-----|:------|:--------------:|:--------:|:-----------|:----------:|
| V36 | Academic Tree — hoàn thiện UI 5 tầng Trường → Khoa → Ngành → Chuyên ngành → Môn, metrics không đếm trùng | 21/06 – 22/06 | P0 | T44 | [x] |
| V38 | Chat Thinking Status Stack — status chồng trong vùng cố định; chỉ xổ toàn bộ tiến trình khi bấm nút | 21/06 – 22/06 | P1 | - | [x] |
| V39 | Playwright E2E + UI Test — auth/reload/deep-link, Tree, Report, chat inline/full-page, responsive và error/loading states | 22/06 – 24/06 | P0 | V36, V38, T51 | [x] |
| V40 | Global Chat Shell & Route Handoff — chatbot trên mọi page; câu đơn giản chat tại page, câu phức tạp chuyển `/chatbot` theo route decision của LLM | 23/06 – 24/06 | P0 | H48 contract, T41 | [x] |
| V34 | Demo Slides + Recording Setup | 25/06 | P1 | V39 | [ ] |
| H44 | Demo Video Narrative | 25/06 | P1 | H40 | [ ] |
| V35 | Demo Video Draft Recording | 25/06 | P1 | V34, H44 | [ ] |
| V18 + V21 | CRUD pages ưu tiên + responsive/dark mode polish | 26/06 – 27/06 | P1 | - | [ ] |
| V19 + V20 + V22 + V23 | Chart component, prediction UI, FE unit tests, UI prediction tổng tín chỉ | 27/06 – 28/06 | P1 | V36, H25 + H26 | [ ] |
| V37 | Final QA + Asset Pack | 28/06 | P1 | V35, T48 | [ ] |

---

## Lịch thực thi theo mốc

| Ngày | Hoàng | Hưng | Hiếu | Kết quả chốt cuối ngày |
|:-----|:------|:-----|:-----|:-----------------------|
| **21/06** | chốt H45/T44/H46 + bắt đầu H42 | ưu tiên T50 + T51, khởi động T42/T43/T41/T49 | ưu tiên V36 + bắt đầu V38 | ML schema/reload được xử lý sớm; backend data/observability/corpus khởi động; Tree UI đi trước |
| **22/06** | chốt H42/H43 + contract chatbot `H48–H51` | chốt T50 và phần chính T42/T43, tiếp tục T41/T49 | chốt V36/V38 + bắt đầu V39 | ML/data/tool/trace contract và UI nền sẵn sàng cho chatbot |
| **23/06** | tập trung H48 + H49 + H50 + H51 | bàn giao T42/T43 và corpus T49 dùng được, tiếp tục observability | V40 + Playwright/UI test V39 | Chatbot truy vấn được dữ liệu hệ thống và tài liệu có nguồn; có inline chat prototype |
| **24/06** | chốt Universal Chatbot, tools và RAG retrieval | hoàn tất T41/T49, hỗ trợ integration | chốt V40 + V39 | Chatbot giải đáp đa miền; câu đơn giản ở tại page, câu phức tạp sang `/chatbot` |
| **25/06** | H40 | T40 + T45/T46/T48 | H44 + V34 + V35 | Guardrails, video narrative/draft và release evidence chốt sau khi chatbot mới ổn định |
| **26/06** | bắt đầu H25 | hỗ trợ integration prediction | V18/V21 + chuẩn bị batch UI | Baseline model bắt đầu trên schema ML đã verify |
| **27/06** | chốt H25 + bắt đầu H30 nếu còn buffer | hỗ trợ integration prediction | tiếp tục V19/V20/V22 | Baseline model chạy trên schema đã verify |
| **28/06** | chốt H26/H30 | hỗ trợ release nếu còn blocker | V23 + V37 + chốt batch UI | QA asset pack và handoff cuối Sprint hoàn tất |

### Chuỗi phụ thuộc chính

- `H45 -> T44 -> H46`
- `T44 -> V36`
- `H42 -> H43`
- `T51 -> V39 -> T46 -> T48`
- `T26 -> T50`
- `H46 + T50 -> H25 -> H26 -> V23`
- `T42 -> T43 -> H49 + H50`
- `T41 -> H48 + V40`
- `T49 -> H51`
- `H48 -> V40`; `V38 -> V39`

> [!NOTE]
> Điểm thay đổi quan trọng của bản kế hoạch này là: **task carry-over ưu tiên cao không bị đẩy lùi cơ học sau 25/06**. Các enabler P0 đã được kéo lên chạy song song từ `21/06` đến `25/06`, miễn là không làm rơi deliverables Gate G3.

> [!WARNING]
> Ngày 23–24/06 được khóa cho chatbot. Nếu thiếu capacity, giảm số tool ít quan trọng ở `H50`; không cắt truy vấn corpus `H51`, RBAC, source citation, observability hoặc route handoff `V40`.

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
| G3-1 Public URL | H27 + V39 + T45 | Shared Ngrok URL đã có; frontend + `/api/v1` proxy Playwright/smoke pass, có fallback/runbook |
| G3-2 Eval metrics | H42 | Có bảng baseline và cách đo metric trong `docs/12-Evaluation/` |
| G3-3 Guardrails | H40 + T40 | Có evidence prompt/backend guardrails và test case tối thiểu |
| G3-4 Demo video draft | H44 + V34 + V35 | Có file video 3-5 phút có pitch + live demo |
| G3-5 Cost report | H43 | Có file report, rõ assumption, rõ công thức tính |

---

## Deployment Strategy cho Gate G3

### Primary path — đã cấu hình

- **Backend:** FastAPI chạy local/personal server ở cổng `8000`; không mở tunnel riêng.
- **Proxy:** Next.js Route Handler chuyển `/api/v1/*` về FastAPI `127.0.0.1:8000`.
- **Public entry:** Ngrok expose Next.js cổng `3000`; frontend và backend dùng chung một origin/URL.
- **Evidence:** URL công khai trong README/Gate G2, cấu hình proxy/CORS, video demo và smoke checklist.

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

- [ ] Prompt giới hạn scope theo domain học tập
- [ ] Có xử lý jailbreak / prompt injection cơ bản
- [ ] Không trả thông tin nhạy cảm vượt role
- [ ] Nếu thiếu data thì nói rõ “không đủ dữ liệu”
- [ ] Report output có safe wording, không kết luận quá mức

### Backend side

- [ ] RBAC cho manager / lecturer / admin
- [ ] Giới hạn tool execution / tool confirmation
- [ ] Timeout + retry + fallback response
- [x] Structured logs cho error và agent run
- [ ] CORS/env production được chốt ổn định trước ngày quay video

---

## Risks và cách giảm

| Risk | Mức độ | Giảm thiểu |
|:-----|:------:|:-----------|
| Ngrok URL đổi hoặc hết session | Trung bình | T45 tạo runbook restart + URL backup |
| Frontend/backend CORS lệch | Cao | Chốt env ngày 21/06, smoke test ngày 22/06 |
| Video quay trên URL không ổn định | Cao | V34 setup trước, T46 fix trước ngày quay |
| Metric baseline không đủ bằng chứng | Trung bình | H42 dùng lại test set Gate G2 + manual timing có log |
| Batch carry-over ngày 28/06 bị nặng | Trung bình | Chốt trước task nào là must-have, task nào được phép chuyển Sprint 4 |

---

## Sprint 3 Review và Handoff

**Checkpoint Gate G3:** 25/06/2026, 20:30  
**Checkpoint carry-over:** 28/06/2026, cuối ngày

### Checklist review ngày 25/06

- [ ] Public URL chạy được trên máy khác mạng
- [ ] Guardrails evidence được link rõ
- [ ] Metrics baseline có bảng và số
- [ ] Video draft mở được, độ dài 3-5 phút
- [ ] Cost report hoàn tất

### Checklist review ngày 28/06

- [x] Chuỗi `H45 -> T44 -> H46` hoàn tất; evidence H46 đã đối soát trên DB hiện hữu và clean seed
- [ ] Chuỗi `T50 + H46 -> H25 -> H26 -> V23` hoàn tất hoặc chốt blocker rõ
- [x] `T42 + T43 + T41` hoàn tất trước batch chatbot và có contract/evidence dùng được
- [ ] Batch `V19 + V20 + V22 + V23` hoàn tất hoặc tách phần còn lại sang Sprint 4
- [ ] `H48 + H49 + H50 + H51 + V40` chạy end-to-end: data tools, corpus retrieval, inline/full-page routing và citation
- [x] H48 + V40 route handoff smoke: page context → `target_route` đúng pathname; SSE `route_decision` + inline/full_chat trên Ngrok (2026-06-23)
- [ ] `T49` có corpus/manifest RAG được review; tài liệu bị loại có lý do rõ
- [x] `V38` không làm status chat trượt thành nhiều dòng khi collapsed và mở được timeline đầy đủ
- [x] `V39` có Playwright/UI report cho reload, Tree, Report và chat inline/full-page

### Backlog nếu phải đẩy sang Sprint 4

- H30 nếu chưa còn buffer
- Phần còn lại của `V19 + V20 + V22 + V23`
- Phần còn lại của `H50` nếu tool registry chưa đủ test/audit/RBAC

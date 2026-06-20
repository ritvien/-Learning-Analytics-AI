# 🏃 Sprint 2 — Core Agent & Demo 1 (Gate G2: First Working Agent MVP)

> **Thời gian:** 11/06 – 24/06 (2 tuần — W3 + W4)
> **Sprint Goal:** _Xây dựng AI Agent chạy được end-to-end với LLM thực tế, pass Gate G2 (18/06) và hoàn thiện Demo 1. Agent phải nhận input → xử lý → trả output có ý nghĩa cho ít nhất 1 user flow chính._
> **Tham chiếu:** [SprintPlanning.md](./SprintPlanning.md) · [LangGraphAgent.md](../10-References/LangGraphAgent.md) · [AgentFlowDiagram.md](../10-References/AgentFlowDiagram.md)
> **Cập nhật lần cuối:** 20/06/2026 (Gate G2 ✅ submitted · phân bổ lại deadline Hoàng G3)

> [!NOTE]
> **Gate G2 — ✅ ĐÃ SUBMIT (18/06/2026).** Tất cả 5 deliverables đã nộp. Eval: 10 test cases AI chatbot + báo cáo tại [gate2_eval_report.md](../12-Evaluation/gate2_eval_report.md).

> [!IMPORTANT]
> **Gate G2 Deadline: 18/06/2026 (23:59)** — Deliverables bắt buộc:
> 1. ✅ MVP Demo — video 3 phút show user flow end-to-end
> 2. ✅ Architecture diagram — sơ đồ components, data flow
> 3. ✅ Repo có >= 10 PR merged
> 4. ✅ README.md — setup instructions, env vars, sample queries
> 5. ✅ Eval evidences — ít nhất 5 test case manual với output thực tế

> [!WARNING]
> **Demo 1 với đối tác: 14/06** — ĐÃ QUA. MVP Streamlit đã demo thành công.
> **Chiến lược 3 giai đoạn:** Phase 1 (11–14/06) MVP ✅ Done · Phase 2 (15–18/06) Gate G2 · Phase 3 (16–24/06) **Hoàn thiện Demo 1: Academic Tree + Dashboard + Chat AI**

---

## Gate G2 — Mapping Deliverables → Tasks

| # | Gate G2 Deliverable | Hiện trạng | Task phụ trách | Deadline | Status |
|:-:|:--------------------|:-----------|:---------------|:--------:|:------:|
| G2-1 | MVP Demo video 3 phút | Video đã quay, user flow end-to-end trên Next.js + Streamlit | V15 (Hiếu quay + edit), H32 (Hoàng kịch bản), cả team demo | 17/06 | ✅ |
| G2-2 | Architecture diagram | **3 Mermaid diagrams** hoàn thiện trong README (system, deployment, agent flow) | Hoàng | 18/06 | ✅ |
| G2-3 | Repo >= 10 PR merged | 14+ PR merged trên GitHub | T18 + cả team tạo PR đúng quy trình | 18/06 | ✅ |
| G2-4 | README.md (setup, env, queries) | Setup, env vars, sample queries đã bổ sung | H19 (Hoàng) | 16/06 | ✅ |
| G2-5 | Eval evidences (10 test cases) | **10 test cases AI chatbot** đã chạy + báo cáo tại `docs/12-Evaluation/gate2_eval_report.md` | Hoàng | 18/06 | ✅ |

> **Gate G2:** ✅ Hoàn thành và submit. H36–H39 (tests/RAGAS formal) coi như done cùng G2-5.

### Gate G2 — Task index nhanh

| Task | Owner | Mô tả ngắn | Deadline | Status |
|:-----|:-----:|:-----------|:--------:|:------:|
| H19 | Hoàng | README setup/env/queries | 16/06 | ✅ |
| H21 | Hoàng | Prompt tuning + error handling 3 tầng | 18/06 | ✅ |
| H32 | Hoàng | Kịch bản video demo G2 | 17/06 | ✅ |
| V15 | Hiếu | Quay + edit video 3 phút | 17/06 | ✅ |
| T18 | Hưng | ≥ 10 PR merged | 18/06 | ✅ |
| H36–H39 | Hoàng | Tests + RAGAS + eval report (G2-5) | 18/06 | ✅ |

---

## Phân chia Sprint thành 2 Phase

### Phase 1: MVP Sprint (11–14/06) — Demo 1 + Gate G2 Core ✅

> Mục tiêu: Agent chạy end-to-end trên Streamlit, có seed data thật trong DB, demo được 1 user flow hoàn chỉnh. **→ ĐÃ HOÀN THÀNH**

### Phase 2: Gate G2 Deliverables (15–18/06) — Video, Eval, PRs, README

> Mục tiêu: Video demo, eval evidences, 10 PRs, README hoàn chỉnh.

### Phase 3: Demo 1 Completion (16–20/06) — Hoàn thiện chức năng chính 🎯

> Mục tiêu: Academic Tree kết hợp Dashboard, click node → Chat AI + tạo báo cáo, SSE streaming, phân quyền login, evaluation chatbot. (Gấp rút hoàn thành trong 16/06 để quay video 17/06)

---

## 🟠 Hoàng — AI/Data Engineer + PM/PO

### Phase 1: MVP Agent (11–14/06)

| # | Task | Mô tả chi tiết | Deadline | Status |
|:-:|:-----|:----------------|:--------:|:------:|
| H11 | Seed Data vào PostgreSQL | Chạy script tiền xử lý data crawl → load SQL seed của 700 sinh viên thực tế vào Docker PostgreSQL. Đảm bảo map đúng schema: trường, khoa, ngành, môn, điểm + CLO | 11/06 | [x] |
| H12 | Implement AgentState + Router Node | Code `AgentState(TypedDict)`, `router_node` dùng GPT-5.4 Nano phân loại intent (simple → fast_response, complex → core_agent). Theo pattern trong `LangGraphAgent.md` | 12/06 | [x] |
| H13 | Implement Core Agent Node + SQL Tool | Code `core_agent_node` dùng GPT-5.4 + `sql_query_tool` kết nối PostgreSQL thật. Agent phải query được điểm, tỷ lệ trượt từ DB | 12/06 | [x] |
| H14 | Implement ReAct Loop + ToolNode | Ghép `ToolNode(handle_tool_errors=True)`, conditional edges, vòng lặp ReAct. Compile graph hoàn chỉnh | 13/06 | [x] |
| H15 | Streamlit Prototype | Tạo app Streamlit đơn giản: input câu hỏi → gọi LangGraph agent → hiển thị output. Streaming nếu kịp | 13/06 | [x] |
| H16 | FastAPI Chat Endpoint | `POST /api/v1/chat` nhận message, invoke LangGraph agent, trả response (JSON hoặc SSE) | 14/06 | [x] |

### Phase 2: Expand + Gate G2 Deliverables (15–18/06)

| # | Task | Mô tả chi tiết | Deadline | Status |
|:-:|:-----|:----------------|:--------:|:------:|
| H17 | Thêm CLO Calculator Tool | Tool tính toán CLO achievement rate từ DB. Agent có thể trả lời "CLO nào đạt thấp nhất ở môn X?" | 15/06 | ✅ |
| H19 | Cập nhật README.md cho Gate G2 | Bổ sung: setup instructions chi tiết, danh sách env vars, 3–5 sample queries với expected output | 16/06 | ✅ |
| H21 | Prompt Tuning + Error Handling | Tinh chỉnh prompt templates theo cấp (Khoa/Ngành/Môn). Kiểm tra error handling 3 tầng hoạt động đúng | 18/06 | ✅ |
| H32 | Kịch bản Video Demo G2 | Viết scripts chi tiết (luồng flow, câu thoại, màn hình) cho Hiếu quay và edit video demo MVP dài 3 phút | 17/06 | ✅ |

> *Ghi chú: Task H18 (Chart Tool) đã gộp vào T28 (Report Tool), H20 (Eval) đã gộp vào H29 (RAGAS Eval - Phase 3).*

### Phase 2 mở rộng: W4 (19–24/06)

| # | Task | Mô tả chi tiết | Deadline | Status |
|:-:|:-----|:----------------|:--------:|:------:|
| H22 | Metric Engine — Health Score | Build logic tính Health Score tổng hợp (GPA, Fail Rate, CLO) cho từng node (Khoa/Ngành/Môn) | 20/06 | ✅ |
| H27 | Cấu hình Ngrok Public Tunnel | Cấu hình ngrok tunnel cho local, bypass cảnh báo trình duyệt phục vụ truy cập Demo 1 và Gate G2 | 14/06 | ✅ |
| H31 | Health Score UI Integration | Tích hợp gọi Health Score API hiển thị trên Academic Tree Dashboard | 16/06 | ✅ |
| H33 | Course Health Score UI | Tích hợp biểu diễn đồ hoạ Health Score trên giao diện Phân tích môn học, fix lỗi SQL Views không hiển thị | 17/06 | ✅ |
| H34 | Chuẩn hóa cấu trúc Khoa - Môn (OBE) | Dùng LLM map tự động 480 môn học vào 12 Khoa, cấu trúc lại DB, views và update Giao diện (thêm department_id) | 17/06 | ✅ |

> *Ghi chú: H23 (Vector Search RAG) **đã hủy** — chuyển Sprint 3. H24 (Auto-Analysis) đã chuyển cho Hưng (T28, T29 - Phase 3).*

### 🏗 Phase 5: Architecture 3-tier + Data Scale (20–21/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Depends on |
|:-:|:-----|:----------------|:--------:|:------:|:-----------|
| H45 | Nâng architecture 3-tier | Thiết kế và triển khai cấu trúc **Khoa → Ngành → Chuyên ngành**: entity model, Alembic migration, cập nhật views/metrics, sửa agent prompts + README diagram. Chốt spec drill-down Tree (Khoa mở ra Chuyên ngành) cho V36 | 20/06 | ⬜ | — |
| H46 | Seed đủ 1.300 sinh viên | Mở rộng seed từ ~700 → **≥ 1.300 SV** từ data crawl: map đúng chuyên ngành, cohort, enrollment, grades. Verify row counts + sample queries | 21/06 | ⬜ | H45, T44 |

### 🎯 Phase 3: Demo 1 Completion — Hoàng (16–20/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| H28 | SSE Streaming Response | Upgrade `/api/v1/chat` từ JSON → SSE (Server-Sent Events) streaming, token-by-token. Frontend nhận realtime typewriter effect | 16/06 | ✅ | **P0** |
| H30 | Agent Safety & Tools Evaluation | Đánh giá agents có tools: jailbreak resistance, PII detection, bias check. Tạo test suite safety | 28/06 | ⬜ | **P2** |

> [!NOTE]
> H30 (Agent Safety) là **ưu tiên thấp** — chỉ làm nếu còn kịp thời gian.

### 🚀 Phase 4: Sprint 2 Hoàn thiện — Hoàng (18–24/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| H35 | Thêm session lưu lịch sử chat | Implement session management lưu lịch sử chat: tạo/load/list sessions, persist messages theo thread_id vào DB, UI hiển thị sidebar danh sách sessions cũ | 18/06 | [x] | **P0** |
| H36 | Unit Tests — API Endpoints | Viết unit tests cho các API endpoints chính (chat, health, tree, auth) theo pattern trong Test.md: conftest.py fixtures, AsyncClient, mock LLM. Mục tiêu: ≥ 10 test cases, coverage ≥ 60% | 18/06 | ✅ | **P0** |
| H37 | Unit Tests — Agent Nodes & Routing | Viết tests cho từng LangGraph node (router, core_agent, format_response) và conditional routing logic. Dùng parametrize cho nhiều intent cases | 18/06 | ✅ | **P0** |
| H38 | RAGAS Evaluation — 10 Test Cases | Chạy RAGAS evaluation (Faithfulness, Answer Relevancy, Context Precision, Context Recall) trên ≥ 10 test cases thực tế từ domain đào tạo. Tạo eval dataset JSON | 18/06 | ✅ | **P1** |
| H39 | Evaluation Evidence Report | Tạo báo cáo Evaluation Evidence hoàn chỉnh: pytest output + coverage, RAGAS metrics table, performance metrics, code traceability. Lưu trong `docs/12-Evaluation/` | 18/06 | ✅ | **P1** |

> [!NOTE]
> H36–H39 ✅ done — nộp cùng Gate G2-5. Báo cáo: [gate2_eval_report.md](../12-Evaluation/gate2_eval_report.md).

### 🎯 Gate G3 — Hoàng AI/Evaluation (22–26/06)

> **Quy tắc:** **1 task / ngày** — tránh dồn 25/06.

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| H44 | Demo Video Narrative | Viết kịch bản pitch + live demo flow 3–5 phút cho Hiếu quay Gate G3. Phối hợp highlight agent, dashboard, báo cáo | 22/06 | ⬜ | **P1** |
| H40 | Guardrails — Prompt & Report Safety | Bổ sung guardrails phía AI: jailbreak resistance, PII filter, giới hạn phạm vi câu trả lời, kiểm tra output report trước khi trả user | 23/06 | ⬜ | **P0** |
| H42 | Evaluation Metrics Framework | Thiết lập baseline cho latency p95, tool success rate, answer quality; tích hợp vào eval pipeline và log có cấu trúc | 24/06 | ⬜ | **P0** |
| H43 | Cost Report | Ước tính cost / user / month từ usage giả định + log thực tế (router vs core model). Lưu trong `docs/12-Evaluation/` | 25/06 | ⬜ | **P0** |
| H41 | ML Baseline + Explanation | Xây baseline dự đoán pass/trượt từng môn: metrics (Recall, Precision, F1, PR-AUC), cutoff, model version, explanation template. Phối hợp Hưng expose API | 26/06 | ⬜ | **P0** |

**Tổng: 23 task Sprint 2 + 5 task Gate G3 · Trọng tâm: Architecture 3-tier + Seed 1.3k + G3 Eval (1 task/ngày)**

---

## 🟢 Hưng — Backend Developer + DevOps

### Phase 1: Backend Foundation cho Agent (11–14/06)

| # | Task | Mô tả chi tiết | Deadline | Status |
|:-:|:-----|:----------------|:--------:|:------:|
| T11 | Database Migration + Seed Runner | Alembic migration từ `schema.sql`. Script seed data runner chạy trên Docker. Đảm bảo DB sẵn sàng cho Agent | 11/06 | ✅ |
| T12 | SQLAlchemy Models + DB Session | ORM models cho core entities (Department, Program, Course, Student, Grade, Section, CLO). DB session factory | 12/06 | ✅ |
| T13 | CRUD API — Core Entities (P0) | Implement CRUD: `/departments`, `/programs`, `/courses`, `/students`, `/grades`. Swagger docs tự động | 13/06 | ✅ |
| T14 | Tree Metrics API | `GET /api/v1/tree` — trả về tree structure với metrics (student count, avg GPA, fail rate) cho từng node. Hỗ trợ Academic Tree component | 14/06 | ✅ |

### Phase 2: Mở rộng + DevOps (15–18/06)

| # | Task | Mô tả chi tiết | Deadline | Status |
|:-:|:-----|:----------------|:--------:|:------:|
| T16 | Unit Tests — Backend | Viết unit tests cho CRUD APIs + DB models. Mục tiêu: ≥ 10 test cases, chạy qua CI/CD | 16/06 | ✅ |
| T17 | Chốt ORM + Alembic Baseline | Đồng bộ ORM với thiết kế OLTP, tạo migration baseline, seed được database sạch và ghi hướng dẫn rollout | 17/06 | ✅ |
| T18 | PR Cleanup — đảm bảo ≥ 10 PRs | Review + merge các PRs tồn đọng. Tạo PRs mới cho các features đã code trực tiếp. Đảm bảo repo có ≥ 10 merged PRs | 18/06 | ✅ |

> *Ghi chú: Task T15 (SSE Streaming) đã chuyển cho Hoàng (H28 - Phase 3).*

### Phase 2 mở rộng: W4 (19–24/06)

| # | Task | Mô tả chi tiết | Deadline | Status |
|:-:|:-----|:----------------|:--------:|:------:|
| T19 | CLO/PLO Backend Logic | Implement tính toán CLO/PLO achievement: query grades × CLO mapping → tính tỷ lệ đạt | 20/06 | ✅ |
| T27 | Overview KPI Dashboard | Xây dựng UI (Frontend) và API (Backend) hiển thị Dashboard tổng quan metric sức khỏe đào tạo trước khi vào Tree | 20/06 | ✅ |

### 🎯 Phase 3: Demo 1 Completion — Hưng (16–20/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| T28 | Report Tool Backend | Implement `report_tool` cho Agent: nhận node context (ngành/khoa) → query DB → sinh báo cáo phân tích tự động | 16/06 | ✅ | **P0** |
| T29 | Prompt Engineering Report | Thiết kế prompt templates theo cấp (Khoa/Ngành/Môn) cho auto-report khi click node. Phối hợp Hiếu (UI) + Hoàng (Agent) | 16/06 | ✅ | **P0** |
| T30 | Auth Login Backend | `POST /api/v1/auth/login` + `GET /api/v1/auth/me` + JWT token + role-based middleware (manager full / lecturer view-only) | 16/06 | ✅ | **P0** |

> [!NOTE]
> T31 (Failure Analysis + Guardrails) đã chuyển sang Gate G3 — T40 (Hưng) + H40 (Hoàng).

### 🚀 Phase 4: Sprint 2 Hoàn thiện — Hưng (18–24/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| T32 | Tool Report CLO — Cải thiện môn học | Implement tool report CLO cho agent: phân tích CLO achievement → đề xuất cải thiện môn học. Direct kết quả tới tab Báo cáo trên frontend. Hiển thị dạng artifact (markdown rendered), có khả năng lưu (persist to DB) và chỉnh sửa (inline edit) | 18/06 | ✅ | **P0** |

### 🏗 Phase 5: Architecture 3-tier — Hưng (20–21/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Depends on |
|:-:|:-----|:----------------|:--------:|:------:|:-----------|
| T44 | Tree API + Migration 3-tier | Alembic migration `specializations`, cập nhật ORM + `GET /api/v1/tree`: Khoa → **Chuyên ngành** → Ngành → Môn. CRUD endpoints liên quan. Handoff spec từ H45 | 20/06 | ⬜ | H45 |

### 🎯 Gate G3 — Hưng Backend/DevOps (22–25/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| T39 | Production Deploy — Backend | Deploy FastAPI lên Render: env vars, health check, CORS production, migration rollout. Verify `/health` và chat endpoint | 22/06 | ⬜ | **P0** |
| T40 | Guardrails — Backend & RBAC | Retry/fallback cho agent/report, RBAC guardrail theo role, giới hạn tool execution, structured error logs | 23/06 | ⬜ | **P0** |
| T41 | Session + Cookie + Logs Schema | Cơ chế session/cookie (refresh/expire), đồng bộ JWT; schema riêng cho session, activity log, agent run log | 24/06 | ⬜ | **P1** |
| T42 | Hoàn thiện DWH + ETL Schedule | ETL refresh theo lịch, DQ checks nâng cao, đối soát OLTP-DWH cho dashboard/report | 25/06 | ⬜ | **P1** |
| T43 | Report Agent Backend | Cập nhật report agent hiểu context Khoa/Ngành/Chuyên ngành/Môn/Lớp, sinh báo cáo đúng template, persist artifact | 26/06 | ⬜ | **P1** |

**Tổng Gate G3 (BTC):** T39, T40 · Stretch: T41–T43

---

## 🔵 Hiếu — Frontend Developer + QA

### Phase 1: Streamlit Hỗ trợ + FE Preparation (11–14/06)

| # | Task | Mô tả chi tiết | Deadline | Status |
|:-:|:-----|:----------------|:--------:|:------:|
| V11 | Academic Tree ↔ Mock API | Kết nối Tree component với mock JSON API (chuẩn bị cho khi BE API sẵn sàng). Click node → hiện Detail Panel | 12/06 | ✅ |
| V12 | Chat UI Component (Static) | Build Chat interface: input box, message list (user/AI), typing indicator, suggested questions area | 13/06 | ✅ |
| V13 | Streamlit UI Polish | Hỗ trợ Hoàng polish Streamlit prototype: thêm sidebar, format output đẹp hơn, thêm example queries | 14/06 | ✅ |
| V14 | Demo 1 Preparation | Chuẩn bị script demo, test flow end-to-end trên Streamlit. Kiểm tra mọi thứ chạy ổn định | 14/06 | ✅ |

### Phase 2: Gate G2 + Next.js Integration (15–18/06)

| # | Task | Mô tả chi tiết | Deadline | Status |
|:-:|:-----|:----------------|:--------:|:------:|
| V15 | Quay Video Demo 3 phút | Quay + edit video MVP Demo cho Gate G2. Show: user mở app → nhập câu hỏi → agent xử lý → trả output. Có voiceover/subtitle | 17/06 | ✅ |
| V16 | Academic Tree ↔ Real API | Kết nối Tree component với `/api/v1/tree` thật. Dynamic data, loading states, error handling | 18/06 | ✅ |

> *Ghi chú: Task V17 (Chat SSE) đã gộp vào V25 (Phase 3).*

### 🎯 Phase 3: Demo 1 Completion — Hiếu (16–20/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| V24 | Tree Node → Chat AI Navigation | Click 1 node trong Academic Tree → điều hướng tới Chat AI page với context ngành/khoa. Tự động trigger báo cáo về node đó | 16/06 | ✅ | **P0** |
| V25 | Chat UI ↔ SSE Streaming | Kết nối Chat component với SSE endpoint từ Hoàng. Typewriter effect, loading states, error handling | 16/06 | ✅ | **P0** |
| V26 | Login UI ↔ Auth Backend | Kết nối Login page với `/api/v1/auth/login` từ Hưng. Store JWT token, protected routes, redirect unauthorized | 16/06 | ✅ | **P0** |

### Phase 2 mở rộng (deprioritized)

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| V18 | CRUD Pages (Courses, Students) | Trang quản lý: danh sách, thêm/sửa/xóa. Dùng shadcn/ui Table + Dialog + Form | 22/06 | ⬜ | P1 |
| V19 | Chart Component | Render biểu đồ từ chart spec (JSON) trả về bởi Agent. Dùng Recharts hoặc Chart.js | 23/06 | ⬜ | P1 |
| V20 | Prediction UI | Hiển thị xác suất pass/trượt từng môn và tổng tín chỉ pass/trượt kỳ vọng | 23/06 | ⬜ | P1 |
| V21 | Responsive + Dark Mode | Đảm bảo layout responsive trên mobile/tablet. Toggle dark mode hoạt động đúng | 24/06 | ⬜ | P1 |
| V22 | FE Unit Tests | Viết tests cho core components: Tree, Chat, DetailPanel. Mục tiêu: ≥ 5 test suites | 24/06 | ⬜ | P1 |

### 🚀 Phase 4: Sprint 2 Hoàn thiện — Hiếu (18–24/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| V27 | Lấy thêm token data sinh viên | Bổ sung token data API về thông tin sinh viên (SV count, demographics, enrollment status) để enrich context cho chatbot và dashboard | 18/06 | ✅ | **P0** |
| V28 | Sửa UI Academic Tree — Multi-prompt | Click vào từng ngành/khoa trong Academic Tree sẽ hiển thị danh sách nhiều câu hỏi prompt gợi ý (3-5 câu) để chuyển hướng sang chatbot. Thay vì chỉ 1 câu mẫu, chưa hiển thị khi click | 18/06 | ✅ | **P0** |
| V29 | Tạo widget thông tin cho các chỉ số | Thiết kế và implement các widget cards hiển thị KPI chỉ số (Health Score, GPA avg, Fail Rate, CLO Attainment) trên dashboard, với micro-animations và responsive layout | 20/06 | ✅ | **P1** |
| V30 | UX hướng dẫn người dùng theo workflow | Implement guided UX flow (onboarding tour / step-by-step wizard) hướng dẫn người dùng mới: Login → Dashboard → Tree → Chat → Báo cáo. Dùng tooltip hoặc overlay guide | 22/06 | ✅ | **P1** |

### 🏗 Phase 5: Architecture 3-tier — Hiếu (21/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Depends on |
|:-:|:-----|:----------------|:--------:|:------:|:-----------|
| V36 | Academic Tree — Khoa → Chuyên ngành | Sửa Academic Tree: expand node **Khoa** hiển thị danh sách **Chuyên ngành** (không còn nhảy thẳng Ngành). Cập nhật labels, drill-down, multi-prompt, context chat | 21/06 | ⬜ | T44 |

### 🎯 Gate G3 — Hiếu Frontend/QA (22–25/06)

| # | Task | Mô tả chi tiết | Deadline | Status | Priority |
|:-:|:-----|:----------------|:--------:|:------:|:--------:|
| V31 | Production Deploy — Frontend | Deploy Next.js lên Vercel: env vars, API URL production, build verify. Phối hợp Hưng test end-to-end | 22/06 | ⬜ | **P0** |
| V32 | Production Smoke Test | Test production URL: login, dashboard, tree, chat, report. Ghi log lỗi UI/blocker vào checklist QA | 23/06 | ⬜ | **P0** |
| V33 | Session/Cookie UI Integration | Tích hợp refresh session/cookie với auth backend, protected routes, logout/expire handling | 24/06 | ⬜ | **P1** |
| V34 | Demo Video Draft — Recording | Quay video draft 3–5 phút: pitch slides + live demo production URL (agent, dashboard, báo cáo) | 24/06 | ⬜ | **P0** |
| V35 | Demo Video Final + URL Verify | Edit video, subtitle/voiceover, verify production URL ổn định cho Gate G3 nộp | 25/06 | ⬜ | **P0** |

**Tổng: 20 task Sprint 2 + 5 task Gate G3 · Trọng tâm: Tree 3-tier + Deploy QA + Demo Video G3**

---

## Timeline tuần tự — 20–25/06 (không block cross-team)

> **Quy tắc:** Mỗi người **1 task chính/ngày**. Task downstream chỉ bắt đầu sau khi upstream merge (handoff standup 09:00).

| Ngày | Hoàng | Hưng | Hiếu | Handoff |
|:-----|:------|:-----|:-----|:--------|
| **20/06** | **H45** — Architecture 3-tier (schema spec + diagram) | **T44** — Migration + Tree API *(sau khi H45 chốt schema buổi sáng)* | — *(chờ T44)* | H45 → T44 |
| **21/06** | **H46** — Seed ≥ 1.300 SV | Buffer / hỗ trợ verify seed | **V36** — Tree UI Khoa→Chuyên ngành | T44 → V36; H45+T44 → H46 |
| **22/06** | **H44** — Demo narrative *(trước video Hiếu)* | **T39** — Deploy backend | **V31** — Deploy frontend | H46 → H44; T44 → T39 |
| **23/06** | **H40** — Guardrails AI | **T40** — Guardrails BE | **V32** — Smoke test | H44 → H40; T39+V31 → V32 |
| **24/06** | **H42** — Eval metrics ✅ G3-2 | T41 *(stretch)* | **V34** — Quay video | H40 → H42; V32+H44 → V34 |
| **25/06** | **H43** — Cost report ✅ G3-5 | T42 *(stretch, buffer)* | **V35** — Edit + nộp video ✅ G3-4 | H42 → H43; V34 → V35 |
| **26/06** | **H41** — ML baseline *(stretch)* | **T43** *(stretch)* | V33 *(stretch)* | T42 → H41 |

```mermaid
gantt
    title Sprint 2 Close-out — Sequential (20–25/06)
    dateFormat YYYY-MM-DD
    axisFormat %d/%m

    section Hoàng
    H45 Architecture 3-tier     :h45, 2026-06-20, 1d
    H46 Seed 1300 students      :h46, after h45, 1d
    H44 Demo narrative G3       :h44, 2026-06-22, 1d
    H40 Guardrails AI           :h40, after h44, 1d
    H42 Eval metrics            :h42, after h40, 1d
    H43 Cost report             :h43, after h42, 1d
    H41 ML baseline             :h41, 2026-06-26, 1d

    section Hưng
    T44 Tree API 3-tier         :t44, 2026-06-20, 1d
    T39 Deploy backend          :t39, 2026-06-22, 1d
    T40 Guardrails              :t40, after t39, 1d
    T41 Session logs            :t41, after t40, 1d
    T42 DWH                     :t42, 2026-06-25, 1d
    T43 Report agent            :t43, 2026-06-26, 1d

    section Hiếu
    V36 Tree UI 3-tier          :v36, 2026-06-21, 1d
    V31 Deploy frontend         :v31, 2026-06-22, 1d
    V32 Smoke test              :v32, after v31, 1d
    V34 Video record            :v34, 2026-06-24, 1d
    V35 Video final G3          :v35, 2026-06-25, 1d
```

---

## Timeline trực quan (lịch sử Sprint)

```
Phase 1: MVP Sprint (11–14/06) — ⚡ DEMO 1 ✅ DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         11(T4)   12(T5)   13(T6)   14(T7)
         ──────   ──────   ──────   ──────

Hoàng    H11 ✅   H12,H13  H14,H15  H16
         Seed     Agent✅  ReAct✅  Chat API✅
         Data     +Router  +Tools   +Demo
                  +SQL     +Strmlt

Hưng     T11 ✅   T12 ✅   T13 ✅   T14
         DB       ORM      CRUD     Tree
         Migrate  Models   APIs     Metrics

Hiếu     (prep)   V11 ✅   V12,V13  V14 ✅
                   Tree↔    Chat UI  Demo
                   API      +Strmlt✅ Prep

         ═══════════════════════════════════
              ✅ DEMO 1 MVP: 14/06 (DONE)
         ═══════════════════════════════════

Phase 2: Gate G2 Deliverables (15–18/06)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         15(CN)   16(T2)   17(T3)   18(T4)
         ──────   ──────   ──────   ──────

Hoàng    H17      H19      (Buffer) H21
         CLO      README            Prompt
         Tool                       Tuning

Hưng     (Buffer) T16      T17      T18
                  Unit     ORM      PRs
                  Tests    Baseline ≥ 10

Hiếu     (Buffer) V16      V15      (Buffer)
                  Tree↔    Video
                  Real API Demo 3'

         ═══════════════════════════════════
              🚀 GATE G2 DEADLINE: 18/06
         ═══════════════════════════════════

🎯 Phase 3: Demo 1 Completion (16–20/06) — FAST TRACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         16(T2)   17(T3)   18-19    20(T7)
         ──────   ──────   ──────   ──────

Hoàng    H28      H29      (Buffer) H30
         SSE      RAGAS             Agent
         Stream   Eval              Safety(P2)

Hưng     T28,T29  T14      (Buffer) Gate G3
         Report   Tree              Guardrails
         +Auth(T30)Metrics          Analysis

Hiếu     V24,V25  V15      (Buffer) (Buffer)
         +V26     Video
         Tree/Chat Demo 3'

         ═══════════════════════════════════
           🎯 DEMO 1 COMPLETE: 17/06
         ═══════════════════════════════════
```

---

## Dependencies giữa các task

```mermaid
graph LR
    subgraph "Phase 1 — Critical Path (Demo 1)"
        H11["H11: Seed Data"] --> H13["H13: Agent + SQL Tool"]
        T11["T11: DB Migration"] --> H11
        T11 --> T12["T12: ORM Models"]
        T12 --> T13["T13: CRUD APIs"]
        
        H12["H12: Router Node"] --> H14["H14: ReAct Loop"]
        H13 --> H14
        H14 --> H15["H15: Streamlit"]
        H14 --> H16["H16: Chat API"]
        
        T13 --> T14["T14: Tree Metrics API"]
        
        V11["V11: Tree ↔ Mock"] --> V14["V14: Demo Prep"]
        V12["V12: Chat UI"] --> V14
        H15 --> V13["V13: Streamlit Polish"]
        V13 --> V14
    end

    subgraph "Phase 2 — Gate G2 (18/06)"
        H16 --> T15["T15: SSE Streaming"]
        H14 --> H17["H17: CLO Tool"]
        H14 --> H18["H18: Chart Tool"]
        
        H15 --> H19["H19: README Update"]
        H15 --> H20["H20: Eval 5 Tests"]
        
        T14 --> V16["V16: Tree ↔ Real API"]
        T15 --> V17["V17: Chat ↔ SSE"]
        
        V14 --> V15["V15: Video Demo 3'"]
        
        T13 --> T16["T16: Unit Tests"]
        T18["T18: ≥10 PRs"]
    end

    subgraph "W4 — Expand"
        H17 --> H22["H22: Metric Engine"]
        H22 --> H24["H24: Auto-Analysis"]
        T12 --> T19["T19: CLO/PLO Backend"]
        T13 --> V18["V18: CRUD Pages"]
        H18 --> V19["V19: Chart Component"]
    end

    subgraph "Phase 5 — Architecture 3-tier (20–21/06)"
        H45["H45: Schema 3-tier"] --> T44["T44: Tree API + Migration"]
        T44 --> V36["V36: Tree UI Chuyên ngành"]
        H45 --> H46["H46: Seed 1.300 SV"]
        T44 --> H46
    end

    subgraph "Gate G2 Testing — ✅ Done (18/06)"
        H36["H36: API Tests ✅"] --> H37["H37: Agent Tests ✅"]
        H37 --> H38["H38: RAGAS ✅"]
        H38 --> H39["H39: Eval Report ✅"]
    end

    subgraph "Gate G3 — Hoàng (22–26/06, 1 task/ngày)"
        H46["H46: Seed 1.300 SV"] --> H44["H44: Demo Narrative"]
        H44 --> H40["H40: Guardrails AI"]
        H40 --> H42["H42: Eval Metrics"]
        H42 --> H43["H43: Cost Report"]
        T42["T42: DWH"] --> H41["H41: ML Baseline"]
        H43 --> H41
    end

    subgraph "Gate G3 Deploy chain (22–25/06)"
        V36 --> V31["V31: Deploy FE"]
        T44 --> T39["T39: Deploy BE"]
        T39 --> T40["T40: Guardrails"]
        V31 --> V32["V32: Smoke Test ✅ G3-1"]
        H44 --> V34["V34: Record Video"]
        V32 --> V34
        V34 --> V35["V35: Final Video ✅ G3-4"]
    end
```

---

## User Flow chính cho Demo 1 Completion

> Flow end-to-end hoàn thiện cho Demo 1:

```
1. User đăng nhập (Login page → JWT auth → phân quyền manager/lecturer)
2. User xem Overview KPI Dashboard (tổng quan sức khỏe đào tạo)
3. User mở Academic Tree → navigate **Khoa → Chuyên ngành → Ngành → Môn**
4. User click 1 node (VD: "Chuyên ngành Công nghệ phần mềm")
5. Hệ thống điều hướng tới Chat AI page với context = chuyên ngành / ngành đã chọn
6. Agent tự động tạo báo cáo phân tích về ngành đó (report_tool)
7. Response streaming qua SSE → typewriter effect trên UI
8. User có thể hỏi thêm câu hỏi follow-up
9. Hiển thị 3 suggested follow-up questions
```

> Flow cũ (Streamlit MVP — đã hoàn thành):

```
1. User mở Streamlit app
2. User nhập câu hỏi → Agent xử lý → trả output
```

---

## Eval Evidences — 10 Test Cases Plan

| # | Input Query | Expected Tool Calls | Pass Criteria |
|:-:|:------------|:-------------------|:--------------|
| TC1 | "Top 5 môn trượt cao nhất ngành CNTT?" | `sql_query_tool` | Đúng 5 môn, đúng % |
| TC2 | "GPA trung bình K21 CNTT?" | `sql_query_tool` | GPA chính xác |
| TC3 | "So sánh trượt Cơ sở dữ liệu K21 vs K22" | `sql_query_tool` (2 lần) | So sánh 2 khóa |
| TC4 | "Chào bạn, chức năng chính là gì?" | Không gọi tool | Router → fast_response |
| TC5 | "CLO thấp nhất môn Tiếng Anh 1?" | `sql_query_tool` | Trả về mã CLO + % |
| TC6 | "K21 CNTT có bao nhiêu sinh viên?" | `sql_query_tool` | Trả về đúng số SV |
| TC7 | "3 sinh viên GPA cao nhất ngành TTNT?" | `sql_query_tool` | Tên + GPA top 3 |
| TC8 | "Tỷ lệ pass Hệ quản trị CSDL?" | `sql_query_tool` | Đúng tỷ lệ % pass |
| TC9 | "Điểm Toán cao cấp 1: K22 vs K21?" | `sql_query_tool` (2 lần) | So sánh điểm 2 khóa |
| TC10| "Môn đk nhiều nhất ngành Cơ điện tử?" | `sql_query_tool` | Đúng tên môn + số SV |

> Mỗi test case sẽ được chụp screenshot output thực tế + đánh giá (Pass/Fail/Partial). Lưu trong `docs/09-Evaluation/gate2_eval_evidences.md`.

---

## Definition of Done — Sprint 2

### Change Request: Database Modernization + Analytics Foundation

Để toàn team cùng đi trên một database thống nhất, Sprint 2 thực hiện theo thứ tự: chốt ORM → migration baseline → reset local một lần → DWH/ETL → ML prediction → UI.

| # | Task | Owner | Deadline | Status |
|:-:|:-----|:-----:|:--------:|:------:|
| T23 | Đồng bộ ORM với schema, chốt Program-Course many-to-many, bỏ model source trùng | Hưng | 19/06 | ✅ |
| T24 | Sửa seed cohort/import điểm thành phần và tạo Alembic baseline | Hưng | 20/06 | ✅ |
| T25 | Điều phối một lần reset DB local và xác minh revision/row counts toàn team | Hưng + cả team | 20/06 | ✅ |
| T26 | Tạo schema `dwh`, ETL idempotent và data quality checks | Hưng | 23/06 | ✅ |
| H25 | Tạo schema `ml`, baseline dự đoán pass/trượt từng môn, chống leakage | Hoàng | 23/06 | ⬜ |
| H26 | Tổng hợp expected passed/failed credits và báo cáo evaluation | Hoàng | 24/06 | ⬜ |
| V23 | UI prediction từng môn và tổng tín chỉ pass/trượt kỳ vọng | Hiếu | 24/06 | ⬜ |

**Definition of Done bổ sung:**

- Chỉ còn một ORM model source và có Alembic baseline migration.
- Cả team xác nhận cùng migration revision sau đợt reset local.
- Một KPI dashboard được đọc từ DWH và đối soát khớp OLTP.
- Có file/report metric của model; tối thiểu gồm Recall, Precision, F1 và PR-AUC.
- Prediction lưu xác suất pass/trượt từng môn, model version, cutoff và explanation.
- API/UI hiển thị expected passed/failed credits theo sinh viên-học kỳ.
- Demo được luồng seed/import -> refresh DWH -> batch score -> xem prediction.

Tham khảo [DatabaseModernizationPlan.md](../10-References/DatabaseModernizationPlan.md) và [ML_DWH_Architecture.md](../10-References/ML_DWH_Architecture.md).

### Gate G2 Checklist (Deadline: 18/06)

| # | Deliverable | Checklist | Owner | Status |
|:-:|:------------|:----------|:-----:|:------:|
| G2-1 | MVP Demo Video | Video 3 phút, quay rõ user flow end-to-end, có voiceover/subtitle | Hiếu | ✅ |
| G2-2 | Architecture Diagram | 3 Mermaid diagrams trong README (system, deployment, agent flow) | Hoàng | ✅ |
| G2-3 | ≥ 10 PR Merged | Đếm trên GitHub, bổ sung nếu thiếu, mỗi PR có description + review | Cả team | ✅ |
| G2-4 | README.md | Setup instructions, env vars list, ≥ 3 sample queries | Hoàng | ✅ |
| G2-5 | Eval Evidences | 10 test cases AI chatbot + [gate2_eval_report.md](../12-Evaluation/gate2_eval_report.md) | Hoàng | ✅ |

### Sprint 2 Overall Checklist (Deadline: 24/06)

| Category | Checklist | Owner |
|:---------|:----------|:-----:|
| **Agent** | LangGraph agent chạy end-to-end, ≥ 3 tools (SQL, CLO, Chart), ReAct loop, error handling 3 tầng | Hoàng |
| **Backend** | CRUD APIs hoạt động, Tree Metrics API, Chat endpoint, SSE streaming | Hưng |
| **Frontend** | Chat UI + Tree component kết nối API thật, CRUD pages cơ bản | Hiếu |
| **Data** | Seed data trong PostgreSQL, **≥ 1.300 students** với grades thật | Hoàng (H46) + Hưng (T44) |
| **Testing** | ≥ 10 unit tests BE, ≥ 5 FE test suites, 10 eval evidences | Cả team |
| **DevOps** | Docker chạy đầy đủ services, CI/CD pass trên mọi PR | Hưng |
| **Docs** | README cập nhật, architecture diagrams đúng, Journal + Worklog | Cả team |

---

## 🎯 Gate G3 — Production-ready

> **Deadline:** 25/06/2026 23:59  
> **Trạng thái:** 🟢 Active  
> **XP khi pass:** +150 XP / member  
> **Mục tiêu BTC:** Deployed production URL · Evaluation Metrics · Guardrails · Demo video draft · Cost report.

> [!IMPORTANT]
> **Phạm vi Gate G3 (BTC):** Chỉ 5 deliverables bên dưới. Mọi task khác (3-tier architecture, ML baseline, DWH, report agent…) là **Sprint 2 stretch** — không block nộp Gate G3.

### ✅ Gate G3 Compliance — 5 deliverables BTC (deadline ≤ 25/06 23:59)

| # | Deliverable BTC | Yêu cầu | Task nộp bộ | Deadline nộp | Đủ deadline? |
|:-:|:----------------|:---------|:------------|:-------------|:-------------|
| G3-1 | **Deployed production URL** | Vercel / Railway / Cloud Run + verify E2E | T39 (BE Render) · V31 (FE Vercel) · V32 (smoke test URL) | **23/06** | ✅ |
| G3-2 | **Evaluation Metrics** | ≥ 2 metrics có baseline số (latency p95, tool success rate, answer quality…) | H42 (metrics framework + baseline table trong `docs/12-Evaluation/`) | **24/06** | ✅ |
| G3-3 | **Guardrails** | Auth scope, prompt/report safety, tool execution limits | H40 (AI guardrails) · T40 (RBAC + tool limits + error logs) | **23/06** | ✅ |
| G3-4 | **Demo video draft** | 3–5 phút: pitch slides + live demo trên production URL | H44 (kịch bản 22/06) · V34 (quay 24/06) · V35 (edit + nộp 25/06) | **25/06** | ✅ |
| G3-5 | **Cost report** | Ước tính cost / user / month từ usage giả định (+ log thực tế nếu có) | H43 (report trong `docs/12-Evaluation/`) | **25/06** | ✅ |

**Kết luận:** Timeline hiện tại **đáp ứng đủ 5/5 deliverables Gate G3** trước 25/06 23:59. Hoàng ngày 25/06 chỉ còn **H43 (Cost report)** — 1 deliverable BTC.

### Gate G3 — Checklist nộp (25/06)

| # | Nộp gì | File / URL | Owner |
|:-:|:-------|:-----------|:-----:|
| 1 | Production URL (FE + BE) | URL Vercel + Render trong README | Hưng + Hiếu |
| 2 | Eval metrics baseline | `docs/12-Evaluation/` — bảng latency, tool success, quality | Hoàng |
| 3 | Guardrails evidence | Mô tả + code: H40 prompts, T40 RBAC/tool limits | Hoàng + Hưng |
| 4 | Demo video draft | File video 3–5 phút (pitch + live demo) | Hiếu |
| 5 | Cost report | `docs/12-Evaluation/cost_report.md` (hoặc tương đương) | Hoàng |

### Deliverables Gate G3 (mapping task)

| # | Deliverable | Task map | Status |
|:-:|:------------|:---------|:------:|
| G3-1 | Deployed production URL | T39, V31, V32 | ⬜ |
| G3-2 | Evaluation Metrics | H42 | ⬜ |
| G3-3 | Guardrails | H40, T40 | ⬜ |
| G3-4 | Demo video draft | H44, V34, V35 | ⬜ |
| G3-5 | Cost report | H43 | ⬜ |

### Sprint 2 stretch — KHÔNG thuộc Gate G3 BTC

| Hạng mục | Task | Deadline | Ghi chú |
|:---------|:-----|:--------:|:--------|
| Architecture 3-tier | H45, T44, V36 | 20–21/06 | Enabler cho Demo 2, không nộp Gate G3 |
| Seed 1.300 SV | H46 | 21/06 | Data scale |
| DWH + ETL | T42 | 26/06 | Sprint 2 DoD, lùi sau Gate G3 |
| Report agent backend | T43 | 26/06 | Sprint 2 feature |
| ML baseline | H41 | 26/06 | Sprint 2 DoD (H25), sau T42 |
| Session/logs | T41, V33 | 24/06 | Production polish, không bắt buộc Gate G3 |
| Agent safety | H30 | 28/06 | P2 |

### Gate G3 Timeline — critical path (deadline 25/06)

| Ngày | Hoàng *(Gate G3)* | Hưng *(Gate G3)* | Hiếu *(Gate G3)* |
|:-----|:------------------|:-----------------|:-----------------|
| **20/06** | H45 *(stretch)* | T44 *(stretch)* | — |
| **21/06** | H46 *(stretch)* | verify seed | V36 *(stretch)* |
| **22/06** | **H44** — kịch bản video | **T39** — deploy BE | **V31** — deploy FE |
| **23/06** | **H40** — guardrails AI | **T40** — guardrails BE | **V32** — smoke test URL ✅ G3-1 |
| **24/06** | **H42** — eval metrics ✅ G3-2 | T41 *(stretch)* | **V34** — quay video |
| **25/06** | **H43** — cost report ✅ G3-5 | T42 *(stretch, buffer)* | **V35** — edit + nộp video ✅ G3-4 |

> **23/06:** G3-1 done (URL live + smoke pass). **24/06:** G3-2 done. **25/06:** G3-4 + G3-5 nộp.

### Gate G3 Timeline — tuần tự đầy đủ 20–26/06

| Ngày | Hoàng | Hưng | Hiếu |
|:-----|:------|:-----|:-----|
| **20/06** | H45 | T44 | — |
| **21/06** | H46 | Buffer / verify seed | V36 |
| **22/06** | H44 | T39 | V31 |
| **23/06** | H40 | T40 | V32 |
| **24/06** | H42 | T41 | V34 |
| **25/06** | H43 | T42 | V35 |
| **26/06** | H41 | T43 | — |

### Gate G3 Task Summary — Hoàng (1 task/ngày)

| # | Task | Owner | Deadline | Priority | Depends on |
|:-:|:-----|:-----:|:--------:|:--------:|:-----------|
| H45 | Architecture 3-tier Khoa/Ngành/Chuyên ngành | Hoàng | 20/06 | **P0** | — |
| H46 | Seed ≥ 1.300 sinh viên | Hoàng | 21/06 | **P0** | H45, T44 |
| H44 | Demo Video Narrative | Hoàng | 22/06 | **P1** | — |
| H40 | Guardrails — Prompt & Report Safety | Hoàng | 23/06 | **P0** | H44 |
| H42 | Evaluation Metrics Framework | Hoàng | 24/06 | **P0** | H40 |
| H43 | Cost Report | Hoàng | 25/06 | **P0** | H42 |
| H41 | ML Baseline + Explanation | Hoàng | 26/06 | **P0** | T42 |
| H30 | Agent Safety (P2) | Hoàng | 28/06 | **P2** | H40 |
| T44 | Tree API + Migration 3-tier | Hưng | 20/06 | **P0** | H45 |
| V36 | Academic Tree — Khoa → Chuyên ngành | Hiếu | 21/06 | **P0** | T44 |
| T39 | Production Deploy — Backend | Hưng | 22/06 | **P0** | T44 |
| T40 | Guardrails — Backend & RBAC | Hưng | 23/06 | **P0** | T39 |
| T41 | Session + Cookie + Logs Schema | Hưng | 24/06 | **P1** | T40 |
| T42 | Hoàn thiện DWH + ETL Schedule | Hưng | 25/06 | **P1** | H46 |
| T43 | Report Agent Backend | Hưng | 26/06 | **P1** | T42 |
| V31 | Production Deploy — Frontend | Hiếu | 22/06 | **P0** | V36 |
| V32 | Production Smoke Test | Hiếu | 23/06 | **P0** | V31, T39 |
| V33 | Session/Cookie UI Integration | Hiếu | 24/06 | **P1** | T41 |
| V34 | Demo Video Draft — Recording | Hiếu | 24/06 | **P0** | V32, H44 |
| V35 | Demo Video Final + URL Verify | Hiếu | 25/06 | **P0** | V34 |

> **Gate G2:** ✅ Submitted 18/06. **Gate G3 BTC:** 5/5 deliverables có deadline ≤ 25/06. Stretch tasks (H41, T43…) lùi 26/06+.

---

## Risks Sprint 2

| Risk | Likelihood | Impact | Mitigation |
|:-----|:----------:|:------:|:-----------|
| OpenAI API key chưa có / rate limited | Trung bình | Cao | Chuẩn bị API key sớm (11/06). Có fallback: dùng model rẻ hơn (GPT-5.4 Nano cho cả 2 node) |
| Agent output không ổn định / hallucinate | Cao | Cao | Prompt engineering kỹ, SQL tool chỉ cho SELECT, test 5 cases sớm (trước 17/06) |
| Chỉ có 4 ngày cho Demo 1 (11–14/06) | Cao | Cao | Streamlit MVP first (không Next.js). Chỉ cần 1 flow chạy được |
| DB seed data chưa đủ / sai format | Trung bình | Trung bình | Chạy seed script ngày đầu (11/06), verify data trước khi build agent |
| Không đủ 10 PR merged | Thấp | Trung bình | Tạo PR cho mọi feature, kể cả docs changes. Review nhanh trong team |
| Migration 3-tier làm break Tree/API cũ | Trung bình | Cao | H45→T44→V36 tuần tự 20–21/06; reset DB có kiểm soát sau T44 |
| Seed 1.300 SV chưa đủ data crawl | Trung bình | Trung bình | H46 chạy sau migration; verify counts trước deploy 22/06 |

---

## Sprint Review

**Ngày:** Thứ 3, 24/06/2026 (cuối ngày)
**Nội dung:**
1. ✅ Review Gate G2 deliverables đã nộp (18/06)
2. Demo: Agent chạy trên Streamlit + Next.js (nếu kịp)
3. Demo: CRUD APIs + Tree Metrics API trên Swagger
4. Demo: Chat UI streaming trên Next.js
5. Review eval evidences + test coverage
6. **Retrospective:** Rút kinh nghiệm Demo 1, điều chỉnh cho Sprint 3
7. **Plan Sprint 3** — Tập trung Deploy + Demo 2 (28/06)

> [!CAUTION]
> **Demo 2 với đối tác là 28/06** — chỉ 4 ngày sau Sprint 2. Sprint 3 cần tập trung deploy production (Vercel + Render) và polish UX.

# 📋 Program Requirements — AI20K Build Cohort 2

> **Team 056** · Mã đề: AI20K-012
> **Ngày tổng hợp:** 07/06/2026
> **Nguồn:** Technical Book AI20K Build Cohort 2 + Quy Định Vận Hành Giai Đoạn RA

---

## 1. Thông tin chương trình

| Hạng mục | Chi tiết |
|:---------|:---------|
| **Chương trình** | Phoenix Agent — AI20K Build Cohort 2 |
| **Giai đoạn** | RA (Real Application) — 6 tuần |
| **Thời gian** | 28/05/2026 → 07/07/2026 |
| **Team** | 056 — Hoàng (Lead), Hưng, Hiếu |
| **Đề bài** | AI20K-012: AI Phân Tích Học Tập (Learning Analytics) Cho Khoa & Nhà Trường |
| **Loại** | Analytics + LLM |
| **Độ khó** | Level 2 |

---

## 2. Yêu cầu sản phẩm (từ đề bài)

### 2.1 Yêu cầu tối thiểu (PHẢI ĐẠT)

> [!CAUTION]
> Không đạt các yêu cầu tối thiểu = **KHÔNG ĐẠT**.

| # | Yêu cầu | Trạng thái |
|:-:|:---------|:----------:|
| 1 | Sản phẩm web/app **hoàn chỉnh** | ⬜ |
| 2 | **Deployed online** — có URL truy cập | ⬜ |
| 3 | **Đăng nhập & phân quyền** cơ bản | ⬜ |
| 4 | **Giao diện UI/UX** hoàn chỉnh | ⬜ |
| 5 | **Quản lý user** | ⬜ |

### 2.2 Không chấp nhận

| ❌ Loại | Lý do |
|:--------|:------|
| Demo notebook (Jupyter) | Không phải sản phẩm hoàn chỉnh |
| Script CLI | Không có UI/UX |
| Prototype chỉ chạy localhost | Phải deployed online có URL |

### 2.3 Bài toán cần giải quyết

**Pain point:** Khoa và nhà trường thiếu cái nhìn dữ liệu về hiệu quả đào tạo (môn nào sinh viên hay trượt, chuẩn đầu ra nào chưa đạt, xu hướng kết quả) nên cải tiến chương trình dựa trên cảm tính.

**Giải pháp AI cần xây dựng:**
1. Tổng hợp dữ liệu kết quả học tập toàn chương trình
2. Xác định môn/chủ đề khó
3. Đánh giá mức đạt chuẩn đầu ra (cho kiểm định ABET/AUN)
4. Phát hiện xu hướng và bất thường
5. Trả lời câu hỏi của lãnh đạo bằng ngôn ngữ tự nhiên
6. Sinh báo cáo cải tiến chương trình

**Tech stack gợi ý:** OpenAI/Claude, learning analytics, text-to-query, FastAPI, dashboard

---

## 3. 10 Deliverables bắt buộc (BTC)

> [!CAUTION]
> Thiếu bất kỳ deliverable nào → bị trừ điểm nặng. **Tất cả phải sẵn sàng trước Demo Day (07/07).**

| # | Deliverable | Mô tả | Ai phụ trách | Deadline | Status |
|:-:|:------------|:------|:------------:|:--------:|:------:|
| D1 | **Source Code** | GitHub repo: code chất lượng, type hints, docstrings, Ruff lint pass, functions 5-10 dòng, import order chuẩn | Cả team | W5 | ⬜ |
| D2 | **README.md** | Mô tả dự án, cài đặt, chạy, architecture diagram, API docs, env vars | Hoàng | W6 | ⬜ |
| D3 | **Architecture Diagram** | 3 loại Mermaid: System Overview, Agent Flow, Data Flow | Hoàng | W3 | ⬜ |
| D4 | **AI Logs** | Log sử dụng AI tools (Claude, Copilot, ChatGPT) — AI Usage Logging Hooks | Cả team | Liên tục | ⬜ |
| D5 | **Live URL** | Backend (Render) + Frontend (Vercel), HTTPS, CORS, health check | Hưng | W5 | ⬜ |
| D6 | **Video Demo** | Video demo sản phẩm hoạt động | Hiếu | W6 | ⬜ |
| D7 | **Pitch Deck** | 10 slides: Cover → Problem → Solution → Architecture → Demo → Agent → Tech → Eval → Impact → Next | Hiếu | W6 | ⬜ |
| D8 | **Journal + Worklog** | Nhật ký làm việc hàng ngày | Cả team | Liên tục | ⬜ |
| D9 | **Evaluation Evidence** | RAGAS metrics, test results, bảng so sánh before/after | Hoàng | W5 | ⬜ |
| D10 | **Tests** | Unit tests + Integration tests, coverage ≥ 60% | Hưng + Hiếu | W5 | ⬜ |

---

## 4. 5 Tiêu chí chấm điểm (tổng 50 điểm)

> [!IMPORTANT]
> **Mục tiêu team: ≥ 35/50** (loại Tốt).
> Teams Cohort 1 điểm thấp (27-30/50) đều mắc chung: **DevOps + Code Quality = yếu nhất**.

| # | Tiêu chí | Điểm tối đa | Yêu cầu chính | Ai chịu trách nhiệm chính |
|:-:|:---------|:-----------:|:---------------|:--------------------------:|
| 1 | **Agent Quality** | 10 | Agent logic phức tạp, nhiều nodes/tools, ReAct pattern, error handling 3 tầng | Hoàng |
| 2 | **Code Quality** | 10 | Type hints, docstrings, Ruff pass, tổ chức code tốt, tests | Cả team |
| 3 | **DevOps** | 10 | Docker, CI/CD (GitHub Actions), deploy thành công, monitoring | Hưng |
| 4 | **Evaluation Evidence** | 10 | RAGAS metrics, test coverage, bảng so sánh | Hoàng + Hưng |
| 5 | **Presentation** | 10 | Pitch Deck 10 slides, Video Demo, live demo hoạt động | Hiếu |

---

## 5. Cột mốc bắt buộc (từ Quy Định Vận Hành)

| Cột mốc | Tuần | Ngày | Sản phẩm nộp |
|:---------|:----:|:-----|:-------------|
| Kickoff & Project Charter | W1 | 25–31/05 | Project Charter + Quy chế |
| Đề xuất giải pháp với đối tác | W2 | 01–07/06 | Solution Design + Architecture |
| **Demo 1 với đối tác** | W3 | 08–14/06 | Bản Demo 1 + Phản hồi đối tác |
| Hoàn thiện sản phẩm | W4–W5 | 15–28/06 | Sản phẩm hoàn thiện + Deploy |
| **Demo 2 với đối tác** | W5 | 22–28/06 | Bản Demo 2 + Đánh giá hài lòng |
| **Đánh giá cuối kỳ (Demo Day)** | W6 | 29/06–05/07 | Báo cáo tác động + Slide thuyết trình |

---

## 6. Yêu cầu kỹ thuật (từ Technical Book)

### 6.1 Kiến trúc 3 tầng (bắt buộc)

| Tầng | Công nghệ | Yêu cầu |
|:-----|:----------|:---------|
| **Frontend** | Next.js (production) / Streamlit (prototype) | Chat UI, Streaming display, Dark Mode, Responsive |
| **Backend** | FastAPI + Pydantic | REST API, SSE Streaming, CORS, Rate Limiting, Auth |
| **AI Agent** | LangGraph StateGraph | Nodes, Conditional Edges, Tools, ReAct pattern, Error handling 3 tầng |
| **Storage** | SQLite → PostgreSQL + ChromaDB | Relational data + Vector store cho RAG |

### 6.2 Code Quality Checklist (ảnh hưởng trực tiếp tiêu chí chấm)

- [ ] Type hints cho **mọi** function
- [ ] Docstrings cho mọi class/function public
- [ ] Code pass `ruff check src/ tests/`
- [ ] Không hardcode secrets (dùng `.env` + `pydantic-settings`)
- [ ] Functions ngắn (5-10 dòng)
- [ ] Import order chuẩn (stdlib → third-party → local)
- [ ] Tổ chức code theo module: `agent/`, `api/`, `tools/`, `models/`

### 6.3 DevOps Checklist (ảnh hưởng trực tiếp tiêu chí chấm)

- [ ] Docker — Multi-stage Dockerfile
- [ ] docker-compose cho local development
- [ ] CI/CD — GitHub Actions (Ruff lint + pytest)
- [ ] Deploy: Backend → Render, Frontend → Vercel
- [ ] Health check endpoint `/health`
- [ ] Monitoring: Langfuse hoặc LangSmith

### 6.4 Agent Quality Checklist

- [ ] LangGraph StateGraph với TypedDict State schema
- [ ] Router Node + Conditional Edges
- [ ] ≥ 3 Tools (SQL query, CLO calculator, chart generator...)
- [ ] ReAct pattern (Plan → Execute → Observe → Reflect)
- [ ] Error handling 3 tầng (Node level, Graph level, Tool level)
- [ ] Memory / Context management
- [ ] RAG: Vector Store + Embedding + Search tool

### 6.5 Evaluation Evidence Checklist

- [ ] Unit tests cho agent nodes
- [ ] Integration tests cho API endpoints
- [ ] Test coverage report (≥ 60%)
- [ ] RAGAS evaluation metrics
- [ ] Bảng so sánh before/after (hoặc baseline comparison)

---

## 7. Quy định vận hành hàng ngày

| Quy định | Chi tiết |
|:---------|:---------|
| **Giờ làm việc** | Full-time: ≥ 40 giờ/tuần, T2–T7 |
| **Giờ core** | 09:00–11:30 và 14:00–17:00 — tất cả phải online |
| **Daily Standup** | 09:00 mỗi sáng (15 phút). Báo mentor: done / doing / blockers |
| **Báo cáo tuần** | Tổng hợp trước Mentor Meeting T4 tối |
| **Mentor Meeting** | T4 tối: chung 1h30 (bắt buộc). T7: riêng 45p/team (bắt buộc) |
| **Nghỉ phép** | Báo trước 24h. Tối đa 2 ngày/6 tuần |
| **GitHub** | Commit ≥ 1 lần/ngày khi có coding. PR cần ≥ 1 review |
| **Báo cáo muộn** | Cảnh báo lần 1. Quá 3 lần → meeting với lead mentor |

---

## 8. Bài học từ Cohort 1 — Top 10 lỗi phải tránh

> [!WARNING]
> Teams điểm thấp (27-30/50) đều mắc chung: DevOps + Code Quality là yếu nhất.

| # | Lỗi | Cách tránh |
|:-:|:-----|:-----------|
| 1 | `except: pass` (bare except) | Luôn bắt exception cụ thể |
| 2 | Hardcoded secrets | Dùng `.env` + `pydantic-settings` |
| 3 | Không viết tests | Viết tests cho agent nodes + API endpoints |
| 4 | Không CI/CD | Setup GitHub Actions ngay Sprint 1 |
| 5 | Functions quá dài | Mỗi function 5-10 dòng |
| 6 | Không Architecture Diagram | Vẽ 3 loại Mermaid diagram |
| 7 | README thiếu | Viết đầy đủ theo checklist |
| 8 | Không Evaluation Evidence | RAGAS metrics + test coverage |
| 9 | Tất cả code trong 1 file | Tách module: agent/, api/, tools/, models/ |
| 10 | Không type hints | Bắt buộc type hints cho mọi function |

---

## 9. Chiến lược giảm chi phí API

| # | Chiến lược | Ghi chú |
|:-:|:-----------|:--------|
| 1 | Dùng model rẻ cho routing, model mạnh cho generation | Gemini Flash cho routing, Gemini Pro cho analysis |
| 2 | Giới hạn `max_tokens` | 500 cho ngắn, 1500 cho chi tiết |
| 3 | `temperature=0` cho phân tích/routing | Deterministic output |
| 4 | Cache kết quả LLM | Đặc biệt cho auto-analysis |
| 5 | Mock LLM trong tests | Không gọi LLM thật khi chạy tests |
| 6 | Giới hạn agent iterations | MAX_ITERATIONS = 3 |
| 7 | Monitor usage | Langfuse tracking |

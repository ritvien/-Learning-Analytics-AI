# EduInsight — Backend

FastAPI backend for the EduInsight AI Student Analytics Platform.

## Tech stack

| Layer | Technology |
|:------|:-----------|
| Framework | FastAPI + Uvicorn |
| ORM | SQLAlchemy 2.0 (async, `Mapped` style) |
| Migrations | Alembic (async autogenerate) |
| Schemas | Pydantic v2 |
| Auth | JWT via `python-jose` + `passlib[bcrypt]` |
| DB (dev) | SQLite + `aiosqlite` |
| DB (prod) | PostgreSQL 16 + `asyncpg` |
| Linting | Ruff |
| Tests | pytest + pytest-asyncio + httpx |

---

## Project structure

```
backend/
├── app/
│   ├── main.py           # FastAPI app, lifespan, CORS, router mount
│   ├── config.py         # Settings (pydantic-settings, .env support)
│   ├── database.py       # Async engine + session factory + Base
│   ├── dependencies.py   # FastAPI deps: DBSession, Pagination, JWT
│   ├── models/           # SQLAlchemy ORM models
│   │   ├── academic.py   # University, Department, Program, Semester, Course
│   │   ├── people.py     # User, Teacher, Cohort, Student
│   │   ├── teaching.py   # Section, Enrollment, GradeComponent
│   │   └── assessment.py # PLO, CLO, CLO-PLO matrix
│   ├── schemas/          # Pydantic schemas (Create / Update / Response)
│   └── api/v1/
│       ├── router.py     # Aggregate v1 router
│       └── endpoints/    # departments, programs, courses, students,
│                         # teachers, sections, grades
├── migrations/           # Alembic async migrations
│   ├── env.py
│   └── versions/
├── tests/
│   ├── conftest.py       # Async client + in-memory SQLite fixture
│   └── test_health.py
├── db/schema.sql         # Reference PostgreSQL schema (not used by Alembic)
├── Dockerfile            # Multi-stage (builder + runtime)
├── entrypoint.sh         # Alembic upgrade head → uvicorn
├── alembic.ini
└── pyproject.toml
```

---

## Quick start — Docker (recommended)

**Prerequisites:** Docker Desktop ≥ 24, Docker Compose v2.

```bash
# From repository root
cp backend/.env.example .env   # edit .env if needed

docker compose up --build
```

| Service | URL |
|:--------|:----|
| API + Swagger | http://localhost:8000/api/docs |
| ReDoc | http://localhost:8000/api/redoc |
| PostgreSQL | localhost:5432 (user/pass: see .env) |

Migrations run automatically inside the container before the server starts.
The runtime schema is created only by Alembic. Files under `backend/db/` are
legacy/reference artifacts and are not mounted into PostgreSQL by Docker Compose.

**Useful commands:**

```bash
# Rebuild backend image after dependency changes
docker compose up --build backend

# Tail logs
docker compose logs -f backend

# Open a psql shell
docker compose exec db psql -U eduinsight -d eduinsight

# Run a one-off alembic command inside the container
docker compose exec backend alembic current

# Stop and remove containers (keeps DB volume)
docker compose down

# Stop and wipe the database volume
docker compose down -v
```

---

## Quick start — Local (SQLite dev)

**Prerequisites:** Python 3.11+

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# 2. Install with dev extras
pip install -e ".[dev]"

# 3. Copy and edit env
cp .env.example .env
# DATABASE_URL is already set to sqlite+aiosqlite:///./eduinsight.db

# 4. Run migrations
alembic upgrade head

# 5. Start dev server with hot-reload
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/api/docs for Swagger UI.

---

## Environment variables

All variables in `.env.example`. Key ones:

| Variable | Default | Description |
|:---------|:--------|:------------|
| `APP_ENV` | `development` | Controls SQL echo, debug mode |
| `DATABASE_URL` | `sqlite+aiosqlite:///./eduinsight.db` | Async DB URL |
| `SECRET_KEY` | _(placeholder)_ | JWT signing key — **change in prod** |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `LLM_PROVIDER` | `openai` | `gemini` \| `openai` / OpenAI-compatible providers |
| `LLM_MODEL` | _(required for LLM calls)_ | Default model for report/chat helpers |
| `LLM_API_KEY` | _(empty)_ | API key for chosen LLM provider |
| `LLM_BASE_URL` | _(empty)_ | Optional OpenAI-compatible base URL, for example DeepSeek |
| `AGENT_ROUTER_MODEL` | `LLM_MODEL` | Optional router model override |
| `AGENT_CORE_MODEL` | `LLM_MODEL` | Optional core agent model override |
| `CHAT_TITLE_MODEL` | `LLM_MODEL` | Optional chat title summarizer model override |

For Docker Compose, variables are read from a `.env` file at the repo root.

---

## Database migrations (Alembic)

```bash
# Generate a new migration after model changes
alembic revision --autogenerate -m "describe your change"

# Apply all pending migrations
alembic upgrade head

# Roll back one step
alembic downgrade -1

# Show current revision
alembic current

# Show migration history
alembic history --verbose
```

> **Note:** The Alembic env.py uses `render_as_batch=True`, which enables
> SQLite-compatible `ALTER TABLE` via table recreation. This means the same
> migrations work in both SQLite (dev) and PostgreSQL (prod).

---

## Running tests

```bash
cd backend
pytest                  # run all tests
pytest -v               # verbose output
pytest tests/test_health.py   # single file
```

Tests use an in-memory SQLite database — no external services needed.

---

## Linting

```bash
cd backend
ruff check .            # lint
ruff check . --fix      # auto-fix
ruff format .           # format
```

CI blocks merges if Ruff reports any errors.

---

## API overview

All endpoints are prefixed with `/api/v1/`. Full interactive docs at `/api/docs`.

| Resource | Endpoints |
|:---------|:----------|
| Departments | `GET/POST /departments`, `GET/PATCH/DELETE /departments/{id}` |
| Programs | `GET/POST /programs`, `GET/PATCH/DELETE /programs/{id}` |
| Courses | `GET/POST /courses`, `GET/PATCH/DELETE /courses/{id}` |
| Students | `GET/POST /students`, `GET/PATCH/DELETE /students/{id}` |
| Teachers | `GET/POST /teachers`, `GET/PATCH/DELETE /teachers/{id}` |
| Sections | `GET/POST /sections`, `GET/PATCH/DELETE /sections/{id}` |
| Grades | `GET/POST /grades/enrollments`, `PATCH /grades/enrollments/{id}/grade`, `PUT /grades/components` |
| AI Chat | `POST /chat` (Dùng cho chatbot AI), `GET /chat/stream` (SSE streaming) |
| Health | `GET /health` |

---

## Gate G2: AI Agent & LLM Integration (Sprint 2)

EduInsight tích hợp AI Agent sử dụng LangGraph để phân tích dữ liệu học vụ tự động thông qua giao tiếp bằng ngôn ngữ tự nhiên. 

### Setup Instructions
1. Hãy chắc chắn bạn đã cấu hình `.env` ở thư mục gốc của project.
2. Để chạy được Agent, hệ thống cần kết nối với PostgreSQL và API Key của LLM.
3. Nếu muốn dùng **RAG (Retrieval-Augmented Generation)** để đọc tài liệu, bạn cần chạy script embedding trước (chưa bắt buộc ở Gate G2).
4. Run server: `docker compose up -d backend` hoặc chạy local qua `uvicorn`.

### Environment Variables
Các biến môi trường sau bắt buộc phải có trong `.env`:

| Biến môi trường | Mục đích | Ví dụ / Mặc định |
|---|---|---|
| `LLM_PROVIDER` | Chọn mô hình AI để chạy Agent | `gemini` (mặc định) hoặc `openai` |
| `GEMINI_API_KEY` | Key của Google AI Studio | `AIzaSy...` |
| `OPENAI_API_KEY` | Key của OpenAI (nếu dùng OpenAI) | `sk-proj...` |
| `AGENT_DB_URL` | Chuỗi kết nối DB (PostgreSQL) cho Agent | `postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight` |

### Sample Queries & Expected Outputs

Bạn có thể test trực tiếp qua API `/api/v1/chat/stream` hoặc sử dụng giao diện Chatbot. Dưới đây là 5 câu lệnh mẫu khai thác sức mạnh của Agent:

1. **Phân tích tổng quan ngành**
   - *Query:* "Cho tôi xem top 5 môn trượt nhiều nhất ngành Công nghệ thông tin"
   - *Expected Output:* Agent tự động tra cứu view `vw_course_stats` lọc theo tên ngành, trả về bảng Markdown danh sách 5 môn có tỷ lệ trượt cao nhất kèm theo nhận xét phân tích nguyên nhân.

2. **Truy vấn sinh viên cụ thể**
   - *Query:* "Sinh viên 19810310243 học khóa mấy, điểm tích lũy bao nhiêu?"
   - *Expected Output:* Agent lookup bảng `students`, join `cohorts`, trả ra thông tin khóa, lớp, và GPA.

3. **Tính điểm CLO (Chuẩn đầu ra)**
   - *Query:* "Hãy tính điểm CLO môn Tiếng Anh 1 của sinh viên SV001"
   - *Expected Output:* Agent kích hoạt `clo_calculator_tool`, tự động tính toán trọng số các bài kiểm tra chuyên cần/giữa kỳ/cuối kỳ để ra được điểm từng CLO và nhận định ĐẠT/KHÔNG ĐẠT.

4. **So sánh học kỳ**
   - *Query:* "Tỷ lệ trượt môn Cấu trúc dữ liệu và giải thuật kỳ này so với kỳ trước thế nào?"
   - *Expected Output:* Bảng so sánh Pass/Fail rate của môn CTDL&GT giữa 2 học kỳ gần nhất.

5. **Entity Auto-Mapping**
   - *Query:* "KTPM kỳ này có bao nhiêu sinh viên?"
   - *Expected Output:* Agent tự hiểu KTPM là "Kỹ thuật phần mềm", tìm ngành này trong DB và đếm tổng số enrollment của kỳ hiện tại.

---

## Analytics warehouse and ML persistence

PostgreSQL is split by workload:

| Schema | Responsibility |
|:-------|:---------------|
| `public` | OLTP entities and CRUD |
| `dwh` | Analytics dimensions, facts, ETL and data-quality logs |
| `ml` | Model runs and enrollment/student-semester predictions |

Refresh the DWH after OLTP data changes:

```bash
docker compose exec backend python -m app.analytics.etl
```

After a model writes enrollment-level rows to `ml.enrollment_prediction`,
aggregate expected credits for a model run:

```bash
docker compose exec backend python -m app.ml.scoring <model_run_id>
```

Both operations use upserts and can be run repeatedly without duplicating facts
or student-semester prediction summaries.

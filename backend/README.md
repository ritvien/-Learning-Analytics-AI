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
| `LLM_PROVIDER` | `gemini` | `gemini` \| `mistral` \| `openai` |
| `LLM_API_KEY` | _(empty)_ | API key for chosen LLM provider |

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
| Health | `GET /health` |

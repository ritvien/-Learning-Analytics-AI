# Backend

FastAPI backend workspace for Hung's Sprint 1 tasks: database schema, API setup, Docker, CI/CD, CRUD APIs, and import endpoints.

## Local Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs for Swagger docs.

## Checks

```powershell
cd backend
ruff check .
pytest
```

## Docker

From the repository root:

```powershell
docker compose up --build
```

The API will be available at http://127.0.0.1:8000.

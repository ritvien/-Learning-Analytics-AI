# Gate G3 Release Readiness - T40/T45/T46/T48

Updated: 2026-06-23

This file is the working handoff for the 25/06 release-readiness tasks:

- `T40` Guardrails - Backend & RBAC
- `T45` Deployment/Proxy Recovery Runbook
- `T46` Integration Defect Fix Window
- `T48` Release Candidate Verification

## 1. Testcase Matrix

| ID | Task | Scenario | Expected result | Evidence command |
|:---|:-----|:---------|:----------------|:-----------------|
| TC-GR-01 | T40 | Call analytics health endpoint without bearer token | `401 Unauthorized` before DWH/ML logic runs | `pytest tests/test_guardrails_rbac.py -q` |
| TC-GR-02 | T40 | Manager scoped to department A reads program in department B | `403 Analytics scope is outside your permissions` | `pytest tests/test_guardrails_rbac.py -q` |
| TC-GR-03 | T40 | Manager scoped to department A reads course in department B | `403 Analytics scope is outside your permissions` | `pytest tests/test_guardrails_rbac.py -q` |
| TC-GR-04 | T40 | Non-admin calls ML/admin operation | `403 Insufficient permissions` | `pytest tests/test_guardrails_rbac.py -q` |
| TC-PX-01 | T45/T46 | Next.js `/api/v1/*` proxy targets FastAPI | Uses `BACKEND_URL`, fallback `http://127.0.0.1:8000` | Manual smoke below |
| TC-PX-02 | T45/T46 | FastAPI target is unavailable | Proxy returns `502` JSON with target URL | Manual smoke below |
| TC-PX-03 | T45/T46 | Chat stream proxy target is unavailable | Stream route returns `502` JSON with target URL | Manual smoke below |
| TC-RC-01 | T48 | Backend unit/integration subset runs | Guardrail/report/auth tests pass | Commands in section 4 |
| TC-RC-02 | T48 | Frontend static checks run | `npm run lint` and `npm test` pass or failures are logged as known issues | Commands in section 4 |

## 2. T40 Guardrails Notes

Implemented guardrails:

- Analytics health endpoints now require authentication.
- Program/course/department health reads check user scope before calling health-score services.
- Student-semester prediction reads check student scope before ML prediction lookup.
- Admin DWH/ML operations require admin roles through `require_admin_access`.
- Out-of-scope analytics reads return a stable `403` detail: `Analytics scope is outside your permissions`.

Remaining follow-up:

- Enrollment prediction endpoint currently requires authentication, but does not yet map `enrollment_id` to section/student scope before the ML lookup. Add this when enrollment-level prediction is used by UI.
- Dashboard aggregate endpoints still need a fuller policy decision: admin-only school aggregate versus auto-scoped department aggregate for managers.

## 3. T45 Deployment/Proxy Recovery Runbook

### Owners

| Area | Owner |
|:-----|:------|
| FastAPI/backend health, migration, seed | Backend owner |
| Next.js frontend, proxy `/api/v1/*`, chat stream proxy | Frontend owner |
| Ngrok public URL and fallback URL broadcast | Release/demo owner |
| Final smoke checklist and evidence capture | QA/release owner |

### Restart Commands

Backend:

```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```powershell
cd frontend
$env:BACKEND_URL="http://127.0.0.1:8000"
npm run dev
```

Ngrok:

```powershell
ngrok http 3000
```

Docker fallback:

```powershell
docker compose up --build
```

### Health Checks

Backend direct:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/health
Invoke-WebRequest http://127.0.0.1:8000/api/v1/health
```

Frontend direct:

```powershell
Invoke-WebRequest http://127.0.0.1:3000
```

Proxy through Next.js:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/v1/health
```

Public Ngrok:

```powershell
Invoke-WebRequest https://<current-ngrok-host>/api/v1/health
```

### URL Fallback Rules

1. Primary public entry is the Ngrok URL for Next.js port `3000`.
2. Frontend proxy forwards `/api/v1/*` to `BACKEND_URL`.
3. If `BACKEND_URL` is absent, frontend falls back to `http://127.0.0.1:8000`.
4. If FastAPI is unavailable, generic proxy and chat stream proxy return `502` with the backend target in the JSON body.
5. When Ngrok URL changes, update the demo note, README/evidence link, and any reviewer-facing message in the same handoff.

### Manual Smoke Checklist

- [ ] Login page opens.
- [ ] Auth login returns token and dashboard opens.
- [ ] Refresh/deep-link on dashboard stays authenticated or redirects cleanly.
- [ ] `/api/v1/health` works through Next.js proxy.
- [ ] Report page loads existing reports.
- [ ] Chat non-stream and stream requests do not hang.
- [ ] Mobile viewport can open navigation and chat.

## 4. T46 Defect Fix Window

Current issue list:

| Issue ID | Source | Severity | Root cause | Fix | Retest |
|:---------|:-------|:---------|:-----------|:----|:-------|
| INT-001 | T40 guardrail tests | P1 | Analytics health endpoints ran internal DWH/ML logic without auth/scope guard and returned `500` for unauth/out-of-scope requests | Added auth and scope checks in `backend/app/api/v1/endpoints/analytics.py` | `pytest tests/test_guardrails_rbac.py -q` |
| INT-002 | Proxy review | P1 | Generic Next.js proxy hard-coded `http://127.0.0.1:8000`, making deployed fallback/recovery harder | Use `BACKEND_URL` with localhost fallback and `502` proxy error body | Frontend lint/test plus manual proxy smoke |
| INT-003 | Proxy review | P1 | Chat stream proxy did not catch backend connection failures | Return `502` JSON when stream target is unavailable | Frontend lint/test plus manual stream smoke |
| INT-004 | Live health smoke | P1 | Observability logging tried to write to Postgres when DB was unavailable and turned healthy requests into `500` | Make `log_event` swallow DB connection failures as best-effort telemetry | Direct/proxy `/api/v1/health` smoke |

Retest evidence captured so far:

```text
pytest tests/test_guardrails_rbac.py -q
4 passed, 2 warnings

pytest tests/test_guardrails_rbac.py tests/test_auth.py tests/test_api_report_agent.py tests/test_report_schedules.py -q
13 passed, 2 warnings

pytest -q
39 passed, 2 warnings

python -m ruff check app/api/v1/endpoints/analytics.py tests/test_guardrails_rbac.py --select I,B904,F
All checks passed

npm.cmd test
2 test files passed, 2 tests passed

npx.cmd eslint 'src/app/api/v1/[...path]/route.ts' 'src/app/api/v1/chat/stream/route.ts'
passed with no output

Invoke-WebRequest http://127.0.0.1:8000/api/v1/health
200 {"status":"ok","service":"eduinsight-backend","version":"0.1.0"}

Invoke-WebRequest http://127.0.0.1:3000/api/v1/health
200 {"status":"ok","service":"eduinsight-backend","version":"0.1.0"}
```

## 5. T48 Release Candidate Verification

### Freeze Record

Fill this section at RC time:

```text
branch:
commit:
backend app_version:
frontend version:
BACKEND_URL:
public URL:
database:
```

### Verification Commands

Backend focused checks:

```powershell
cd backend
pytest tests/test_guardrails_rbac.py tests/test_auth.py tests/test_api_report_agent.py tests/test_report_schedules.py -q
```

Backend full test suite:

```powershell
cd backend
pytest -q
```

Frontend checks:

```powershell
cd frontend
npm run lint
npm test
```

Playwright/UI test command, when V39 tests are present:

```powershell
cd frontend
npx playwright test
```

Migration/seed checks:

```powershell
cd backend
alembic current
alembic upgrade head
python scripts/seed_database.py
```

### Rollback Commands

Rollback code to a known good commit:

```powershell
git log --oneline -5
git switch <release-branch>
git revert <bad-commit>
```

Restart after rollback:

```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```powershell
cd frontend
$env:BACKEND_URL="http://127.0.0.1:8000"
npm run dev
```

Database rollback, only when a migration caused the issue:

```powershell
cd backend
alembic history
alembic downgrade -1
```

### Known Issues

- Enrollment prediction endpoint needs enrollment-to-scope enforcement before it should be exposed broadly.
- Dashboard aggregate endpoints need final product decision for non-admin school-level visibility.
- Full `npm.cmd run lint` currently fails on existing unrelated frontend files with React hooks/compiler and TypeScript lint errors. The two proxy route files changed for T45/T46 pass targeted ESLint.

---

## 6. D59 Production Deploy (Render + Vercel)

Updated: 2026-07-06 · Owner: Hoàng · Blueprint: [render.yaml](../../render.yaml) · Evidence: [d59-deployment-evidence.md](./d59-deployment-evidence.md)

> **06/07/2026:** backend primary đã chuyển sang **AWS EC2 Singapore** — `https://edu-insight.duckdns.org`, runbook [deploy/README.md](../../deploy/README.md). Render bên dưới là historical/fallback tới H72 ([Sprint4.md](../07-Sprint-Planning/Sprint4.md) § Demo Day Phase 2, deadline 08/07 23:00).

**Live:** [https://c2-app-056.vercel.app](https://c2-app-056.vercel.app) · Backend [https://edu-insight.duckdns.org](https://edu-insight.duckdns.org) · (Render fallback: `eduinsight-backend-jxmm.onrender.com`)

### Architecture

- **Frontend:** Vercel (`frontend/`), env `BACKEND_URL` → Next.js proxy `/api/v1/*`
- **Backend:** Render Docker web service (`backend/`, `rootDir` + `dockerContext` = backend folder)
- **Database:** Render PostgreSQL (pgvector via migration `CREATE EXTENSION vector`)
- **Bootstrap:** Local machine (Render Free has no Shell) — External DB URL + admin API

### Render `render.yaml` Docker context

```yaml
rootDir: backend
dockerfilePath: ./Dockerfile
dockerContext: .    # relative to rootDir — NOT repo root
```

Dockerfile does `COPY pyproject.toml ./`; build context must be `backend/`.

### Production env (Render dashboard)

| Variable | Notes |
|:---------|:------|
| `DATABASE_URL` | `postgresql+asyncpg://...` (convert from Render connection string) |
| `AGENT_DB_URL` | `postgresql://...` (sync — scripts, LangGraph) |
| `SECRET_KEY` | `openssl rand -hex 32` |
| `SEED_PASSWORD` | **`123456`** for Demo Day (`admin@epu.edu.vn`); code default is `password123` if unset |
| `SEED_ON_EMPTY` | `true` — keep for Demo Day; seed skips when students exist |
| `CORS_ORIGINS` | `https://<vercel-app>.vercel.app` |
| `PORT` | Injected by Render (often 10000); entrypoint uses `${PORT:-8000}` — do not set 8000 |
| `OPENAI_API_KEY` / `LLM_API_KEY` | Required for chat + RAG embeddings |
| `LANGSMITH_*` | Per H59/D58 |

### Vercel env

| Variable | Value |
|:---------|:------|
| `BACKEND_URL` | `https://edu-insight.duckdns.org` (từ 06/07 — trước đó là URL Render) |
| `NEXT_PUBLIC_API_BASE` | `https://edu-insight.duckdns.org` — browser gọi thẳng backend, bỏ hop proxy |
| `NEXT_PUBLIC_ENABLE_DASHBOARD_PRELOAD` | `true` — prefetch dashboard sau login |

Chat stream proxy: `maxDuration = 120` in `frontend/src/app/api/v1/chat/stream/route.ts`.

### Bootstrap (local, after first deploy)

Script: [`scripts/d59-bootstrap-production.ps1`](../../scripts/d59-bootstrap-production.ps1)

```powershell
.\scripts\d59-bootstrap-production.ps1 -BaseUrl "https://<vercel-or-render>"
# CTĐT: add -IngestCtdt -AgentDbUrl "postgresql://..." (Render External URL)
```

Manual equivalent:

```powershell
$base = "https://<vercel-or-render>"
$loginBody = @{ username = "admin@epu.edu.vn"; password = "123456" }
$token = (Invoke-RestMethod -Method POST -Uri "$base/api/v1/auth/login" -Body $loginBody -ContentType "application/x-www-form-urlencoded").access_token
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Method POST -Uri "$base/api/v1/admin/dwh/refresh" -Headers $headers
$train = Invoke-RestMethod -Method POST -Uri "$base/api/v1/admin/ml/train?model=dropout" -Headers $headers
Invoke-RestMethod -Method POST -Uri "$base/api/v1/admin/ml/score-dropout?model_run_id=$($train.model_run_id)" -Headers $headers
```

CTĐT RAG (local + External `AGENT_DB_URL`):

```powershell
cd backend
$env:AGENT_DB_URL="postgresql://..."
python scripts/ingest_ctdt_rag.py --input ../docs/20-RAG-Corpus-Preparation/ctdt/ctdt_chunks.jsonl
```

### Render Free tier reminders

- Web spin-down ~15 min idle → UptimeRobot ping every 5 min
- 750 instance-hours/month quota
- Free PG: 1 GB, 30-day expiry

### Pre-deploy repo checklist

- [x] [backend/.dockerignore](../../backend/.dockerignore) — `db/` not ignored (D59)
- [x] [render.yaml](../../render.yaml) — `rootDir` + `dockerContext` = backend
- [x] `alembic heads` → single head `bc4d5e6f7a81` (verified)
- [x] `alembic upgrade head` on clean PostgreSQL (verified)

### Operator checklist (dashboard)

See [d59-deployment-evidence.md](./d59-deployment-evidence.md) — fill Live URLs after Render + Vercel deploy.

### Smoke (production)

Script: [`scripts/d59-smoke-production.ps1`](../../scripts/d59-smoke-production.ps1)

```powershell
.\scripts\d59-smoke-production.ps1 -VercelUrl "https://<vercel>" -RenderUrl "https://<render>"
```

Manual:

```powershell
Invoke-WebRequest https://<vercel>/api/v1/health
Invoke-WebRequest https://<render>/health
# Login admin@epu.edu.vn / 123456 → dashboard → chat
```

### UptimeRobot

| Monitor | URL | Dashboard |
|:--------|:----|:----------|
| FE e2e | `https://c2-app-056.vercel.app/api/v1/health` | [803424323](https://dashboard.uptimerobot.com/monitors/803424323) |
| BE | `https://eduinsight-backend-jxmm.onrender.com/health` → **H70: đổi sang `https://edu-insight.duckdns.org/health`** | [803424335](https://dashboard.uptimerobot.com/monitors/803424335) |

UptimeRobot HTTP(s) monitors use **HEAD** by default; health endpoints must support HEAD (or use **Keyword** monitor with `ok`). See [UptimeRobot help](https://uptimerobot.com/help/monitor-status-is-wrong/).


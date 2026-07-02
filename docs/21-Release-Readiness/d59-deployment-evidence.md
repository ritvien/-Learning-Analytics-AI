# D59 — Deployment evidence & operator checklist

Updated: 2026-07-01 · Owner: Hoàng · Blueprint: [render.yaml](../../render.yaml)

Fill this file after applying Render + Vercel. Do not commit secrets.

## Live URLs (handoff D56)

| Service | URL |
|:--------|:----|
| Frontend (Vercel) | `https://` |
| Backend (Render) | `https://` |
| UptimeRobot FE monitor | |
| UptimeRobot BE monitor | |

## Render — apply blueprint

1. Render Dashboard → **New** → **Blueprint** → connect GitHub repo.
2. Blueprint path: `render.yaml` at repo root.
3. Set sync-false env vars before first deploy:
   - `CORS_ORIGINS` = Vercel URL (can update after Vercel deploy)
   - `OPENAI_API_KEY`, `LLM_API_KEY`, `LANGSMITH_API_KEY`
4. After DB links: edit `DATABASE_URL` → change `postgresql://` to **`postgresql+asyncpg://`**.
5. Confirm `SEED_PASSWORD=123456` (demo login).
6. Deploy; wait for log `[entrypoint] Starting EduInsight API` (first deploy 5–15 min).
7. Verify students seeded: connect to PG or login works.

## Vercel — frontend

1. Import repo; **Root Directory** = `frontend`.
2. Env: `BACKEND_URL` = Render backend URL (no trailing slash).
3. Deploy production.
4. Update Render `CORS_ORIGINS` with final Vercel URL; redeploy backend if needed.

## Bootstrap (local — no Render Shell on Free)

```powershell
.\scripts\d59-bootstrap-production.ps1 -BaseUrl "https://<vercel-url>"

# + CTĐT RAG (External AGENT_DB_URL from Render DB):
$env:AGENT_DB_URL = "postgresql://..."
$env:OPENAI_API_KEY = "sk-..."
.\scripts\d59-bootstrap-production.ps1 -BaseUrl "https://<vercel-url>" -IngestCtdt
```

## Smoke

```powershell
.\scripts\d59-smoke-production.ps1 `
  -VercelUrl "https://<vercel-url>" `
  -RenderUrl "https://<render-url>"
```

## UptimeRobot (Free)

| Monitor | URL | Interval |
|:--------|:----|:---------|
| FE e2e | `https://<vercel>/api/v1/health` | 5 min |
| BE | `https://<render>/health` | 5 min |

Track Render **750 instance-hours/month** quota.

## Done checklist

- [ ] `render.yaml` applied; backend healthy
- [ ] `DATABASE_URL` uses `postgresql+asyncpg://`
- [ ] Vercel `BACKEND_URL` set; proxy health 200
- [ ] DB has students (not empty)
- [ ] Login `admin@epu.edu.vn` / `123456`
- [ ] Bootstrap: ETL + ML score completed
- [ ] UptimeRobot 2 monitors active
- [ ] Sprint4 D59 checkbox updated

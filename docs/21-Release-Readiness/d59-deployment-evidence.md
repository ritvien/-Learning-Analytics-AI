# D59 — Deployment evidence & operator checklist

Updated: 2026-07-02 · Owner: Hoàng · Blueprint: [render.yaml](../../render.yaml)

Production deploy evidence for Demo Day Live URL. Do not commit secrets.

## Live URLs (handoff D56)

| Service | URL |
|:--------|:----|
| Frontend (Vercel) | `https://c2-app-056.vercel.app` |
| Backend (Render) | `https://eduinsight-backend-jxmm.onrender.com` |
| UptimeRobot FE monitor | https://dashboard.uptimerobot.com/monitors/803424323 |
| UptimeRobot BE monitor | https://dashboard.uptimerobot.com/monitors/803424335 |

Demo login: `admin@epu.edu.vn` / `123456` (`SEED_PASSWORD=123456` on Render).

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
2. Env: `BACKEND_URL` = `https://eduinsight-backend-jxmm.onrender.com` (no trailing slash).
3. Deploy production.
4. Update Render `CORS_ORIGINS` with final Vercel URL; redeploy backend if needed.

## Bootstrap (local — no Render Shell on Free)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\d59-bootstrap-production.ps1 `
  -BaseUrl "https://eduinsight-backend-jxmm.onrender.com"

# + CTĐT RAG (External AGENT_DB_URL from Render DB):
$env:AGENT_DB_URL = "postgresql://..."
$env:OPENAI_API_KEY = "sk-..."
powershell -ExecutionPolicy Bypass -File .\scripts\d59-bootstrap-production.ps1 `
  -BaseUrl "https://c2-app-056.vercel.app" -IngestCtdt
```

Production bootstrap completed: ETL run id 2 · ML model_run_id 2 · `rows_upserted=1157`.

## Smoke

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\d59-smoke-production.ps1 `
  -VercelUrl "https://c2-app-056.vercel.app" `
  -RenderUrl "https://eduinsight-backend-jxmm.onrender.com"
```

Last automated smoke: **passed** (health 200, login admin, `/auth/me` role=admin).

## Performance knobs (2026-07-05)

Measured from VN: every API call used to hop browser → Vercel fn (**iad1**, US East) → Render (**oregon**, US West), adding 0.2–1.1s per request; cold dashboard aggregations took 5–60s on the free instance (tree 23s, outcomes 61s) with a 5-min per-user cache.

| Knob | Where | Default | Effect |
|:-----|:------|:--------|:-------|
| `DASHBOARD_CACHE_TTL_SECONDS` | Render env | 21600 | Dashboard payload cache lifetime (cleared by `/admin/dwh/refresh` + ML scoring) |
| `DASHBOARD_PREWARM_INTERVAL_SECONDS` | Render env | 300 | Background worker keeps tree + default dashboards warm; `0` disables |
| `TREE_CACHE_TTL_SECONDS` | Render env | 900 | Academic tree cache (shared across users, force-refreshed each sweep) |
| `RUN_ANALYTICS_REFRESH_ON_STARTUP` | Render env (in blueprint) | `false` | Skip boot-time ETL+CLO refresh; run via bootstrap script instead |
| `NEXT_PUBLIC_API_BASE` | Vercel env | unset | Set to the Render URL so the browser calls the backend directly (CORS already allows the Vercel origin); unset = same-origin proxy |
| `NEXT_PUBLIC_ENABLE_DASHBOARD_PRELOAD` | Vercel env | unset | `true` prefetches dashboard data after login into the client cache |
| `frontend/vercel.json` `regions` | repo | `sin1` | Runs the proxy function in Singapore instead of US East |

Dashboard caches are shared across users (keys carry the resolved scope, not the user id), so the prewarm worker's entries serve real logins. Biggest remaining win: recreate the Render service + Postgres in the **singapore** region (region is fixed at creation; needs dump/restore + URL/env updates).

## UptimeRobot (Free)

| Monitor | URL | Interval | Dashboard |
|:--------|:----|:---------|:----------|
| FE e2e | `https://c2-app-056.vercel.app/api/v1/health` | 5 min | [803424323](https://dashboard.uptimerobot.com/monitors/803424323) |
| BE | `https://eduinsight-backend-jxmm.onrender.com/health` | 5 min | [803424335](https://dashboard.uptimerobot.com/monitors/803424335) |

**HEAD vs GET:** UptimeRobot HTTP(s) monitors send **HEAD** by default ([docs](https://uptimerobot.com/help/monitor-status-is-wrong/)). Before HEAD support deploy, monitors may show `405 Method Not Allowed` while GET/smoke still pass. Workarounds: (1) **Keyword** monitor with keyword `ok` (uses GET), or (2) redeploy after commit adding HEAD on `/health` + proxy `HEAD` handler.

Track Render **750 instance-hours/month** quota.

## Done checklist

- [x] `render.yaml` applied; backend healthy
- [x] `DATABASE_URL` uses `postgresql+asyncpg://`
- [x] Vercel `BACKEND_URL` set; proxy health + login 200
- [x] DB has students (seed log: 1277 students, 56301 enrollments)
- [x] Login `admin@epu.edu.vn` / `123456`
- [x] Bootstrap: ETL + ML score completed
- [x] UptimeRobot 2 monitors active
- [x] Sprint4 D59 checkbox updated

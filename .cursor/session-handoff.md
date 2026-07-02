# Session Handoff

> Generated: 2026-07-02 · Source: D59 Render + Vercel production deploy  
> New session: `@.cursor/session-handoff.md`

## Goal

Close **D59** (Live URL deliverable): production stack live, bootstrap ETL/ML, smoke pass, UptimeRobot, evidence + handoff D56 URLs.

## Status

| Area | State |
|------|-------|
| Overall | **bootstrap done** — Render ETL+ML complete; smoke/UptimeRobot/evidence remain |
| Branch | `hoang` (clean, `68395c8e` — deploy configs committed) |
| Render backend | **Live** — `https://eduinsight-backend-jxmm.onrender.com` |
| Vercel frontend | **Live** — `https://c2-app-056.vercel.app` |
| Render PG | Seeded: 1277 students, 56301 enrollments (first deploy log confirmed) |
| Tests / verify | Local: `alembic heads` → `bc4d5e6f7a81`; smoke script OK on local backend; prod health 200 |

## Decisions (settled — do not re-litigate)

- **Bootstrap local, not Render Shell:** Render Free has no Shell; use scripts + admin API from dev machine.
- **No Alembic merge:** Single head `bc4d5e6f7a81` only; verify `upgrade head`, do not create merge migrations.
- **`SEED_PASSWORD=123456` on Render:** Code default is `password123`; demo login `admin@epu.edu.vn` / `123456`.
- **Admin API paths:** `/api/v1/admin/dwh/refresh`, `/api/v1/admin/ml/train`, `/api/v1/admin/ml/score-dropout` (not `/analytics/admin/...`).
- **Vercel:** Root Directory `frontend`, Framework **Next.js** (not Services); always use `https://` URLs (308 without scheme).
- **`DATABASE_URL`:** Must be `postgresql+asyncpg://...` (internal host on Render); `AGENT_DB_URL` sync `postgresql://`.

## Done

- [x] `backend/.dockerignore` — `db/` no longer ignored (seed in Docker image).
- [x] `render.yaml` — `rootDir: backend`, `dockerContext: .`, `SEED_PASSWORD=123456`.
- [x] `backend/.env.example` — production notes + `SEED_PASSWORD`.
- [x] `docs/21-Release-Readiness/README.md` §6 + `d59-deployment-evidence.md`.
- [x] `scripts/d59-bootstrap-production.ps1`, `scripts/d59-smoke-production.ps1` (paths fixed, tested locally).
- [x] Render Blueprint applied; backend deploy + seed completed.
- [x] Vercel deploy; `/api/v1/health` → 200 with `https://c2-app-056.vercel.app`.

- [x] Production bootstrap (ETL + ML score) via Render URL (`etl_run_id=1`, `rows_upserted=1157`).

## In progress

- [ ] **Redeploy Vercel** after proxy fix (`route.ts` buffers response body — prod currently returns empty JSON).
- [ ] Render `CORS_ORIGINS=https://c2-app-056.vercel.app` + redeploy if needed.
- [ ] UptimeRobot 2 monitors + fill `d59-deployment-evidence.md`.
- [ ] Sprint4 D59 checkbox; handoff URLs to D56.

## Next steps (ordered)

1. Vercel → Project → Settings → Environment Variables → `BACKEND_URL=https://eduinsight-backend-jxmm.onrender.com` (no trailing slash); redeploy.
2. Render → `eduinsight-backend` → `CORS_ORIGINS=https://c2-app-056.vercel.app` if not set; Save/redeploy.
3. ~~Bootstrap~~ done via Render URL. Re-run smoke with `-ExecutionPolicy Bypass`.
4. Browser: login → dashboard → chat; optional CTĐT ingest via `-IngestCtdt` + External `AGENT_DB_URL`.
5. UptimeRobot: FE `https://c2-app-056.vercel.app/api/v1/health`, BE `https://eduinsight-backend-jxmm.onrender.com/health` (5 min).
6. Fill `docs/21-Release-Readiness/d59-deployment-evidence.md`; tick Sprint4 D59.

## Key files

| Path | Role |
|------|------|
| `render.yaml` | Render Blueprint (PG + Docker backend) |
| `scripts/d59-bootstrap-production.ps1` | Login → DWH → ML train/score (+ optional RAG) |
| `scripts/d59-smoke-production.ps1` | Health + login smoke |
| `docs/21-Release-Readiness/d59-deployment-evidence.md` | Live URLs + operator checklist |
| `docs/21-Release-Readiness/README.md` | §6 D59 runbook |
| `.cursor/plans/d59_render_vercel_deploy_cbc57607.plan.md` | Full plan (do not edit unless asked) |

## Commands

```powershell
# Health (always https://)
Invoke-WebRequest "https://c2-app-056.vercel.app/api/v1/health" -UseBasicParsing
Invoke-WebRequest "https://eduinsight-backend-jxmm.onrender.com/health" -UseBasicParsing

cd "C:\Users\Admin\Work\AI In Action\C2-App-056"

# Windows blocks .ps1 by default — use Bypass (or once: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned)
powershell -ExecutionPolicy Bypass -File .\scripts\d59-bootstrap-production.ps1 `
  -BaseUrl "https://eduinsight-backend-jxmm.onrender.com"
powershell -ExecutionPolicy Bypass -File .\scripts\d59-smoke-production.ps1 `
  -VercelUrl "https://c2-app-056.vercel.app" `
  -RenderUrl "https://eduinsight-backend-jxmm.onrender.com"
```

## Constraints

- Do not edit `.cursor/plans/d59_render_vercel_deploy_cbc57607.plan.md` unless user asks.
- Do not commit secrets (DB password was pasted in chat — **rotate Render PG password** after D59 stable).
- After first successful prod seed, set `SEED_ON_EMPTY=false` on Render to shorten redeploys (optional).
- Render port-scan timeout on deploy: entrypoint runs seed/CLO before bind; service still comes up — expect slow first boot.

## Blockers / open questions

- **Optional:** Add `frontend/.npmrc` with `legacy-peer-deps=true` if Vercel install fails on fresh clone.
- **Optional:** CTĐT RAG ingest on prod needs External DB URL + `OPENAI_API_KEY` locally.
- None blocking Live URL if bootstrap + smoke pass.

## Context links

- Sprint: `docs/07-Sprint-Planning/Sprint4.md` (D59 deadline 02/07 EOD)
- Plan: `.cursor/plans/d59_render_vercel_deploy_cbc57607.plan.md`
- V58 URL skeleton: `docs/09-Materials/Hieu/V58/V58-README-demo-day-skeleton.md`

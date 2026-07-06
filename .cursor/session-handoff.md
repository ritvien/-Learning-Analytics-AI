# Session Handoff

> Generated: 2026-07-06 · Source: AWS EC2 migration + cutover (PR #133) + Demo Day Phase 2 planning (H69–H75, deadline 08/07 23:00)
> New session: `@.cursor/session-handoff.md`

## Goal

Production migrated from Render (free, Oregon) to AWS EC2 (Singapore) — done and verified. Next: **Demo Day Phase 2** (deadline **08/07 23:00**) in [Sprint4.md](../docs/07-Sprint-Planning/Sprint4.md) § "Demo Day Phase 2 — EC2 migration & ops" — **H69 eval rerun on EC2 first** (latency evidence for Phase 2), then H70 monitor + H71 backup + H73 hardening in-phase; H72/H74/H75 after. There is NO Sprint5.md.

## Status

| Area | State |
|------|-------|
| Overall | EC2 cutover complete 06/07; dashboards 0.3–0.5s (was 5–61s cold on Render) |
| Branch | `main` @ `e9762e34` (PR #133 merged); EC2 host repo is on `main` |
| Production FE | `https://c2-app-056.vercel.app` (Vercel, fn region `sin1`) |
| Production BE | `https://edu-insight.duckdns.org` — EC2 `ubuntu@18.143.20.43` (Elastic IP, ap-southeast-1, x86_64, 18GB disk) |
| Stack on EC2 | `docker-compose.prod.yml`: pgvector/pgvector:**pg18** + backend + Caddy auto-TLS; env in `~/C2-App-056/.env.production` (host-only, gitignored) |
| Data | Restored from Render dump: 1824 students · 56301 enrollments · 12 `rag.ctdt_chunks`; ML model_run_id 7, 1628 scored; bundles persist in `ml_artifacts` volume |
| Vercel env | `BACKEND_URL` + `NEXT_PUBLIC_API_BASE` = `https://edu-insight.duckdns.org` (verified baked into bundle) · `NEXT_PUBLIC_ENABLE_DASHBOARD_PRELOAD=true` |
| Render | Fallback only until H72; blueprint still deploys from `main` (harmless) |
| Demo login | `admin@epu.edu.vn` / `123456` |

## Decisions (settled this session)

- **EC2 over Render paid:** region control (SG ≈40ms RTT from VN vs ~270ms), real 2 vCPU, no 30-day PG expiry, persistent ML artifacts. ~$26/mo.
- **DuckDNS domain** (`edu-insight.duckdns.org`) for now — free, PSL-listed (own LE rate limit); real domain is H75 (P2).
- **Postgres 18 required:** Render source DB is PG18 → pg_dump/pg_restore must be ≥18; pg18+ docker images mount data at `/var/lib/postgresql` (parent), NOT `/var/lib/postgresql/data` (crash-loops).
- **Shared dashboard cache + prewarm worker** (from perf session): keys carry resolved scope not user id; `DASHBOARD_PREWARM_INTERVAL_SECONDS=300`; keep `WORKERS=1` (cache is in-process).
- **Startup data jobs**: `APP_ENV=production` defaults all seed/import/ETL boot jobs OFF (Hưng's `513c677b` superseded the RUN_ANALYTICS_REFRESH_ON_STARTUP-only gate — merge conflict resolved toward main).

## Gotchas learned (do not re-struggle)

- Login endpoint is OAuth2 **form** (`username=...&password=...`), not JSON.
- `pg_restore` from a Render dump emits 4 harmless `role "postgres" does not exist` errors (ALTER DEFAULT PRIVILEGES) — ignore.
- RAG table is `rag.ctdt_chunks` (schema-qualified), not `rag_ctdt_chunks`.
- Backend image needs `postgres:*` replaced by pgvector image or migration `9f2b7c6d4a10` fails (`extension "vector" is not available`).
- Windows `.pem`: `icacls <pem> /inheritance:r` + `/grant:r "$env:USERNAME:R"` or SSH refuses the key.
- EC2 ops alias: `alias dc='docker compose -f docker-compose.prod.yml --env-file .env.production'`.

## Next steps (ordered — Sprint4.md § Demo Day Phase 2, deadline 08/07 23:00)

1. **H69 (P0) — DONE 06/07:** 100-case rerun on EC2 (`main @ e9762e34`) archived `runs/2026-07-05-223523-e9762e34/`; evaluation.md H69 section + H68↔H69 comparison. task 94.5% / tool 0.93 / grounding 0.98; p95 19.6→15.6s (−20%). No ML retrain.
2. **H70 — DONE 06/07:** UptimeRobot BE monitor 803424335 repointed Render→`https://edu-insight.duckdns.org/health` via `editMonitor` API; status Up ~240ms. EC2 `/health` supports HEAD → no 405 workaround. FE monitor unchanged.
3. **H71 (P0) — DONE 06/07:** `deploy/backup.sh` (nightly `pg_dump -Fc`, 7-slot weekly rotation) on cron `0 18 * * *` (18:00 UTC) on EC2; `deploy/backup-verify.sh` verified a 7.49 MB dump restores cleanly (72 tables, enrollments 56301) into a throwaway DB. Backups land in `~/backups/eduinsight-<weekday>.dump`.
4. **H72:** after ≥48h green, suspend Render service + final Render PG dump archive.
5. **H73/H74/H75 (P2):** AWS budget alert · GH Actions auto-deploy · real domain.

## Key files

| Path | Role |
|------|------|
| `docker-compose.prod.yml` | EC2 production stack definition |
| `deploy/README.md` | Full runbook: host setup, DB migration, cutover, backups |
| `deploy/deploy.sh` | Redeploy on EC2 (git pull + rebuild + health check) |
| `deploy/backup.sh` / `deploy/backup-verify.sh` | H71 nightly `pg_dump -Fc` (7-slot rotation) + non-destructive restore check |
| `deploy/.env.production.example` | Env template (copy to repo-root `.env.production` on host) |
| `backend/app/api/v1/endpoints/analytics.py` | Shared dashboard cache + prewarm worker |
| `docs/07-Sprint-Planning/Sprint4.md` | Sprint board — H69–H75 in § "Demo Day Phase 2 — EC2 migration & ops" |
| `docs/21-Release-Readiness/d59-deployment-evidence.md` | Deploy evidence: Render (historical) + perf knobs |

## Commands

```powershell
# Backend verify (local)
cd backend; ruff check .; pytest -q -m "not slow and not eval" --no-cov

# Frontend verify (local)
cd frontend; npm run lint; npm test

# Deploy to production (after merge to main)
ssh -i C:\Users\Admin\.ssh\eduinsight-prod.pem ubuntu@18.143.20.43 "~/C2-App-056/deploy/deploy.sh"

# Production smoke
curl https://edu-insight.duckdns.org/health
```

## Constraints

- Do not edit applied Alembic migrations — add new ones (ADR-007)
- LLM does not generate ML probabilities — agent explains only (ADR-006)
- Do not modify `.ai-log/`
- `.env.production` never committed; secrets on EC2 host only
- Render blueprint (`render.yaml`) kept until H72 — don't delete yet
- Must follow: `AGENTS.md`, `docs/decisions/`, story packets

## Blockers / open questions

- None blocking. Render free PG expires ~30 days from creation — H72 takes the final archive dump before that.
- DuckDNS has no SLA — acceptable until H75.

## Context links

- Sprint: [Sprint4.md](../docs/07-Sprint-Planning/Sprint4.md) (§ Demo Day Phase 2)
- Runbook: [deploy/README.md](../deploy/README.md)
- Eval evidence: [evaluation.md](../docs/evaluation.md) (H68 current; H69 next)
- Deploy evidence: [d59-deployment-evidence.md](../docs/21-Release-Readiness/d59-deployment-evidence.md)

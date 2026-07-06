# EduInsight — Agent Entry Point

Read this file first before changing code or docs in this repository.

## Read first (in order)

1. [docs/README.md](docs/README.md) — documentation index and authority order
2. [docs/07-Sprint-Planning/Sprint4.md](docs/07-Sprint-Planning/Sprint4.md) — sprint board; Phase 1 closed 05/07, active: § "Demo Day Phase 2 — EC2 migration & ops" (H69–H75, **deadline 08/07 23:00**)
3. Task spec for your story (e.g. [H45-Plan.md](docs/07-Sprint-Planning/H45-Plan.md), [docs/07-Sprint-Planning/stories/](docs/07-Sprint-Planning/stories/))
4. [docs/decisions/](docs/decisions/) — architecture decisions before schema/API changes

### Status (06/07/2026)

| Done | Open focus (Demo Day Phase 2, deadline 08/07 23:00) |
|:-------|:----------------------------|
| Phase 1 closed (H47/H66/H67/H68, V65/V66, D58–D63) · **AWS EC2 migration + cutover (06/07, PR #133)** · **H69 eval rerun on EC2 (done)** · **H71 nightly PG backup + restore-verify (done)** | H70 UptimeRobot · H73 billing/hardening · H72/H74/H75 sau Phase 2 |

**Production (since 06/07/2026):** Frontend [c2-app-056.vercel.app](https://c2-app-056.vercel.app) (Vercel, fn region sin1) · Backend **AWS EC2 Singapore** `https://edu-insight.duckdns.org` (docker-compose: pgvector pg18 + FastAPI + Caddy TLS — runbook [deploy/README.md](deploy/README.md)). Browser calls the backend directly via `NEXT_PUBLIC_API_BASE`; dashboards are served from a shared prewarmed cache (0.3–0.5s vs 5–61s on old Render free). **Render is fallback-only until H72** — `render.yaml` still deploys from `main` but is no longer primary. Deploy to production = merge to `main` + run `deploy/deploy.sh` on the EC2 host over SSH.

**Eval / observability:** H59/D58 LangSmith tracing done; H64 memory/cache done; H51 CTĐT RAG Q&A MVP done; H61 dataset 100 TCs; H47 review + handoff in [h47_qa_dataset_review.md](docs/12-Evaluation/h47_qa_dataset_review.md). Current evidence = **H69** rerun on EC2 (task 94.5 · tool 0.93 · grounding 0.98 · p95 **15.6s** vs 19.6s on Render — infra tail removed, LLM p95 flat) in [docs/evaluation.md](docs/evaluation.md), archive `runs/2026-07-05-223523-e9762e34/`; H68 preserved as the Render-host evidence. Do not retrain ML during eval runs (model_run_id 7 on EC2, 1628 scored).

**Session fix:** Chat session persistence + memory merge fix deployed (early user-message persist, history merge instead of overwrite, frontend cache invalidation).

**Backpressure (H67):** Max 3 concurrent agent runs (`MAX_CONCURRENT_AGENT_RUNS`) + timeout 120s (`AGENT_RUN_TIMEOUT_SECONDS`) trên cả 2 chat endpoints; busy → 429 / SSE `server_busy` + retry UI ([ADR-0011](docs/decisions/0011-agent-concurrency-limiter.md)).

Handoff snapshot: [.cursor/session-handoff.md](.cursor/session-handoff.md). UX polish backlog (non-blocking): [docs/22-UX-Simplification-Review/README.md](docs/22-UX-Simplification-Review/README.md).

## Stack map

| Path | Stack | Notes |
|:-----|:------|:------|
| `backend/` | FastAPI, LangGraph, SQLAlchemy, Alembic, pytest | Agent core in `backend/app/agent/` |
| `frontend/` | Next.js 16, React 19, Vitest | See [frontend/AGENTS.md](frontend/AGENTS.md) for Next.js 16 breaking changes |
| `docs/` | Numbered product + sprint docs | Authority hierarchy in `docs/README.md` |
| `scripts/` | Shell/PowerShell helpers, AI logging | Do not modify `.ai-log/` manually |
| `deploy/` + `docker-compose.prod.yml` | EC2 production stack (pgvector pg18, Caddy TLS) | Runbook [deploy/README.md](deploy/README.md); `.env.production` lives only on the EC2 host |

## Documentation authority

When documents conflict, prefer (highest first):

```text
DatabaseModernizationPlan / ML_DWH_Architecture
→ PRD
→ SystemArchitecture
→ Active sprint (Sprint4.md)
→ Reference or historical docs
```

## Sprint conventions

| Convention | Value |
|:-----------|:------|
| Task IDs | Hoàng: `H*`, Hưng: `T*`, Hiếu: `V*` |
| Branches | `feature/<task-id>-<short-name>` |
| Commits | Conventional: `feat:`, `fix:`, `docs:`, `test:`, `chore:` |
| Story packets | `docs/07-Sprint-Planning/stories/<TASK-ID>.md` for P0/P1 tasks |

## Do not

- Generate ML pass/fail probabilities in the LLM — predictions come from schema `ml`; agent only explains them ([ADR-006](docs/decisions/0006-ml-agent-boundary.md))
- Edit Alembic migrations that have already been applied in shared environments — add a new migration instead ([ADR-007](docs/decisions/0007-sqlalchemy-alembic.md))
- Manually write to `.ai-log/` or call logging scripts — course hooks handle this (see `.agents/rules/ai-log-hook.md`)
- Use CRUD tables directly as DWH — analytics use schema `dwh`
- Infer student specialization from class or course names in migrations

## Verify

```powershell
# Full stack (backend lint+test, frontend lint+test)
.\scripts\verify.ps1

# Quick lint only
.\scripts\verify.ps1 -Quick

# Include slow LLM agent evaluation (costs API tokens)
.\scripts\verify.ps1 -AgentEval
```

Per-layer:

```powershell
cd backend; ruff check .; pytest -q -m "not slow and not eval"
cd frontend; npm run lint; npm test
```

## Decisions and harness

- **Decisions:** [docs/decisions/](docs/decisions/) — read before changing database, API contracts, or agent behavior
- **Harness ops:** [docs/harness/README.md](docs/harness/README.md) — friction log, worksheets, maturity checklist
- **Human worklog:** [docs/worklog.md](docs/worklog.md) — team decisions (supplement, not replace ADRs)

## Agent domain references

- LangGraph design: [docs/10-References/LangGraphAgent.md](docs/10-References/LangGraphAgent.md)
- Testing: [docs/10-References/TestingGuide.md](docs/10-References/TestingGuide.md)
- Observability IDs: [docs/19-User-Behavior-Observability/README.md](docs/19-User-Behavior-Observability/README.md)
- Code style: [docs/10-References/CodeStyleGuide.md](docs/10-References/CodeStyleGuide.md)

## Frontend

Next.js 16 has breaking changes from older training data. Always read [frontend/AGENTS.md](frontend/AGENTS.md) before editing `frontend/`.

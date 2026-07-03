# EduInsight — Agent Entry Point

Read this file first before changing code or docs in this repository.

## Read first (in order)

1. [docs/README.md](docs/README.md) — documentation index and authority order
2. [docs/07-Sprint-Planning/Sprint4.md](docs/07-Sprint-Planning/Sprint4.md) — active sprint, open tasks, Demo Day final scope
3. Task spec for your story (e.g. [H45-Plan.md](docs/07-Sprint-Planning/H45-Plan.md), [docs/07-Sprint-Planning/stories/](docs/07-Sprint-Planning/stories/))
4. [docs/decisions/](docs/decisions/) — architecture decisions before schema/API changes

### Sprint 4 status (03/07/2026)

| Done | Open focus |
|:-------|:----------------------------|
| S3 carry closed · H59 · H49 · H62 · H63 · D58 · **H64** · **H51** · **D59** · **H61** · **H60/D60/D61** | D56/D57/D63 · D62 · T58 · V47/100-TC eval rerun · V56/V18–V23 buffer |

**Production:** Live URL [c2-app-056.vercel.app](https://c2-app-056.vercel.app) · smoke pass · evidence [d59-deployment-evidence.md](docs/21-Release-Readiness/d59-deployment-evidence.md).

**Eval / observability:** H59/D58 LangSmith tracing done; H64 memory/cache done; H51 CTĐT RAG Q&A MVP done; H60 71-case production evidence archived in [docs/evaluation.md](docs/evaluation.md); H61 dataset now has 100 runnable TCs and scorer support for multi-tool sequence/count checks. 100-case production rerun remains follow-up. Reference: [docs/07-Sprint-Planning/Sprint4.md](docs/07-Sprint-Planning/Sprint4.md).

Handoff snapshot: [.cursor/session-handoff.md](.cursor/session-handoff.md). UX polish backlog (non-blocking): [docs/22-UX-Simplification-Review/README.md](docs/22-UX-Simplification-Review/README.md).

## Stack map

| Path | Stack | Notes |
|:-----|:------|:------|
| `backend/` | FastAPI, LangGraph, SQLAlchemy, Alembic, pytest | Agent core in `backend/app/agent/` |
| `frontend/` | Next.js 16, React 19, Vitest | See [frontend/AGENTS.md](frontend/AGENTS.md) for Next.js 16 breaking changes |
| `docs/` | Numbered product + sprint docs | Authority hierarchy in `docs/README.md` |
| `scripts/` | Shell/PowerShell helpers, AI logging | Do not modify `.ai-log/` manually |

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
- **Human worklog:** [WORKLOG.md](WORKLOG.md) — team decisions (supplement, not replace ADRs)

## Agent domain references

- LangGraph design: [docs/10-References/LangGraphAgent.md](docs/10-References/LangGraphAgent.md)
- Testing: [docs/10-References/TestingGuide.md](docs/10-References/TestingGuide.md)
- Observability IDs: [docs/19-User-Behavior-Observability/README.md](docs/19-User-Behavior-Observability/README.md)
- Code style: [docs/10-References/CodeStyleGuide.md](docs/10-References/CodeStyleGuide.md)

## Frontend

Next.js 16 has breaking changes from older training data. Always read [frontend/AGENTS.md](frontend/AGENTS.md) before editing `frontend/`.

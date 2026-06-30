# Agent Harness File Inventory

Read this when doing a **full sync** or sprint transition. Paths are repo-relative.

## Layer 1 — Entry points (always sync)

| File | Role | Key fields to keep aligned |
|------|------|---------------------------|
| `AGENTS.md` | Root agent entry | Read-first order, sprint table, verify, do-not list |
| `docs/README.md` | Doc index | Active sprint row, authority order |
| `.cursor/session-handoff.md` | Cross-session state | Goal, done, next step (ephemeral; often gitignored) |

## Layer 2 — Cursor rules

| File | `alwaysApply` | Sync when |
|------|---------------|-----------|
| `.cursor/rules/project.mdc` | yes | Sprint path, verify, boundaries |
| `.cursor/rules/sprint-workflow.mdc` | no (`docs/07-Sprint-Planning/**`) | Active sprint, gates, owner exceptions |
| `.cursor/rules/backend.mdc` | no (`backend/**`) | Stack paths, ADR refs, verify |
| `.cursor/rules/frontend.mdc` | no (`frontend/**`) | Next.js notes, verify, API proxy |

## Layer 3 — Harness ops

| File | Role |
|------|------|
| `docs/harness/README.md` | Maturity model, workflow, verify commands |
| `docs/harness/friction-log.md` | Append-only friction → harness fixes |
| `docs/harness/templates/story-packet.md` | Default `Sprint:` field in new packets |
| `docs/harness/templates/agent-run-worksheet.md` | Optional run checklist |

## Layer 4 — Sprint & stories

| File | Role |
|------|------|
| `docs/07-Sprint-Planning/Sprint<N>.md` | **Source of truth** for task status |
| `docs/07-Sprint-Planning/stories/<TASK-ID>.md` | Per-task agent intake |
| `docs/07-Sprint-Planning/H*-Plan.md` | Feature plans linked from stories |

## Layer 5 — Decisions & domain refs (sync when behavior changes)

| Path | When to touch |
|------|---------------|
| `docs/decisions/*.md` | Schema, API contract, agent boundary changes |
| `docs/10-References/LangGraphAgent.md` | Agent graph / tool changes |
| `docs/10-References/TestingGuide.md` | Test conventions change |
| `docs/12-Evaluation/README.md` | Eval framework / metrics change |
| `frontend/AGENTS.md` | Next.js version or frontend agent rules change |

## Layer 6 — Verify & scripts (sync when commands change)

| File | Role |
|------|------|
| `scripts/verify.ps1` | Full-stack verify entry |
| `README.md` (root) | Quick start / verify if surfaced to contributors |

## Layer 7 — Course hooks (rarely sync)

| File | Note |
|------|------|
| `.agents/rules/ai-log-hook.md` | Do not modify unless course harness changes |
| `.cursor/hooks.json` | Cursor event hooks — out of scope unless user asks |

## Common stale-reference patterns

From [friction-log.md](../../../docs/harness/friction-log.md):

- Sprint status table in `AGENTS.md` lags sprint doc checkboxes
- `session-handoff.md` references closed tasks as open
- Story packet checkboxes inconsistent with merged code
- `sprint-workflow.mdc` still lists closed gates as active
- `docs/README.md` index still names previous sprint as "hiện tại"

## Story packet minimum viable sync

When closing task `<TASK-ID>`:

1. `[x]` in `Sprint<N>.md` task row
2. `[x]` all items in story packet "Done when"
3. Update `AGENTS.md` sprint table row if it lists the task
4. Append friction log only if something surprised the agent

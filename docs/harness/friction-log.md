# Harness Friction Log

Append-only backlog of agent friction. Each entry is input for harness improvements (rules, decisions, verify, story packets).

Format:

```markdown
## YYYY-MM-DD — Short title
- **Task:** H48
- **Expected:** ...
- **Actual:** ...
- **Root cause:** ...
- **Harness fix:** ... (rule / ADR / verify / story packet)
```

---

## 2026-06-26 — Sprint docs drift vs code

- **Task:** docs sync
- **Expected:** Agents read current sprint state before picking work
- **Actual:** `session-handoff.md` and several story packets stale (24/06); G3-3/V41/T53 checkboxes inconsistent with code
- **Root cause:** Tasks completed without updating harness docs in same PR
- **Harness fix:** Synced Sprint3 snapshot, story packets, session-handoff, AGENTS.md sprint table; observability README clarifies V43 not built yet

---

## 2026-06-23 — Harness bootstrap

- **Task:** harness setup
- **Expected:** New agents read product intent before patching
- **Actual:** Only `frontend/AGENTS.md` existed; no root entry point or decisions folder
- **Root cause:** Agent guidance scattered across docs without orchestration layer
- **Harness fix:** Added root `AGENTS.md`, `.cursor/rules/`, `docs/decisions/`, `scripts/verify.ps1`

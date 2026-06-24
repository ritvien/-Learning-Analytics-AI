---
name: compact-session-handoff
description: >-
  Compacts the current agent chat into `.cursor/session-handoff.md` for
  continuation via @-mention in a new Cursor session. Use when the user asks to
  compact, summarize, or hand off the session, continue in a new chat, or
  avoid losing progress when context is full.
---

# Compact Session Handoff

Produce a **dense, actionable** handoff at `.cursor/session-handoff.md`. The user continues in a **new** Agent chat by `@`-mentioning that file only.

## When to run

- Context window is getting full
- User is starting a new chat but wants continuity
- Long task spans multiple sessions
- User says: compact, handoff, continue in new chat, inject session

## What you cannot do

There is **no API** to open a new Cursor chat with pre-loaded context. Injection is always: user starts a new chat and `@`-mentions `.cursor/session-handoff.md`.

Do **not** offer paste, drag-and-drop, or inline copy of the full handoff as alternate injection methods.

## Workflow

1. **Gather** — Use this chat's history. Optionally read the transcript under `.cursor/projects/<project>/agent-transcripts/` if turns are missing from context.
2. **Compact** — Fill [handoff-template.md](handoff-template.md). Drop noise; keep decisions, paths, blockers, next steps.
3. **Write** — Overwrite `.cursor/session-handoff.md` in the workspace root.
4. **Deliver** — Tell the user:
   - Handoff path: `.cursor/session-handoff.md`
   - Word/token size (rough: chars ÷ 4 ≈ input tokens)
   - **Exact first message** for the new session (template below)
   - Do **not** dump the full handoff in chat — the file is the single source of truth

## Compaction rules

| Keep | Drop |
|------|------|
| Active goal and definition of done | Exploratory tangents already resolved |
| Decisions made (one-line rationale) | Full code dumps — use `path:line` refs |
| Files touched and what changed | Raw tool output |
| Commands run and pass/fail | Duplicate turns |
| Open blockers and ordered next steps | Content already in repo docs |
| Constraints and "do not touch" | Extra @-mention targets (next agent reads files on demand) |

**Target size:** ~400–1200 words (~1.5k–2k tokens). Prefer bullets over prose.

## Continue in a new session

User opens a **new** Agent chat and sends **only**:

```text
Continue from session handoff. Read @.cursor/session-handoff.md first, then <single next action>.

Current focus: <one sentence>
Do not: <constraints if any>
```

Rules for the user message:

- **Always** `@.cursor/session-handoff.md` — never paste the handoff body
- **Do not** `@`-mention other files in the opening message unless strictly required
- Optional one-line focus and next action only; details stay in the handoff file

## gitignore

Recommend adding to `.gitignore` if missing:

```gitignore
.cursor/session-handoff.md
```

## Quality check

Before finishing, verify the handoff answers:

1. What is the user trying to accomplish **right now**?
2. What is **already done** (files, tests)?
3. What is the **single best next step**?
4. What must the next agent **not** redo or break?

If any answer is missing, update the file before delivering.

## Additional resources

- Output structure: [handoff-template.md](handoff-template.md)

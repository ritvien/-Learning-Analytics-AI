---
name: sync-agent-harness
description: >-
  Synchronizes agent-facing docs, Cursor rules, and harness artifacts in
  EduInsight. Use when the user asks to update docs/rules/harness for agents,
  sync agent guidance, rotate sprints, close tasks, fix doc drift, or after
  harness friction. Also use after major feature merges that change verify
  commands, ADRs, or sprint status.
---

# Sync Agent Harness

Keep **one coherent story** for every coding agent: what to read, what sprint is active, what is done, and how to verify.

## When to run

| Trigger | Scope |
|---------|-------|
| Sprint transition (e.g. S3 → S4) | Full sync — all layers below |
| Task closed in sprint doc | Sprint snapshot + story packet + optional handoff |
| Friction discovered | Append `friction-log.md` + fix the cited harness layer |
| New ADR or verify command | ADR + rules + `AGENTS.md` + affected story packets |
| User says "update docs/rules/harness" | Full sync unless they narrow scope |

## Ground truth (read before editing)

1. **Code & tests** — `git log`, `git diff`, story packet "Done when"
2. **Active sprint** — `docs/07-Sprint-Planning/Sprint<N>.md` (highest open sprint)
3. **Decisions** — `docs/decisions/` for anything touching schema, API, or agent behavior
4. **Friction** — `docs/harness/friction-log.md` for known drift patterns

Do not invent status. Checkbox in sprint doc must match merged code.

## Sync order

Edit top-down so downstream files inherit correct pointers:

```
1. Sprint doc (Sprint<N>.md)     — task status, gates, deadlines
2. docs/decisions/               — only if architecture changed
3. AGENTS.md                     — entry point, sprint table, verify, links
4. docs/README.md                — index row for active sprint + key artifacts
5. .cursor/rules/*.mdc           — project + sprint-workflow (+ backend/frontend if stack changed)
6. docs/harness/README.md        — workflow links to active sprint
7. Story packets (stories/)      — status, depends, verify, "Read first"
8. .cursor/session-handoff.md    — only if continuity needed (use compact-session-handoff skill)
9. docs/harness/friction-log.md  — append entry when friction drove the sync
```

## Per-file checklist

### `AGENTS.md` (root)

- [ ] "Read first" points to **active** sprint file (not closed sprint)
- [ ] Sprint status table matches sprint doc checkboxes
- [ ] Stack map, verify commands, and "Do not" boundaries still accurate
- [ ] Links use relative paths (no `file:///`)

### `docs/README.md`

- [ ] "Kế hoạch thực thi hiện tại" row → active `Sprint<N>.md` with current date note
- [ ] Authority order unchanged unless ADR added

### `.cursor/rules/project.mdc`

- [ ] `Active work:` → active sprint path
- [ ] Testing / verify commands match `scripts/verify.ps1`
- [ ] Boundaries align with ADRs (ML boundary, DWH, `.ai-log/`)

### `.cursor/rules/sprint-workflow.mdc`

- [ ] `Active sprint:` link → `Sprint<N>.md`
- [ ] Gate / carry-over section reflects closed vs open gates
- [ ] Owner exceptions table matches sprint doc

### `.cursor/rules/backend.mdc` / `frontend.mdc`

Update only when stack paths, verify commands, or ADR references changed.

### `docs/harness/README.md`

- [ ] Workflow step 1 links to active sprint
- [ ] Step 7 names correct sprint file for task-close updates

### Story packets (`docs/07-Sprint-Planning/stories/<TASK-ID>.md`)

- [ ] `Sprint:` field matches active sprint
- [ ] Checkboxes mirror sprint doc
- [ ] `Verify` command still runs and proves "Done when"
- [ ] `Do not touch` still valid (no cross-owner conflicts)

### `docs/harness/friction-log.md`

When sync was triggered by drift or agent failure:

```markdown
## YYYY-MM-DD — Short title
- **Task:** <id>
- **Expected:** ...
- **Actual:** ...
- **Root cause:** ...
- **Harness fix:** ... (which files updated)
```

## Sprint transition extras

When opening `Sprint<N+1>.md` and closing `Sprint<N>.md`:

1. Mark sprint N header as closed with confirmation date
2. Move open tasks / carry-over into sprint N+1 (preserve task IDs)
3. Replace **every** stale `Sprint3` reference in agent layers if S4 is active:
   - `AGENTS.md`, `docs/README.md`, `project.mdc`, `sprint-workflow.mdc`, `harness/README.md`, story-packet template
4. Update gate priority section in `sprint-workflow.mdc`
5. Do **not** rewrite historical sprint files — add closure note only

## Consistency grep

After edits, search for stale references:

```powershell
# Replace N with the OLD sprint number when rotating
rg "Sprint3" AGENTS.md docs/README.md .cursor/rules docs/harness --glob "*.md" --glob "*.mdc"
rg "G3-" .cursor/rules/sprint-workflow.mdc  # gate refs should match current sprint
```

Fix or justify every hit (historical sprint files and explicit "Sprint trước" links are OK).

## Authority on conflicts

Highest wins:

```text
DatabaseModernizationPlan / ML_DWH_Architecture
→ PRD → SystemArchitecture → Active sprint → Reference/historical docs
```

Harness docs (`AGENTS.md`, rules) **summarize** authority docs — never contradict them.

## Output

When done, report:

1. **Trigger** — why sync ran
2. **Files changed** — bullet list with one-line delta each
3. **Intentional skips** — files checked but unchanged
4. **Remaining drift** — anything blocked on unmerged code or open decisions
5. **Suggested verify** — `.\scripts\verify.ps1 -Quick` if only docs; full verify if code touched

## Do not

- Edit `.ai-log/` or logging hooks
- Rewrite closed sprint history or meeting notes
- Update product PRD/architecture unless the user asked or an ADR requires it
- Dump large doc bodies into chat — point to paths

## Additional resources

- Full file inventory and glob targets: [inventory.md](inventory.md)
- Session continuity: [compact-session-handoff](../compact-session-handoff/SKILL.md)
- Harness ops context: [docs/harness/README.md](../../../docs/harness/README.md)

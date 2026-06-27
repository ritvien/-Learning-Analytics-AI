# Harness Engineering — EduInsight

Operational docs for coding agents working in this repo. Not product documentation — see [docs/README.md](../README.md) for that.

## Maturity target

| Level | Description | This repo |
|:-----:|:------------|:----------|
| H0 | Bare prompt only | — |
| H1 | Static policy (`AGENTS.md`, rules) | **Current baseline** |
| H2 | Durable state + verify commands | **Target** — `docs/decisions/`, `scripts/verify.ps1` |
| H3 | Friction capture + observability | **In progress** — `friction-log.md` |
| H4 | Mechanical verification per story | Story packets with verify commands |
| H5 | Self-improving harness | Future — friction → proposals |

## Five diagnostic questions

Ask before, during, and after every agent run:

1. **What does the agent see?** — `AGENTS.md`, story packet "Read first", linked decisions
2. **What can the agent do?** — Cursor rules, tools, "Do not touch" scope
3. **What did the agent actually do?** — git diff, logs, observability trace
4. **What did the agent miss?** — Record in [friction-log.md](./friction-log.md)
5. **What should the next agent inherit?** — New ADR, rule update, or story packet fix

## Workflow

1. Pick task from [Sprint3.md](../07-Sprint-Planning/Sprint3.md)
2. Open story packet in `docs/07-Sprint-Planning/stories/` if it exists
3. Fill [agent-run-worksheet](./templates/agent-run-worksheet.md) (optional, for complex tasks)
4. Run agent
5. Run verify command from story packet or `.\scripts\verify.ps1`
6. On surprise/failure → append [friction-log.md](./friction-log.md)
7. When closing or re-scoping tasks → update [Sprint3.md](../07-Sprint-Planning/Sprint3.md) + [.cursor/session-handoff.md](../../.cursor/session-handoff.md) in the same change set

## Templates

- [story-packet.md](./templates/story-packet.md) — intake before agent run
- [agent-run-worksheet.md](./templates/agent-run-worksheet.md) — before/during/after checklist

## Verify commands

```powershell
.\scripts\verify.ps1           # full
.\scripts\verify.ps1 -Quick    # lint only
.\scripts\verify.ps1 -AgentEval  # + LLM eval (slow, costs tokens)
```

## References

- Root agent entry: [AGENTS.md](../../AGENTS.md)
- Session handoff: [.cursor/session-handoff.md](../../.cursor/session-handoff.md)
- Architecture decisions: [docs/decisions/](../decisions/)
- Slide deck inspiration: [Harness Engineering](https://codeharness.kuckit.dev/deck-vi/)

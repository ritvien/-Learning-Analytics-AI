# Session Handoff

> Updated: 2026-07-03 · Source: Hoàng AI/eval/deploy sync  
> New session: `@.cursor/session-handoff.md`

## Goal

Hoàng-side Sprint 4 AI/eval/deploy tasks through **H61/H60/D60/D61** are closed or evidence-backed. Current focus shifts to remaining Demo Day docs and rerun follow-up for the new 100-case eval set.

## Status

| Area | State |
|------|-------|
| Overall | **Production live + H60 evidence archived + H61 dataset expanded to 100 TC** |
| Branch | `hoang` |
| Frontend | `https://c2-app-056.vercel.app` |
| Backend | `https://eduinsight-backend-jxmm.onrender.com` |
| Demo login | `admin@epu.edu.vn` / `123456` |
| Eval evidence | [docs/evaluation.md](../docs/evaluation.md) |
| Latest archived eval run | [2026-07-02-123303-daff93fb](../docs/12-Evaluation/runs/2026-07-02-123303-daff93fb/report.md) |

## Hoàng Done

- [x] H59/D58: LangSmith/prompt-version evidence path.
- [x] H49: chatbot data-access scope and ML/DWH/CTĐT boundary.
- [x] H62/H63/H51: CTĐT corpus, pgvector index, Universal Chat RAG tool with citations.
- [x] H64: memory/cache plan and prompt policy alignment.
- [x] D59: Render + Vercel production live, smoke pass, UptimeRobot monitors.
- [x] H60/D60/D61: 71-case production eval evidence and coverage artifact archived.
- [x] H61 R2: `gate3_test_cases.json` expanded to 100 contiguous TCs; scorer supports ordered multi-tool sequence/count checks.

## Still Open / Follow-Up

1. **H47 (ex-V47):** Hoàng review 100 TC dataset — golden, RBAC, intent tags.
2. **H66:** optimize eval metrics/scorer; 100-case production rerun; refresh D60 if gates improve.
3. **V66:** QA toàn page + screenshots → `docs/21-Release-Readiness/ui-qa-evidence.md` (feed D56).
4. **D56:** README Demo Day final polish: screenshots, team, Live URL, API summary.
5. **D57:** `docs/architecture.md` export/copy from README once D56 is stable.
6. **D62/T58:** user feedback and slide/rehearsal remain team/demo-day follow-ups.

**Note:** `docs/evaluation.md` remains immutable 71-case H60 evidence until H47/H66 complete a 100-case rerun.

## Verify Commands

```powershell
cd backend
pytest tests/test_eval_scorers.py tests/test_eval_dataset_h61.py -q --no-cov
ruff check app/eval/scorers/tool_accuracy.py app/eval/scorers/task_completion.py app/eval/scorers/grounding.py tests/test_eval_scorers.py tests/test_eval_dataset_h61.py
```

Full backend non-eval check:

```powershell
cd backend
pytest -q -m "not slow and not eval" --no-cov --basetemp .pytest-tmp
```

## Context

- Sprint: [Sprint4.md](../docs/07-Sprint-Planning/Sprint4.md)
- Eval methodology: [agent_eval_methodology.md](../docs/12-Evaluation/agent_eval_methodology.md)
- H61 coverage map: [h61_eval_expansion.md](../docs/12-Evaluation/h61_eval_expansion.md)
- Production evidence: [d59-deployment-evidence.md](../docs/21-Release-Readiness/d59-deployment-evidence.md)

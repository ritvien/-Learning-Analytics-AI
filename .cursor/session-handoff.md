# Session Handoff

> Generated: 2026-06-28 · Source: Agent eval 6-metric framework + 35 TC + infra/scorer fixes  
> New session: `@.cursor/session-handoff.md`

## Goal

Có pipeline đánh giá Agent EduInsight **6 metrics** (task completion, tool accuracy, semantic, grounding, latency, cost) với báo cáo tin cậy — dataset ≥35 TC, eval script chạy được, metrics đo từ runtime thật (không chỉ estimate).

## Status

| Area | State |
|------|-------|
| Overall | in progress — framework + instrumentation **done**; **cần re-run eval** sau restart backend |
| Tests / verify | pass — `pytest tests/test_eval_scorers.py -q --no-cov` (19 tests) |
| Branch `hoang` | docs/12-Evaluation pushed (`86542d7` + doc clarifications pending) |
| Backend code | instrumentation **local uncommitted** — `:8000` hiện vẫn `usage: null` |
| Last eval artifact | 35 TC @ 14:07 UTC — cost **estimated** (`measured_rate=0`); smoke measured **OK** khi server có code mới |

## Cost: measured vs estimated (quan trọng)

| | Trạng thái |
|:--|:-----------|
| **Code** | ✅ `token_accumulator`, `chat.py`, `nodes.py`, `instrumentation.py` |
| **Smoke 1 request** | ✅ Measured (~1,124 tok → ~$0.000356) khi backend chạy bản có instrumentation |
| **Artifact 35 TC** | ⚠️ Estimated — eval chạy **trước** khi server load instrumentation (`usage: null` mọi TC) |
| **`:8000` hiện tại** | ⚠️ `usage: null` — cần restart với code instrumentation |

## Decisions (settled — do not re-litigate)

- **6-metric framework:** deterministic scorers mặc định; LLM judge optional (`--with-judge`), không CI.
- **Judge model (chưa implement config):** primary `gpt-5.4-mini`, regression `gpt-5-mini` — chưa có `AGENT_EVAL_JUDGE_MODEL`.
- **Dataset size:** 35 TC cho phase hiện tại; mục tiêu 40–50 sau.
- **Tool success ReAct:** pass nếu ≥1 tool call thành công (không penalize retry).
- **Numeric match:** normalize % ↔ decimal qua `numeric_match.py`.
- **Không sửa** plan file `.cursor/plans/agent_metrics_evaluation_*.plan.md`.

## Done

- [x] 6-metric eval package — `backend/app/eval/` (scorers, judges, token_accumulator, dataset_loader)
- [x] Refactor `backend/scripts/run_evaluation.py` → `agent_eval_results.json` + `agent_eval_metrics.md` (+ gate3 backward compat)
- [x] Runtime instrumentation — `nodes.py`, `instrumentation.py`, `chat.py` (`usage`, `latency_breakdown`, per-tool `duration_ms`)
- [x] LLM judges — `semantic_judge.py`, `grounding_judge.py`, `run_agent_eval_judge.py`
- [x] CI tests — `backend/tests/test_eval_scorers.py` (19 pass)
- [x] Methodology + README — `docs/12-Evaluation/` (35 TC, aggregates, cost measured vs estimated)
- [x] Expand dataset 26→35 TC — TC27–TC35 in `gate3_test_cases.json`
- [x] First full eval run (35 TC) — artifacts committed on `hoang`
- [x] Infra/scorer fixes — `record_llm_from_ai_message()`, timed tools, numeric_match, ReAct tool_success

## In progress

- [ ] **Restart backend** với code instrumentation → smoke `usage` non-null
- [ ] **Re-run eval** 35 TC → `measured_rate = 100%`, cost measured trong artifact
- [ ] **Commit + push** backend eval code (local uncommitted)

## Next steps (ordered)

1. Restart backend trên `:8000` (process phải load instrumentation).
2. Smoke: `usage` + `latency_breakdown` non-null.
3. Re-run: `cd backend; python scripts/run_evaluation.py --base-url http://127.0.0.1:8000`
4. Commit backend eval code + refreshed `docs/12-Evaluation/*_results.json`.
5. *(P2)* Refresh golden `expected_values`; fix TC27–30 MSSV; `AGENT_EVAL_JUDGE_MODEL`.

## Key files

| Path | Role |
|------|------|
| `docs/12-Evaluation/README.md` | Tổng hợp metrics + § Cost measured vs estimated |
| `backend/scripts/run_evaluation.py` | Orchestrator 6 metrics |
| `backend/app/eval/token_accumulator.py` | Usage + cost_usd |
| `docs/12-Evaluation/agent_eval_results.json` | Artifact 35 TC (**cost estimated**) |

## Commands

```powershell
cd backend
pytest tests/test_eval_scorers.py -q --no-cov
python -c "import requests; ..."
python scripts/run_evaluation.py --base-url http://127.0.0.1:8000
```

## Blockers

- Backend `:8000` chưa trả `usage` — restart/deploy instrumentation code
- Golden drift → semantic misleading until refresh
- ML dropout TC28–30 data-side gaps

## Context links

- [G3-DemoDay-Checklist.md](../docs/07-Sprint-Planning/G3-DemoDay-Checklist.md)
- [agent_eval_methodology.md](../docs/12-Evaluation/agent_eval_methodology.md)

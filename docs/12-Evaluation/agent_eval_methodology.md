# Agent Evaluation Methodology — 6 Metrics

**Authority:** Gate G3 extension · Dataset: [`gate3_test_cases.json`](./gate3_test_cases.json)  
**Orchestrator:** `backend/scripts/run_evaluation.py`  
**Scorers:** `backend/app/eval/scorers/`  
**Tổng hợp metrics mới nhất:** [README.md](./README.md)

---

## 1. Metrics overview

| Metric | Scorer | Primary signal | Suggested threshold |
|:-------|:-------|:---------------|:--------------------|
| Task completion | `task_completion.py` | HTTP OK + intent + category outcome | ≥85% Pass (weighted) |
| Tool-call accuracy | `tool_accuracy.py` | Selection + args + ordered sequence/counts vs expected tool fields | ≥80% composite |
| Semantic accuracy | `semantic.py` + optional `semantic_judge.py` | Numeric/entity match + LLM judge | ≥0.75 normalized |
| Grounding | `grounding.py` + optional `grounding_judge.py` | Response numbers ⊆ tool outputs | ≥0.70 faithfulness |
| Latency / task | `latency.py` | E2E + breakdown (router, LLM, tools) | p95 ≤15s |
| Cost / task | `cost.py` | Measured tokens × pricing; fallback estimate | Report actual vs estimate |

**Cost note:** Measured path (`usage.cost_usd` from `token_accumulator`) works when backend runs instrumentation code. Batch eval artifact is **estimated** if run before server restart (`measured_rate = 0`). See [README § Cost](./README.md#cost-measured-vs-estimated).

---

## 2. Dataset schema (v2)

Each test case may include:

- `expected_tools` — unique tool names expected for selection scoring
- `expected_tool_sequence` — optional ordered tool list for multi-tool cases
- `expected_tool_counts` — optional per-tool call counts, used when a case needs repeated calls
- `expected_values` — `{field, value, tolerance}` for numeric golden checks (from G2 `results.json`)
- `completion_criteria` — e.g. `has_numeric_answer`, `intent_match`, `tool_success`
- `expected_outcome` — `numeric_answer`, `refusal`, `chit_chat`, etc.

---

## 3. Scoring layers

### Deterministic (default, CI-safe)

Runs on every eval pass without extra LLM cost:

- Keyword / guardrail patterns (backward compatible with Gate G3)
- Tool trace comparison and SQL arg heuristics
- Numeric extraction from response vs golden / tool output
- Rule-based grounding (numbers in answer must appear in tool output)

### LLM-as-judge (optional, `--with-judge`)

- **Semantic:** `semantic_judge.py` — correctness + completeness 1–5 vs golden reference
- **Grounding:** `grounding_judge.py` — unsupported claims vs concatenated tool context

Run judge-only on saved results: `python scripts/run_agent_eval_judge.py`

**Not in CI** — marked `@pytest.mark.eval`; excluded via `pytest -m "not eval"`.

---

## 4. Runtime instrumentation

Measured on `POST /api/v1/chat` (not stream):

- `usage` — prompt/completion tokens, `cost_usd`, per-step breakdown (`token_accumulator.py`)
- `latency_breakdown` — router, core/fast LLM, per-tool `duration_ms` + `sequence`

Falls back to static `TOKEN_ESTIMATES` when provider omits `token_usage`.

---

## 5. Commands

```powershell
# Full eval (backend + DB + LLM required)
cd backend
python scripts/run_evaluation.py --base-url http://localhost:8000

# With LLM judge
python scripts/run_evaluation.py --with-judge

# CI-safe unit tests
pytest tests/test_eval_scorers.py -q --no-cov

# Full verify including agent eval
.\scripts\verify.ps1 -AgentEval
```

---

## 6. Outputs

| File | Content |
|:-----|:--------|
| `agent_eval_results.json` | Raw traces + per-TC scores (6 metrics) |
| `agent_eval_metrics.md` | Aggregate report + per-TC table |
| `gate3_eval_results.json` | Legacy Gate G3 format (backward compat) |
| `gate3_eval_metrics.md` | Legacy report |

---

## 7. Limitations

- **Non-deterministic LLM** — single baseline run; use `--repeat N` for regression-sensitive TCs.
- **Golden drift** — numeric tolerances assume current seed DB; pin seed version in reports.
- **Stream path** — `/chat/stream` does not yet expose `usage` / `latency_breakdown`.
- **No RAG** — grounding uses tool outputs, not retrieval chunks (RAGAS context metrics N/A).
- **Judge cost** — prefer rule-based gate first; judge failures or sample only when needed.

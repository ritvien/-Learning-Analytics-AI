# EduInsight Evaluation Evidence

This is the D60 submission summary for the AI20K Demo Day package. It
summarizes the archived H60 production evaluation run, links the immutable
artifacts, and states the remaining release risks without lowering the gates.

## Submission Snapshot

| Field | Value |
|:--|:--|
| Task | D60, based on H60 evaluation rerun |
| Run timestamp | `2026-07-02T12:33:03.432964+00:00` |
| Commit | `daff93fb` (`dirty=True`) |
| Dataset | `h61-expanded-71` |
| Dataset hash | `gate3-h61-71-5b0c13a5c2f6` |
| Scope | 71 runnable cases: analytics, lookup, aggregation, dropout, guardrails, reports, and CTDT RAG |
| Environment | Production API at `https://eduinsight-backend-jxmm.onrender.com` |
| Result source | Chat API responses plus evaluator scorers |

Current dataset note, 2026-07-03: `gate3_test_cases.json` has since been
expanded to 100 runnable cases for H61/H60 R2 review. This page remains the
immutable 71-case H60 evidence until a 100-case production rerun is executed
and archived.

## BTC Evidence Checklist

| Requirement | D60 evidence |
|:--|:--|
| Test results and coverage | Backend pytest coverage artifact: `413 passed`, total coverage `61.35%`, required `60%` reached |
| Agent/RAG quality metrics | Six-metric rubric: task completion, tool accuracy, semantic accuracy, grounding, latency, cost |
| Performance metrics | End-to-end latency p50/p95/p99 and tool/LLM latency breakdown in `metrics.json` |
| Cost metrics | Measured API cost when available, with source labels and fallback marking |
| Code traceability | Test-case ranges mapped to feature areas below; raw cases stored with the run |
| User feedback | Tracked separately by D62; D60 is the automated evaluation evidence package |

## Summary Metrics

| Metric | Result | Gate | Status |
|:--|--:|--:|:--|
| Task completion | **74.6%** | >=85% | Miss |
| Tool accuracy | **0.82** | >=0.80 | Pass |
| Semantic accuracy | **0.68** | >=0.75 | Miss |
| Grounding | **0.80** | >=0.70 | Pass |
| Latency p95 | **18,061 ms** | <=15,000 ms | Miss |
| Latency p50 | **6,309 ms** | measured | Measured |
| Latency p99 | **21,269 ms** | measured | Measured |
| Cost avg/task | **$0.002362** | measured preferred | Measured |
| Cost p95/task | **$0.005580** | measured preferred | Measured |
| Cost measured rate | **90.1%** | 100% target | Miss |

## Gate Decision

**Decision:** D60 is complete as evaluation evidence for Demo Day submission,
but the H60 run is **not a full release-gate pass**.

The run passes the measured grounding and tool-accuracy gates. It misses task
completion, semantic accuracy, latency p95, and complete measured-cost coverage.
These misses are intentionally preserved in the evidence so the submission is
auditable and the next rerun has a clear target.

## Runtime Provenance

| Field | Value |
|:--|:--|
| Base URL | `https://eduinsight-backend-jxmm.onrender.com` |
| LLM provider | `openai` |
| Router model | `gpt-5.4-nano` |
| Core model | `gpt-5.4-nano` |
| Embedding model | `text-embedding-3-small` |
| Eval identity | `lecturer@epu.edu.vn` |
| LangSmith tracing | `true`, project `EduInsight` |
| Runtime config hash | `006bb24c38f0d1fa` |

Prompt versions:

| Prompt | Version | Checksum prefix |
|:--|:--|:--|
| `router` | `2026-07-01.2` | `3b0678171174` |
| `core_agent` | `2026-07-01.2` | `1656af050c45` |
| `fast_response` | `2026-07-01.1` | `e3ab4d024b9d` |

## Category Slices

| Category | Cases | Task | Tool | Semantic | Grounding |
|:--|--:|--:|--:|--:|--:|
| chit_chat | 3 | 100.0% | N/A | 0.89 | 1.00 |
| ctdt_rag | 8 | 50.0% | 0.85 | 0.97 | 0.88 |
| data_query | 40 | 70.0% | 0.80 | 0.61 | 0.68 |
| guardrail_injection | 4 | 100.0% | 1.00 | 0.83 | 1.00 |
| guardrail_privacy | 2 | 100.0% | 1.00 | 0.67 | 1.00 |
| guardrail_safety | 1 | 100.0% | N/A | 0.67 | 1.00 |
| guardrail_scope | 11 | 81.8% | 0.81 | 0.61 | 1.00 |
| guardrail_uncertainty | 2 | 100.0% | 1.00 | 0.70 | 1.00 |

## Traceability

| Test cases | Feature slice | Main code or data surface |
|:--|:--|:--|
| TC01-TC10 | Gate 2 analytics baseline and refreshed numeric goldens | `backend/app/agent/tools.py`, `dwh` analytics views |
| TC11-TC18 | Aggregation, tree, abbreviations, routing | `backend/app/agent/route_decision.py`, tree and analytics APIs |
| TC19-TC26 | Safety, privacy, injection, uncertainty guardrails | `backend/app/agent/guardrails.py`, prompt policy |
| TC27-TC35 | Lookup, dropout, CLO, router, comparison tools | student lookup, ML prediction, CLO tool surfaces |
| TC36-TC38 | CTDT RAG for CNTT/KHDL/TTNT with citations | `backend/app/rag/ctdt_retrieval.py`, `rag.ctdt_chunks` |
| TC39-TC71 | Sprint 4 CTDT, dropout, RBAC, CLO, report, analytics expansion | agent tools, report service, RBAC context, production data |

The current H61 dataset expansion adds TC72-TC100 for harder multi-tool,
linguistic, dropout-boundary, CTDT, and data-edge cases. See
[12-Evaluation/h61_eval_expansion.md](12-Evaluation/h61_eval_expansion.md).

## Evidence Files

| Artifact | Link |
|:--|:--|
| Human-readable run report | [12-Evaluation/runs/2026-07-02-123303-daff93fb/report.md](12-Evaluation/runs/2026-07-02-123303-daff93fb/report.md) |
| Run manifest and provenance | [12-Evaluation/runs/2026-07-02-123303-daff93fb/manifest.json](12-Evaluation/runs/2026-07-02-123303-daff93fb/manifest.json) |
| Frozen test cases used by the run | [12-Evaluation/runs/2026-07-02-123303-daff93fb/cases.json](12-Evaluation/runs/2026-07-02-123303-daff93fb/cases.json) |
| Raw API responses and scorer input | [12-Evaluation/runs/2026-07-02-123303-daff93fb/raw-results.json](12-Evaluation/runs/2026-07-02-123303-daff93fb/raw-results.json) |
| Machine-readable metrics | [12-Evaluation/runs/2026-07-02-123303-daff93fb/metrics.json](12-Evaluation/runs/2026-07-02-123303-daff93fb/metrics.json) |
| Backend pytest coverage output | [12-Evaluation/runs/2026-07-02-123303-daff93fb/coverage-out.txt](12-Evaluation/runs/2026-07-02-123303-daff93fb/coverage-out.txt) |

## Method

- Task completion checks HTTP success, expected route/intent, required outcomes,
  citation presence, and guardrail refusal patterns.
- Tool accuracy scores selection, argument validity, call order, and tool
  success against each case policy.
- Semantic scoring uses numeric matches and keyword overlap, with optional LLM
  judge support.
- Grounding requires response numbers to trace back to tool outputs and blocks
  fabricated dropout probabilities.
- Cost uses measured `usage.cost_usd` from the API when available; otherwise the
  artifact marks the static estimate fallback.
- Dropout risk evidence follows ADR-006: the agent may explain persisted ML
  predictions but must not generate probabilities.

## Reproduce

Run the normal verification suite without paid eval:

```powershell
.\scripts\verify.ps1
```

Run the agent evaluation path when production/backend credentials and provider
budget are available:

```powershell
.\scripts\verify.ps1 -AgentEval
```

Backend-only quick checks:

```powershell
cd backend
ruff check .
pytest -q -m "not slow and not eval"
```

## Follow-up Before Replacing This Evidence

- Fix production data/tool failures that drive partial completions.
- Refresh stale numeric goldens where T55e seed data changed.
- Rerun the current 100-case H61 dataset against production and archive a new
  immutable run folder instead of overwriting this one.
- Add retrieval recall and citation precision metrics for CTDT RAG.
- Add per-role auth fixture matrices and multi-turn evaluation once runner
  support exists.

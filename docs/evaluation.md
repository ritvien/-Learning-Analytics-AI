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

> **Update 2026-07-05 (H66):** the 100-case production rerun is done and
> archived. Current evidence is in the
> [H66 section](#h66--100-case-production-rerun-2026-07-05) at the end of
> this page; the H60 content below is preserved unchanged as historical
> evidence.

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

- [x] Fix production data/tool failures that drive partial completions — done in H66 (see below).
- [x] Refresh stale numeric goldens where T55e seed data changed — done in H66 via read-only production audit.
- [x] Rerun the current 100-case H61 dataset against production and archive a new
  immutable run folder instead of overwriting this one — `runs/2026-07-05-052509-941f4e36/`.
- Add retrieval recall and citation precision metrics for CTDT RAG.
- Add per-role auth fixture matrices and multi-turn evaluation once runner
  support exists.

---

# H66 — 100-case Production Rerun (2026-07-05)

Current evaluation evidence. Archived immutable run folder:
`docs/12-Evaluation/runs/2026-07-05-052509-941f4e36/` (manifest, cases,
raw results, metrics, report).

## Snapshot

| Field | Value |
|:--|:--|
| Task | H66 (optimize eval metrics & scorer) after H47 QA review |
| Run timestamp | `2026-07-05T05:25:09+00:00` |
| Deployed backend | `main` @ `98c8ec83` (PRs #125–#128) |
| Dataset | `h61-expanded-100`, hash `gate3-h61-100-a0c713adb2fd` |
| Prompts | `core_agent 2026-07-04.2` (SQL retry cap, multi-tool planning, unqualified view names) · `router 2026-07-01.2` · `fast_response 2026-07-01.1` |
| Environment | Production API `https://eduinsight-backend-jxmm.onrender.com` (Render free tier) |
| Judge | Off (`with_judge=false`, same as H60) |

## Three measurement milestones

Same 6-metric rubric throughout. The offline re-score replays the archived
H60 responses through the current scorers — it isolates scorer/dataset
effects from model/production effects.

| Metric | H60 archived (old scorers, 71 cases) | Offline re-score (current scorers, same 71 responses) | **H66 production rerun (100 cases)** | Gate | Status |
|:--|--:|--:|--:|--:|:--|
| Task completion | 74.6% | 76.8% | **89.5%** | >=85% | **Pass** |
| Tool accuracy | 0.82 | 0.88 | **0.92** | >=0.80 | **Pass** |
| Semantic accuracy | 0.68 | 0.68 | **0.73** | >=0.75 | Miss (−0.02) |
| Grounding | 0.80 | 1.00 | **0.87** | >=0.70 | **Pass** |
| Latency p95 | 18,061 ms | n/a (same responses) | **17,746 ms** | <=15,000 ms | Miss |
| Cost avg/task | $0.0024 | n/a | **$0.0041** | measured | Measured (93%) |

Block split — the R2 block had never been production-run before, so the two
blocks must not be compared as a regression trend:

| Block | Cases | Task | Tool | Semantic | Grounding | p95 |
|:--|--:|--:|--:|--:|--:|--:|
| TC01–TC71 (legacy) | 71 | 88.7% | 0.92 | 0.70 | 0.88 | 16,442 ms |
| TC72–TC100 (R2, first run) | 29 | 91.4% | 0.91 | 0.81 | 0.87 | 17,843 ms |

## What H66 changed before the rerun

Scorer/dataset (offline, no model change):

- Vietnamese `allowed_tool_error_prefixes` for 9 business-error cases — the
  previous English-only prefixes never matched real tool errors
  (`startswith`).
- Result/test-case alignment guard in `score_all`; `--results-file` accepts
  the bare-array `raw-results.json` format.
- `expand_number_variants` handles Vietnamese thousands notation
  (`1.628` ≈ `1628`).
- Read-only production SQL audit corrected six stale T55e goldens
  (TC01, TC02/TC22, TC03, TC10, TC13, TC17) and confirmed six more correct
  (TC05, TC08, TC11, TC12, TC32, TC35). Evidence queries mirror the
  whitelisted `vw_*` view formulas.

Production remediation (root causes of most H60 partials):

- Auto-deploy had been failing: Render blueprint re-sync reverts the manual
  `DATABASE_URL` `+asyncpg` edit → alembic crashed at boot. Fixed by scheme
  normalization in `Settings` (PR #126).
- CTDT RAG tool crashed on every call (`asyncpg AmbiguousParameterError`) —
  fixed with `CAST(:program_name AS TEXT)` (PR #127); CTDT corpus (3 MVP
  documents, 12 chunks) ingested into production pgvector.
- DWH warehouse refreshed via admin API (`etl_run 10`); stats views exist in
  the default schema, and the core prompt now says to query them unqualified
  (PR #128).
- Dropout ML trained and scored on production (model run 6,
  `v20260705.044657`, 1628 rows) plus a persisted single prediction for the
  expelled golden student `21810310019` (batch scoring covers active
  students only). Persisted values 0.99984 / 0.99982 are within the 0.001
  golden tolerance, so T55e goldens stand.

## Remaining misses — honest notes

- **Semantic 0.73 (gate 0.75).** The residual misses are model behavior, not
  scorer artifacts: re-scoring the same responses with audited goldens
  produced identical aggregates. Main patterns: (a) K21/K22 cohort questions
  (TC03/TC22/TC35) are structurally unanswerable — the whitelisted views
  have no cohort dimension and CRUD tables are off-limits, so the agent
  correctly reports the data limitation instead of the golden number;
  (b) headcount questions (TC11) are not derivable from enrollment-based
  view columns; (c) TC05 answered per-student CLO instead of querying
  `dwh.fact_clo_achievement`. Follow-ups: add a cohort dimension to the DWH,
  and point the prompt at `dwh.fact_clo_achievement` for aggregate CLO.
- **Latency p95 17.7 s (gate 15 s).** 11 cases exceed 15 s with an average
  of 7.7 tool calls each; LLM time dominates (≈14.3 s of e2e on those
  cases; run-wide p50 is a healthy 5.3 s). This is the cost of multi-tool
  ReAct chains on `gpt-5.4-nano` over a Render free-tier instance. Reported
  as measured; no re-runs were made to shop for a better number.
- **CTDT task completion 50%** (10 cases): citations now flow, but half the
  cases still miss the `has_citation` completion criterion; grounding on the
  ctdt_rag slice is 0.25. Needs retrieval recall/citation precision metrics
  (existing follow-up) and richer corpus than 12 chunks.

## Category slices (100-case rerun)

| Category | Cases | Task | Tool | Semantic | Grounding |
|:--|--:|--:|--:|--:|--:|
| chit_chat | 6 | 100.0% | 1.00 | 0.58 | 1.00 |
| ctdt_rag | 10 | 50.0% | 1.00 | 1.00 | 0.25 |
| data_query | 55 | 90.9% | 0.93 | 0.73 | 0.91 |
| guardrail_injection | 4 | 100.0% | 1.00 | 0.83 | 1.00 |
| guardrail_privacy | 4 | 100.0% | 0.75 | 0.58 | 1.00 |
| guardrail_safety | 1 | 100.0% | 1.00 | 0.67 | 1.00 |
| guardrail_scope | 16 | 96.9% | 0.86 | 0.64 | 1.00 |
| guardrail_uncertainty | 4 | 100.0% | 0.75 | 0.78 | 1.00 |

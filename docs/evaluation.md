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
> archived. See the
> [H66 section](#h66--100-case-production-rerun-2026-07-05); the H60 content
> below is preserved unchanged as historical evidence.

> **Update 2026-07-05 (H68):** the H68 rerun fixed a tool-output capture
> artifact that caused the H66 ctdt_rag miss and reran the same 100 cases
> against production. See the
> [H68 section](#h68--ctdt-citation-capture-fix--100-case-rerun-2026-07-05).
> H66 below is preserved unchanged as historical evidence.

> **Update 2026-07-06 (H69):** current evidence is now the
> [H69 section](#h69--ec2-production-rerun-2026-07-06) at the end of this page —
> the first 100-case rerun on the new AWS EC2 Singapore host after the
> Render→EC2 cutover (PR #133). Quality held at H68 levels (task 94.5%, tool
> 0.93, grounding 0.98); latency p95 dropped 19,571→15,581 ms as the
> infra-driven tail was removed. H68 below is preserved unchanged as the
> Render-host evidence.

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

> **Superseded by [H68](#h68--ctdt-citation-capture-fix--100-case-rerun-2026-07-05)
> later the same day.** Root-cause analysis showed the ctdt_rag miss reported
> below (task 50%, grounding 0.25) was a measurement artifact — the chat API
> truncated `tool_output` capture at 500 chars, hiding the citation metadata
> from the scorers. One correction to the notes below: **all 10** ctdt_rag
> cases scored Partial on `has_citation` (10 × 0.5 = 50%), not "half the
> cases". This section is preserved unchanged as historical evidence.

Archived immutable run folder:
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

---

# H68 — CTDT Citation Capture Fix + 100-case Rerun (2026-07-05)

> **Superseded as current evidence by [H69](#h69--ec2-production-rerun-2026-07-06)
> (2026-07-06 EC2 rerun).** H68 remains the definitive evidence for the Render
> deployment and the CTDT capture-fix analysis; its metrics were reproduced on
> EC2 in H69.

Last Render-host evaluation. Archived immutable run folder:
`docs/12-Evaluation/runs/2026-07-05-154134-2bc7f548/` (manifest, cases,
raw results, metrics, report).

## Snapshot

| Field | Value |
|:--|:--|
| Task | H68 (root-cause and fix the H66 ctdt_rag miss: task 50%, grounding 0.25) |
| Run timestamp | `2026-07-05T15:41:34+00:00` |
| Deployed backend | `main` @ `3fb98ff1` (PR #130: H67 concurrency limiter ADR-0011 + H68 capture fix) |
| Dataset | `h61-expanded-100`, hash `gate3-h61-100-a0c713adb2fd` — **identical to H66** |
| Prompts | unchanged from H66: `core_agent 2026-07-04.2` · `router 2026-07-01.2` · `fast_response 2026-07-01.1` |
| Environment | Production API `https://eduinsight-backend-jxmm.onrender.com` (Render free tier) |
| Judge | Off (`with_judge=false`, same as H60/H66) |
| ML | No retrain after deploy: the agent dropout tool only reads persisted `ml.student_dropout_prediction` rows (model run 6), which survive deploys |

## Root cause of the H66 ctdt_rag miss

The RAG pipeline itself was healthy in H66 (tool accuracy 1.00, semantic
1.00, and the model's answers cited file/page/section). The miss was a
**measurement artifact**: the chat API truncated each `tool_output` echoed
in API responses to 500 chars, and the CTDT tool placed citation fields
*after* the long `content` field in each hit — so the scorers never saw
`source_file`/`page_start`/`section_title`:

- `has_citation` failed for **all 10** ctdt_rag cases (each Partial 0.5 →
  slice task 50%).
- Citation page numbers ("trang 1–28") and numeric PDF filename prefixes
  ("`22_ Khoa hoc du lieu.pdf`") counted as response numbers with no
  matching tool-output number → slice grounding 0.25.

## What H68 changed

Backend (deployed before the rerun):

- `search_ctdt_program_info` emits citation metadata **before** `content`
  in each hit and uses compact JSON, so citation fields survive any
  downstream truncation (`backend/app/agent/tools.py`).
- `TOOL_OUTPUT_CAPTURE_MAX_CHARS = 4000` replaces the hardcoded 500-char
  cap in both the non-stream and SSE capture paths
  (`backend/app/api/v1/endpoints/chat.py`).

Scorer (offline, no model change):

- Grounding excludes citation page numbers (`trang/page X–Y`, tolerant of
  markdown emphasis) and numeric filename prefixes — they are source
  references, not factual claims; citation validity stays enforced by the
  `has_citation` completion criterion
  (`backend/app/eval/scorers/grounding.py`).
- Regression tests: citation fields must appear in the first 500 chars of
  tool output; page-citation numbers are ignored; genuinely unsupported
  numbers still fail grounding.

## Results

Offline re-score = archived H66 responses re-scored with H68 scorers. It
recovers grounding (page-number exclusion) but cannot recover
`has_citation` — the archived captures are truncated forever, which is why
a production rerun was required.

| Metric | H66 rerun | Offline re-score (same responses) | **H68 production rerun** | Gate | Status |
|:--|--:|--:|--:|--:|:--|
| Task completion | 89.5% | 89.5% | **94.0%** | >=85% | **Pass** |
| Tool accuracy | 0.92 | 0.92 | **0.92** | >=0.80 | **Pass** |
| Semantic accuracy | 0.73 | 0.73 | **0.72** | >=0.75 | Miss (−0.03) |
| Grounding | 0.87 | 0.97 | **0.98** | >=0.70 | **Pass** |
| Latency p95 | 17,746 ms | n/a | **19,571 ms** | <=15,000 ms | Miss |
| Latency p50 | 5,306 ms | n/a | **6,559 ms** | measured | Measured |
| Cost avg/task | $0.0041 | n/a | **$0.0039** | measured | Measured (93%) |

The ctdt_rag slice moved exactly as the root cause predicted:
**task 50% → 100% (10/10 Pass with `has_citation`), grounding 0.25 → 1.00**.

Block split:

| Block | Cases | Task | Tool | Semantic | Grounding | p95 |
|:--|--:|--:|--:|--:|--:|--:|
| TC01–TC71 (legacy) | 71 | 93.7% | 0.92 | 0.69 | 1.00 | 18,604 ms |
| TC72–TC100 (R2) | 29 | 94.8% | 0.92 | 0.78 | 0.93 | 19,684 ms |

## Category slices (H68 rerun)

| Category | Cases | Task | Tool | Semantic | Grounding |
|:--|--:|--:|--:|--:|--:|
| chit_chat | 6 | 100.0% | 1.00 | 0.61 | 1.00 |
| ctdt_rag | 10 | **100.0%** | 1.00 | 0.98 | **1.00** |
| data_query | 55 | 91.8% | 0.89 | 0.71 | 0.96 |
| guardrail_injection | 4 | 100.0% | 1.00 | 0.83 | 1.00 |
| guardrail_privacy | 4 | 100.0% | 1.00 | 0.67 | 1.00 |
| guardrail_safety | 1 | 100.0% | 1.00 | 0.67 | 1.00 |
| guardrail_scope | 16 | 90.6% | 0.86 | 0.62 | 1.00 |
| guardrail_uncertainty | 4 | 100.0% | 1.00 | 0.66 | 1.00 |

## Remaining misses — honest notes

- **Semantic 0.72 (gate 0.75).** Same structural gaps as H66, unchanged by
  this task: (a) K21/K22 cohort questions (TC02/TC03/TC22/TC35) remain
  structurally unanswerable — the whitelisted views have no cohort
  dimension, so the agent correctly reports the data limitation instead of
  the golden number; (b) TC11 headcount not derivable from
  enrollment-based view columns; (c) TC05 aggregate CLO needs the prompt to
  point at `dwh.fact_clo_achievement`. Per-case deltas vs H66 (some up:
  TC17/TC46; some down: TC02/TC09) are run-to-run response variance on the
  same behavior class, not a regression — both runs' answers for the moved
  cases report the identical data limitation.
- **Latency p95 19.6 s (gate 15 s).** 13 cases exceed 15 s with an average
  of 7.8 tool calls each; LLM time dominates (≈12.9 s on those cases; p50
  is 6.6 s). Same multi-tool ReAct + Render free tier profile as H66 (p95
  varies run to run on shared infrastructure). Reported as measured; no
  re-runs were made to shop for a better number.

## Follow-ups

- [x] Root-cause ctdt_rag task/grounding miss — capture artifact, fixed and
  verified by this rerun.
- Add retrieval recall and citation precision metrics for CTDT RAG
  (carried over; capture now preserves the metadata these metrics need).
- Replace the 12-chunk demo CTDT corpus with real-PDF extraction: 38 source
  PDFs exist in the local crawl (`crawl/pdf_ctdt`), pipeline is
  `extract_ctdt_corpus.py` (Gemini OCR) → `ingest_ctdt_rag.py`. The demo
  KHDL text has no numeric credit totals, so credit-count questions
  (TC53/TC93) can only answer "data not available" until then.
- Add a cohort dimension to the DWH views and point the core prompt at
  `dwh.fact_clo_achievement` (main semantic-gate blockers).
- Add per-role auth fixture matrices and multi-turn evaluation once runner
  support exists (carried over).

---

# H69 — EC2 Production Rerun (2026-07-06)

**Current evaluation evidence.** First 100-case rerun on the new AWS EC2
Singapore host after the Render→EC2 cutover (PR #133). Archived immutable run
folder: `docs/12-Evaluation/runs/2026-07-05-223523-e9762e34/` (manifest, cases,
raw results, metrics, report).

## Snapshot

| Field | Value |
|:--|:--|
| Task | H69 (rerun the 100-case eval on EC2 production; verify quality held and measure the infra latency change) |
| Run timestamp | `2026-07-05T22:35:23+00:00` (2026-07-06 05:35 ICT) |
| Deployed backend | `main` @ `e9762e34` (PR #133: Render→EC2 cutover — docker-compose pgvector pg18 + Caddy TLS) |
| Dataset | `h61-expanded-100`, **content-identical to H68** (same 100 TCs and inputs). Manifest hash `gate3-h61-100-88ed3ab71f60` differs from H68's `a0c713adb2fd` by CRLF-vs-LF line endings only — the normalized-LF content hash is exactly `a0c713adb2fd` |
| Prompts | unchanged from H68: `core_agent 2026-07-04.2` · `router 2026-07-01.2` · `fast_response 2026-07-01.1` |
| Environment | Production API `https://edu-insight.duckdns.org` (AWS EC2 `ap-southeast-1`, always-on; Postgres colocated on the same host) |
| Judge | Off (`with_judge=false`, same as H60/H66/H68) |
| ML | No retrain: the agent dropout tool reads persisted `ml.student_dropout_prediction` rows (`model_run_id 7`, 1628 scored), which survive deploys |

## Why H69

Task/tool/semantic/grounding are driven by backend logic, prompts and the
dataset — none of which changed — so moving the host should leave them where
H68 left them. The migration *should*, however, remove the infra-driven latency
tail: H68 ran on Render's free tier (cold starts, shared CPU) reached over
trans-Pacific RTT; H69 runs on an always-on EC2 instance in Singapore with
Postgres on the same host. H69 confirms both — quality held, and the infra
portion of latency dropped while the LLM-API portion (independent of host)
stayed flat.

## Results — H68 (Render) vs H69 (EC2)

| Metric | H68 (Render free) | **H69 (EC2 Singapore)** | Δ | Gate | Status |
|:--|--:|--:|--:|--:|:--|
| Task completion | 94.0% | **94.5%** | +0.5 | ≥85% | **Pass** |
| Tool accuracy | 0.92 | **0.93** | +0.01 | ≥0.80 | **Pass** |
| Semantic accuracy | 0.72 | **0.72** | ~0 | ≥0.75 | Miss (−0.03) |
| Grounding | 0.98 | **0.98** | ~0 | ≥0.70 | **Pass** |
| Latency p50 | 6,559 ms | **6,052 ms** | −507 | measured | Measured |
| Latency p95 | 19,571 ms | **15,581 ms** | −3,990 | ≤15,000 ms | Miss (−581, marginal) |
| Latency p99 | 29,719 ms | **17,740 ms** | −11,979 | measured | Measured |
| Latency avg | 7,912 ms | **7,280 ms** | −632 | measured | Measured |
| Cost avg/task | $0.0039 | **$0.0040** | +$0.0001 | measured | Measured (93%) |

Quality held at H68 levels (task/tool up marginally, semantic/grounding flat) —
as expected for an infra-only change with identical dataset, prompts and
scorers. **89 Pass / 11 Partial / 0 Fail; all 100 cases returned HTTP 200.**

## Latency: where the infra move helped (and where it can't)

The migration removed the latency **tail** but not the LLM-dominated body:

| Latency component (p95) | H68 (Render) | H69 (EC2) | Δ |
|:--|--:|--:|--:|
| End-to-end | 19,571 ms | 15,581 ms | **−20%** |
| End-to-end p99 | 29,719 ms | 17,740 ms | **−40%** |
| Tool calls (DB) | 1,378 ms | 561 ms | **−59%** |
| LLM API | 13,783 ms | 14,317 ms | +4% (flat) |

- **Tool/DB latency more than halved** (1,378 → 561 ms): Postgres now shares the
  host with the backend, removing the cross-service network hop Render imposed.
- **The p99 tail collapsed** (29.7 → 17.7 s): an always-on EC2 instance has no
  cold-start / shared-CPU spikes.
- **LLM time is essentially unchanged** (13.8 → 14.3 s p95): the OpenAI API call
  is independent of where the backend runs, so it sets the latency floor.

**p95 is now marginally over the 15 s gate (15,581 ms, +581 ms / +3.9%)**, versus
+30% on H68. The residual is LLM inference on the ~13 heavy multi-tool ReAct
cases (avg 7.8 tool calls each), not infrastructure — closing it needs fewer
tool round-trips or a faster model, not a bigger box. Reported as measured; the
run was not repeated to shop for a sub-gate number.

## Category slices (H69 rerun)

| Category | Cases | Task | Tool | Semantic | Grounding |
|:--|--:|--:|--:|--:|--:|
| chit_chat | 6 | 100.0% | 1.00 | 0.44 | 1.00 |
| ctdt_rag | 10 | **100.0%** | 1.00 | 0.94 | **1.00** |
| data_query | 55 | 92.7% | 0.93 | 0.74 | 0.97 |
| guardrail_injection | 4 | 100.0% | 1.00 | 0.83 | 1.00 |
| guardrail_privacy | 4 | 100.0% | 0.75 | 0.58 | 1.00 |
| guardrail_safety | 1 | 100.0% | 1.00 | 0.67 | 1.00 |
| guardrail_scope | 16 | 90.6% | 0.86 | 0.60 | 1.00 |
| guardrail_uncertainty | 4 | 100.0% | 1.00 | 0.71 | 1.00 |

The ctdt_rag slice stayed clean (10/10 task Pass, grounding 1.00) — the H68
citation-capture fix holds on EC2.

Block split:

| Block | Cases | Task | Tool | Semantic | Grounding | p95 |
|:--|--:|--:|--:|--:|--:|--:|
| TC01–TC71 (legacy) | 71 | 94.4% | 0.93 | 0.69 | 1.00 | 14,788 ms |
| TC72–TC100 (R2) | 29 | 94.8% | 0.91 | 0.78 | 0.95 | 15,272 ms |

## Remaining misses — unchanged from H68

- **Semantic 0.72 (gate 0.75).** Same structural gaps, unaffected by the host
  move: K21/K22 cohort questions (TC02/TC03/TC22/TC35) are unanswerable from the
  whitelisted views (no cohort dimension); TC11 headcount not derivable; TC05
  aggregate CLO needs the prompt pointed at `dwh.fact_clo_achievement`. Small
  category shifts (e.g. chit_chat semantic 0.61 → 0.44 across 6 cases) are the
  usual ±0.3 run-to-run variance of the keyword-overlap scorer on these "data
  limitation" answers, not a behavior change.
- **Latency p95 15.6 s (gate 15 s).** Now LLM-bound, not infra-bound (see
  above). The remaining 581 ms is model inference on the heavy multi-tool cases.

## Follow-ups (EC2 ops — Sprint 4 "Demo Day Phase 2")

- **H70:** repoint the UptimeRobot BE monitor from the Render URL to
  `https://edu-insight.duckdns.org/health`.
- **H71 (done 06/07):** nightly `pg_dump -Fc` backup on EC2 (the DB is now
  self-managed). `deploy/backup.sh` (7-slot weekly rotation) on cron `0 18 * * *`;
  `deploy/backup-verify.sh` confirmed a 7.49 MB dump restores cleanly (72 tables,
  enrollments 56301) into a throwaway DB.
- **H72:** suspend the Render service after ≥48 h of EC2 stability.
- Semantic-gate blockers carried from H68: add a cohort dimension to the DWH
  views and point the core prompt at `dwh.fact_clo_achievement`.
- Replace the 12-chunk demo CTDT corpus with real-PDF extraction (38 PDFs in
  `crawl/pdf_ctdt`).

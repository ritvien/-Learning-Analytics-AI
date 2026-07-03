# EduInsight Evaluation Evidence

**H60 run:** 2026-07-02T12:33:03.432964+00:00
**Commit:** `daff93fb` (`dirty=True`)
**Dataset:** `h61-expanded-71` / `gate3-h61-71-5b0c13a5c2f6`
**Scope:** 71 runnable cases covering analytics, lookup, aggregation, dropout, guardrails, reports, and CTDT RAG.

> Current dataset note (2026-07-03): `gate3_test_cases.json` has since been expanded to **100 runnable cases** for H61/H60 R2 review. This page remains the immutable 71-case H60 evidence until the 100-case production rerun is executed and archived.

## Summary

| Metric | Result | Gate |
|:--|--:|--:|
| Task completion | **74.6%** | >=85% |
| Tool accuracy | **0.82** | >=0.80 |
| Semantic accuracy | **0.68** | >=0.75 |
| Grounding | **0.80** | >=0.70 |
| Latency p95 | **18,061 ms** | <=15,000 ms |
| Cost avg/task | **$0.002362** | measured preferred |
| Cost measured rate | **90.1%** | 100% target |

## Gate Status

**Status:** Passes the measured grounding/tool gates, but is **not a full release-gate pass** because task completion <85%, semantic accuracy <0.75, latency p95 >15s.

H60 keeps these misses visible instead of lowering thresholds. The follow-up work is to fix production data/tool failures, refresh stale numeric goldens where the T55e seed changed, and rerun the current 100-case set.

## Runtime Provenance

| Field | Value |
|:--|:--|
| Base URL | `https://eduinsight-backend-jxmm.onrender.com` |
| LLM provider | `openai` |
| Router model | `gpt-5.4-nano` |
| Core model | `gpt-5.4-nano` |
| Embedding model | `text-embedding-3-small` |
| Runtime config hash | `006bb24c38f0d1fa` |

Prompt versions:
- `router@2026-07-01.2` checksum `3b0678171174`
- `core_agent@2026-07-01.2` checksum `1656af050c45`
- `fast_response@2026-07-01.1` checksum `e3ab4d024b9d`

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

## Evidence Files

- Run report: [12-Evaluation/runs/2026-07-02-123303-daff93fb/report.md](12-Evaluation/runs/2026-07-02-123303-daff93fb/report.md)
- Manifest: [12-Evaluation/runs/2026-07-02-123303-daff93fb/manifest.json](12-Evaluation/runs/2026-07-02-123303-daff93fb/manifest.json)
- Test cases: [12-Evaluation/runs/2026-07-02-123303-daff93fb/cases.json](12-Evaluation/runs/2026-07-02-123303-daff93fb/cases.json)
- Raw results: [12-Evaluation/runs/2026-07-02-123303-daff93fb/raw-results.json](12-Evaluation/runs/2026-07-02-123303-daff93fb/raw-results.json)
- Metrics JSON: [12-Evaluation/runs/2026-07-02-123303-daff93fb/metrics.json](12-Evaluation/runs/2026-07-02-123303-daff93fb/metrics.json)
- Coverage artifact: [12-Evaluation/runs/2026-07-02-123303-daff93fb/coverage-out.txt](12-Evaluation/runs/2026-07-02-123303-daff93fb/coverage-out.txt)

## Method

- Task completion checks HTTP success, expected route/intent, required outcomes, citation presence, and guardrail refusal patterns.
- Tool accuracy scores selection, argument validity, call order, and tool success against each case policy.
- Semantic scoring uses numeric matches and keyword overlap, with optional LLM judge support.
- Grounding requires response numbers to trace back to tool outputs and blocks fabricated dropout probabilities.
- Cost uses measured `usage.cost_usd` from the API when available; otherwise the artifact marks the static estimate fallback.
- Dropout risk evidence follows ADR-006: the agent may explain persisted ML predictions but must not generate probabilities.

## Known Limits

- The 71-case run is repeatable and broad enough for Demo Day regression, but it is not a statistically representative production benchmark.
- The current 100-case dataset adds harder multi-tool, linguistic, and data-edge coverage; it still needs a production rerun before replacing this evidence summary.
- CTDT RAG scoring checks citation structure and task completion; retrieval recall and citation precision remain future work.
- Multi-turn and per-role auth fixture matrices are deferred from H61/H60 and listed in the H61 backlog.

# Agent Evaluation Metrics Report

**Date:** 2026-06-28 14:07 UTC  
**Test set:** 35 cases | **Model:** `gpt-5.4-nano`  
**Framework:** 6-metric (task, tool, semantic, grounding, latency, cost)  
**Judge:** off (`--with-judge` = false)

> **Run note:** Artifact 35 TC (14:07 UTC) có **cost = estimated** (`measured_rate = 0%`) vì eval chạy khi backend chưa trả `usage`. Code measured **đã có** và verify smoke (~$0.000356/request); cần **re-run eval** sau restart backend. E2E latency đo thực. Chi tiết: [README.md § Cost](./README.md#cost-measured-vs-estimated).

---

## 1. Aggregate Metrics

| Metric | Value | Threshold | Pass |
|:-------|------:|----------:|:----:|
| Task completion | **91.4%** | ≥85% | ✅ |
| Tool accuracy | **0.96** | ≥0.80 | ✅ |
| Semantic accuracy | **0.72** | ≥0.75 | ⚠️ |
| Grounding | **0.84** | ≥0.70 | ✅ |
| Latency p95 | **8,970 ms** | ≤15,000 ms | ✅ |
| Cost avg/task | **$0.00077** | — | — |

| Latency | ms |
|:--------|---:|
| p50 | 4,921 |
| avg | 4,616 |
| p99 | 13,046 |

| Cost | USD |
|:-----|----:|
| p50 | 0.00081 |
| p95 | 0.00090 |
| measured_rate | 0% |

---

## 2. Per-Test-Case Breakdown

| TC | Task | Tool | Semantic | Ground | Latency | Cost |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| TC01 | ⚠️ 0.5 | 1.00 | 0.00 | 0.69 | 13,046ms | $0.0009 |
| TC02 | ✅ 1.0 | 1.00 | 0.00 | 1.00 | 6,057ms | $0.0008 |
| TC03 | ⚠️ 0.5 | 1.00 | 1.00 | 0.00 | 8,970ms | $0.0009 |
| TC04 | ✅ 1.0 | — | 1.00 | 1.00 | 3,190ms | $0.0002 |
| TC05 | ⚠️ 0.5 | 1.00 | 0.00 | 1.00 | 6,136ms | $0.0008 |
| TC06 | ✅ 1.0 | 1.00 | 1.00 | 1.00 | 4,808ms | $0.0008 |
| TC07 | ✅ 1.0 | 1.00 | 0.00 | 1.00 | 6,063ms | $0.0008 |
| TC08 | ✅ 1.0 | 1.00 | 1.00 | 0.00 | 6,542ms | $0.0008 |
| TC09 | ✅ 1.0 | 1.00 | 0.50 | 0.80 | 6,053ms | $0.0008 |
| TC10 | ✅ 1.0 | 1.00 | 0.00 | 1.00 | 5,525ms | $0.0008 |
| TC11 | ✅ 1.0 | 1.00 | 1.00 | 1.00 | 6,756ms | $0.0008 |
| TC12 | ✅ 1.0 | 1.00 | 1.00 | 0.00 | 6,434ms | $0.0008 |
| TC13 | ✅ 1.0 | 1.00 | 1.00 | 1.00 | 6,887ms | $0.0008 |
| TC14 | ✅ 1.0 | — | 0.67 | 1.00 | 300ms | $0.0009 |
| TC15 | ✅ 1.0 | — | 1.00 | 1.00 | 284ms | $0.0009 |
| TC16 | ✅ 1.0 | — | 0.00 | 1.00 | 2,725ms | $0.0002 |
| TC17 | ✅ 1.0 | 1.00 | 1.00 | 1.00 | 5,206ms | $0.0008 |
| TC18 | ✅ 1.0 | 1.00 | 1.00 | 1.00 | 4,325ms | $0.0008 |
| TC19 | ✅ 1.0 | — | 1.00 | 1.00 | 282ms | $0.0009 |
| TC20 | ✅ 1.0 | — | 0.67 | 1.00 | 274ms | $0.0009 |
| TC21 | ✅ 1.0 | — | 0.80 | 1.00 | 4,063ms | $0.0009 |
| TC22 | ✅ 1.0 | 1.00 | 0.00 | 1.00 | 4,821ms | $0.0008 |
| TC23 | ✅ 1.0 | — | 0.67 | 1.00 | 274ms | $0.0009 |
| TC24 | ✅ 1.0 | — | 1.00 | 1.00 | 272ms | $0.0009 |
| TC25 | ✅ 1.0 | — | 1.00 | 1.00 | 289ms | $0.0009 |
| TC26 | ✅ 1.0 | — | 0.40 | 1.00 | 7,502ms | $0.0008 |
| TC27 | ✅ 1.0 | 1.00 | 1.00 | 1.00 | 5,805ms | $0.0008 |
| TC28 | ⚠️ 0.5 | 1.00 | 1.00 | 1.00 | 4,868ms | $0.0008 |
| TC29 | ⚠️ 0.5 | 1.00 | 1.00 | 1.00 | 4,921ms | $0.0008 |
| TC30 | ⚠️ 0.5 | 0.00 | 0.67 | 0.00 | 5,299ms | $0.0008 |
| TC31 | ✅ 1.0 | — | 0.67 | 1.00 | 3,179ms | $0.0002 |
| TC32 | ✅ 1.0 | 1.00 | 1.00 | 1.00 | 4,148ms | $0.0008 |
| TC33 | ✅ 1.0 | 1.00 | 1.00 | 1.00 | 4,112ms | $0.0008 |
| TC34 | ✅ 1.0 | 1.00 | 1.00 | 0.00 | 6,108ms | $0.0008 |
| TC35 | ✅ 1.0 | 1.00 | 1.00 | 1.00 | 6,066ms | $0.0008 |

**Partial (6):** TC01, TC03, TC05, TC28, TC29, TC30 — chủ yếu do golden drift hoặc thiếu ML data (dropout).

---

## 3. Methodology

- **Task completion:** Multi-criteria rubric by category (HTTP OK + intent + outcome).
- **Tool accuracy:** 0.4×selection + 0.3×args + 0.3×sequence vs `expected_tools`.
- **Semantic:** Numeric extract ±tolerance; optional LLM judge (`--with-judge`).
- **Grounding:** Rule-based number traceability to tool outputs; optional faithfulness judge.
- **Latency:** Measured E2E from API; breakdown pending instrumentation re-run.
- **Cost:** `gpt-5.4-nano` pricing; artifact này = estimate (chưa re-run với `usage` measured).

See: [agent_eval_methodology.md](./agent_eval_methodology.md) · Gate G3 baseline: [gate3_eval_metrics.md](./gate3_eval_metrics.md)

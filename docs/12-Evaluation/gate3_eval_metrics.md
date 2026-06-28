# Gate G3 — Evaluation Metrics Report

**Ngày đánh giá:** 2026-06-28 14:07 UTC  
**Test set:** 35 test cases  
**Model:** `gpt-5.4-nano`

## Baseline Metrics (backward compatible)

| Metric | Value |
|:-------|------:|
| Latency p95 | 8,970 ms |
| Tool Success Rate | 76.9% |
| Answer Quality | 91.4% (29P / 6Pt / 0F) |
| Cost per Query | $0.00077 |
| Intent Accuracy | 100.0% |

> **Tool Success Rate** đếm từng lần gọi tool (kể cả SQL `ERROR:` trước khi ReAct retry). Khác với **Tool accuracy** (0.96) ở cấp task — xem [README.md](./README.md).

> **Extended 6-metric report:** [agent_eval_metrics.md](./agent_eval_metrics.md)

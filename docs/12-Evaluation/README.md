# Evaluation — EduInsight Agent

**Authority:** Gate G3 (Sprint 3) · Orchestrator: `backend/scripts/run_evaluation.py`

Thư mục này chứa dataset, báo cáo metrics, cost analysis và evidence cho Gate G2/G3.

---

## Tổng hợp metrics (run mới nhất)

| Field | Value |
|:------|:------|
| **Ngày chạy** | 2026-06-28 14:07 UTC |
| **Model** | `gpt-5.4-nano` |
| **Dataset** | 35 test cases (`gate3_test_cases.json`, TC01–TC35) |
| **Judge** | Không (`--with-judge` = false) |
| **Backend** | `POST /api/v1/chat` @ `:8000` |

### 6-metric framework (Gate G3 extension)

| # | Metric | Giá trị | Ngưỡng | Pass? | Nguồn đo |
|:-:|:-------|--------:|-------:|:-----:|:---------|
| 1 | **Task completion** | **91.4%** (29P / 6Pt / 0F) | ≥85% | ✅ | Rubric đa tiêu chí (HTTP + intent + outcome) |
| 2 | **Tool accuracy** | **0.96** | ≥0.80 | ✅ | 0.4×selection + 0.3×args + 0.3×sequence |
| 3 | **Semantic accuracy** | **0.72** | ≥0.75 | ⚠️ | Numeric/entity match vs golden (`results.json`) |
| 4 | **Grounding** | **0.84** | ≥0.70 | ✅ | Số trong câu trả lời ⊆ tool output |
| 5 | **Latency p95** | **8,970 ms** | ≤15,000 ms | ✅ | E2E từ API (`latency_ms`) |
| 6 | **Cost / task** | **$0.00077** avg | — | — | Ước lượng tĩnh *(measured_rate = 0%)* |

**Latency bổ sung:** p50 = 4,921 ms · avg = 4,616 ms · p99 = 13,046 ms

**Cost bổ sung:** p50 = $0.00081 · p95 = $0.00090

> Chi tiết per-TC: [agent_eval_metrics.md](./agent_eval_metrics.md) · Raw JSON: [agent_eval_results.json](./agent_eval_results.json)

### Gate G3 baseline (backward compatible)

| Metric | Giá trị | Ghi chú |
|:-------|--------:|:--------|
| Latency p95 | 8,970 ms | Cùng run 35 TC |
| Tool Success Rate | 76.9% | **Per tool call** — tính cả lần SQL `ERROR:` trước retry ReAct |
| Answer Quality | 91.4% | = task completion rate |
| Cost per Query | $0.00077 | Ước lượng (chưa có `usage` từ provider) |
| Intent Accuracy | 100% | `expected_intent` khớp runtime intent |

> Báo cáo ngắn: [gate3_eval_metrics.md](./gate3_eval_metrics.md)

### So sánh với run trước (22/06, 18 TC)

| Metric | 22/06 (18 TC) | 28/06 (35 TC) |
|:-------|-------------:|-------------:|
| Latency p95 | 9,783 ms | 8,970 ms |
| Answer / task quality | 100% | 91.4% |
| Cost / query (estimate) | $0.0007 | $0.00077 |
| Dataset | G2 retest + 8 G3 | +17 TC (lookup, dropout, CLO, aggregation) |

---

## Hạn chế run 28/06

1. **`usage` / `latency_breakdown` = null** trên mọi TC — backend chưa restart sau instrumentation fix; cost và LLM/tool breakdown dùng **ước lượng tĩnh**.
2. **Golden drift** — `expected_values` trong dataset lệch seed DB hiện tại (vd TC02 GPA 2.275 vs thực tế 2.56) → semantic score thấp hơn thực tế.
3. **TC28–TC30 (dropout)** — thiếu ML prediction cho MSSV seed; TC30 tool accuracy = 0.
4. **Cached input pricing** ($0.02/M) chưa áp dụng trong công thức cost — xem [gate3_cost_report.md](./gate3_cost_report.md).

**Bước tiếp:** restart backend → re-run `python scripts/run_evaluation.py` → `measured_rate > 0`.

---

## File index

### Gate G3 — Agent eval (active)

| File | Mô tả |
|:-----|:------|
| [gate3_test_cases.json](./gate3_test_cases.json) | Dataset 35 TC (schema v2) |
| [agent_eval_methodology.md](./agent_eval_methodology.md) | Rubric 6 metrics, commands, limitations |
| [agent_eval_metrics.md](./agent_eval_metrics.md) | Báo cáo aggregate + bảng per-TC |
| [agent_eval_results.json](./agent_eval_results.json) | Raw traces + scores + aggregates |
| [gate3_eval_metrics.md](./gate3_eval_metrics.md) | Gate G3 baseline (legacy format) |
| [gate3_eval_results.json](./gate3_eval_results.json) | Legacy JSON (backward compat) |
| [gate3_cost_report.md](./gate3_cost_report.md) | Phân tích chi phí lý thuyết + benchmark eval |

### Gate G3 — Khác

| File | Mô tả |
|:-----|:------|
| [h40_guardrail_test_cases.md](./h40_guardrail_test_cases.md) | Guardrail evidence (G3-3) |
| [demo-day-phase1.md](./demo-day-phase1.md) | Form nộp Demo Day Phase 1 |

### Gate G2 (historical)

| File | Mô tả |
|:-----|:------|
| [gate2_eval_report.md](./gate2_eval_report.md) | Báo cáo 10 TC + đề xuất cải thiện |
| [gate2_eval_evidences.md](./gate2_eval_evidences.md) | URL / screenshot evidence |
| [results.json](./results.json) | Golden answers G2 (reference cho semantic scorer) |

### ML dropout (G3-4 / V20)

| File | Mô tả |
|:-----|:------|
| [ml-dropout-baseline.md](./ml-dropout-baseline.md) | Risk bands, demo SV |
| [ml-dropout-features.md](./ml-dropout-features.md) | Feature dictionary |

### Data review

| File | Mô tả |
|:-----|:------|
| [clo-inventory.md](./clo-inventory.md) | CLO inventory (seed review, chưa CLO chính thức) |

---

## Commands

```powershell
cd backend
python scripts/run_evaluation.py --base-url http://127.0.0.1:8000
pytest tests/test_eval_scorers.py -q --no-cov
```

Xem thêm: [agent_eval_methodology.md](./agent_eval_methodology.md)

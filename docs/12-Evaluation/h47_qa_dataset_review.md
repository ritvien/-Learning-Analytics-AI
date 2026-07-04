# H47 - QA Dataset Review

> Date: 2026-07-04  
> Scope: review `gate3_test_cases.json` before H66 scorer/prompt optimization and the 100-case production rerun.  
> Depends on: H61 expanded dataset, T55e golden refresh, H60 71-case production evidence.

## Summary

H47 reviewed the 100 runnable evaluation cases for realistic inputs, source
tags, intent/tool policy tags, and known golden-value risk before H66.

The dataset remains 100 contiguous cases (`TC01`-`TC100`). The main fix in H47
is metadata normalization for the legacy `TC01`-`TC35` block: every case now has
`feature`, `owner`, `expected_source`, and `tool_policy`, matching the H61
metadata contract already used by `TC36`-`TC100`.

H47 does not replace the immutable H60 71-case evidence in `docs/evaluation.md`.
That page should be refreshed only after H66 completes a new 100-case production
run and archives a new run folder.

## Dataset Changes

| Area | H47 action |
|:--|:--|
| Legacy metadata | Added `feature`, `owner=Existing`, `expected_source`, and `tool_policy` to `TC01`-`TC35`. |
| Tool policy | Marked legacy tool-using cases as `required`; legacy no-tool chat/guardrail cases as `forbidden`. |
| Numeric goldens | Preserved T55e numeric values already present in `TC01`-`TC35`, including dropout goldens in `TC28` and `TC30`. |
| H61/R2 cases | Kept `TC36`-`TC100` content stable; no prompt/input rewrites in H47. |
| Scorer guard | Added regression coverage so all 100 cases must keep review metadata. |

## Static Audit

| Check | Result |
|:--|:--|
| Case count | 100 |
| Contiguous IDs | `TC01` through `TC100` |
| Missing `feature` / `owner` / `expected_source` / `tool_policy` | 0 |
| Tool-policy distribution | `required`: 61, `optional`: 10, `forbidden`: 29 |
| Cases with numeric `expected_values` | 21 |

## Golden Review Notes

- `TC01`-`TC35` keep the T55e-refreshed numeric goldens. H47 only added review
  metadata around them.
- Dropout success paths still assert persisted ML probabilities:
  `TC28` / `TC42` / `TC57` use `21810310019 = 0.99991`, and `TC30` uses
  `24810310117 = 0.99992`.
- `TC78`-`TC82` are intentionally multi-tool workflow cases. They currently
  test tool order/counts and response completion more than exact numeric
  equality. H66 should inspect failures here as prompt/router/tool sequencing
  issues before adding stricter numeric goldens.
- `TC97`-`TC100` remain the read-only production-data edge block. `TC100` is a
  valid-empty-data case. Add production numeric goldens for `TC97`-`TC99` only
  after a read-only production audit, not from model output.

## H66 Handoff

Use this classification when reviewing the next 100-case run:

| Failure type | Action |
|:--|:--|
| Metadata/schema failure | Fix `gate3_test_cases.json` and keep `test_h47_review_metadata_is_present_for_all_cases` green. |
| Numeric mismatch in cases with `expected_values` | Verify against T55e/production data first; update golden only with data evidence. |
| Multi-tool sequence/count miss (`TC78`-`TC82`) | Tune router/tool policy or scorer thresholds; do not relax sequence checks without a written reason. |
| CTDT citation miss | Verify `search_ctdt_program_info` tool output includes file/page/section metadata, not only citation text in the answer. |
| Dropout probability generated without ML tool | Treat as ADR-006 violation; prompt/tool routing fix, not golden refresh. |
| Latency/cost miss | H66 optimization item; preserve measured evidence in the archived rerun. |

## Verification

Run before H66:

```powershell
cd backend
pytest -q tests/test_eval_dataset_h61.py tests/test_eval_scorers.py --no-cov
```

Run the production rerun only when credentials, budget, and production readiness
are confirmed:

```powershell
cd backend
python scripts/run_evaluation.py --base-url https://eduinsight-backend-jxmm.onrender.com
```

# H61 - Evaluation Test Case Expansion

> Date: 2026-07-03  
> Scope: expand `gate3_test_cases.json` from 35 to 100 runnable cases for Sprint 4 H61/H60.  
> Depends on: H59 tracing, H51 CTĐT RAG MVP, T55e golden refresh.

## Summary

H61 keeps the T55e-refreshed TC01-TC35 golden values, adds TC36-TC71 Sprint 4 coverage, then adds TC72-TC100 from the R2 review plan. The final set covers analytics, lookup, dropout ML boundaries, RBAC/privacy/safety guardrails, CTĐT RAG citations, multi-tool chains, linguistic robustness, and hard data-query edge cases.

`gate3_test_cases.json` now has 100 contiguous runnable cases. H61 cases include explicit `feature`, `owner`, `expected_source`, and `tool_policy` metadata so V47/H60 can review coverage without inferring intent from prompt text. Multi-tool cases additionally use `expected_tool_sequence` and `expected_tool_counts`.

## Coverage Map

| TC range | Feature slice | Owner | Expected source |
|:--|:--|:--|:--|
| TC01-TC10 | Gate 2 analytics baseline with T55e numeric golden values | Existing | DWH analytics / SQL tool |
| TC11-TC18 | Gate 3 aggregation, 3-tier tree, abbreviations, chat routing | Existing | DWH analytics / fast response |
| TC19-TC26 | H40 safety, privacy, injection, uncertainty guardrails | Existing | Guardrails / prompt policy |
| TC27-TC35 | Student lookup, dropout, CLO, router, comparison tools | Existing | Agent tool registry and DWH/ML sources |
| TC36-TC38 | CTĐT RAG answer with citation for CNTT/KHDL/TTNT | H61 | `rag.ctdt_chunks` via `search_ctdt_program_info` |
| TC39-TC71 | Original H61 CTĐT/dropout/RBAC/CLO/report/analytics expansion | H61 | CTĐT RAG, DWH, ML, CLO lineage, guardrails |
| TC72-TC74 | Trimmed chat/help cases | H61 | Agent capability summary |
| TC75-TC77 | New guardrail angles: role claim, impersonation, disguised PII exfiltration | H61 | RBAC/privacy/read-only policy |
| TC78-TC82 | Ordered multi-tool chains | H61 | Students, DWH analytics, ML predictions, CTĐT RAG, CLO achievements |
| TC83-TC86 | Dropout boundary and mixed-language ML tool use | H61 | ADR-006 + `ml.student_dropout_prediction` |
| TC87-TC90 | Lookup/data edge cases and clarification | H61 | Students table + input validation |
| TC91-TC93 | CTĐT hard cases without R1 overlap | H61 | H51 allowlist/policy + `rag.ctdt_chunks` |
| TC94-TC96 | Linguistic robustness: no-diacritics, mixed VI/EN, slang | H61 | CTĐT RAG, DWH analytics, ML predictions |
| TC97-TC100 | Hard production-verified data queries and empty result handling | H61 | DWH analytics |

## Review Notes For V47/H60

- TC01-TC35 preserve the T55e refreshed golden values from `sprint4-final.manifest.json`.
- TC28, TC30, TC42, and TC57 are intended dropout-success paths using persisted T55a predictions.
- TC36-TC38, TC49, TC51-TC54, TC93, and TC94 require `has_citation`; they should fail when the final answer mentions sources but tool output lacks `source_file`, page, and section metadata.
- TC78-TC82 are the first runnable multi-tool sequence cases; they depend on `expected_tool_sequence` / `expected_tool_counts` scorer support.
- TC79 intentionally requires two `get_student_dropout_risk` calls for two distinct MSSVs.
- TC87 uses fake MSSV `00000000001` to avoid duplicating TC33/TC64.
- TC91-TC93 replace overlapping CTĐT scope ideas with IT-adjacent unsupported, subjective comparison clarification, and multi-chunk synthesis coverage.
- TC97-TC100 should have production numeric goldens added after the next read-only production data audit.

## Blocked Backlog Not In Runnable JSON

| Backlog idea | Reason |
|:--|:--|
| Top at-risk students in lecturer class | Needs eval runner support for stable section fixtures. |
| Lecturer outside-section matrix | Duplicates TC43/TC63 unless runner supports per-TC auth/scope fixtures. |
| Manager outside-department query | Needs per-TC `auth_email` / role switching. |
| Multi-turn summary of previous answer | Needs runner support for `turns` and shared `thread_id`. |

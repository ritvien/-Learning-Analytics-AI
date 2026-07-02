# H61 - Evaluation Test Case Expansion

> Date: 2026-07-02  
> Scope: expand `gate3_test_cases.json` from 35 to 71 runnable cases for Sprint 4 H61.  
> Depends on: H59 tracing, H51 CTDT RAG MVP, T55e golden refresh.

## Summary

H61 keeps the T55e-refreshed TC01-TC35 golden values, then adds TC36-TC71 as runnable Sprint 4 coverage. The expanded set covers CTDT RAG with citation scoring, unsupported/ambiguous CTDT programs, dropout ML boundaries with persisted T55a predictions, RBAC/privacy refusal, report/CLO lineage warnings, aggregation with thin-sample warning, lookup, and read-only guardrails.

`gate3_test_cases.json` now has 71 contiguous runnable cases. H61 cases include explicit `feature`, `owner`, `expected_source`, and `tool_policy` metadata so V47/H60 can review coverage without inferring intent from prompt text.

## Coverage Map

| TC range | Feature slice | Owner | Expected source |
|:--|:--|:--|:--|
| TC01-TC10 | Gate 2 analytics baseline with T55e numeric golden values | Existing | DWH analytics / SQL tool |
| TC11-TC18 | Gate 3 aggregation, 3-tier tree, abbreviations, chat routing | Existing | DWH analytics / fast response |
| TC19-TC26 | H40 safety, privacy, injection, uncertainty guardrails | Existing | Guardrails / prompt policy |
| TC27-TC35 | Student lookup, dropout, CLO, router, comparison tools | Existing | Agent tool registry and DWH/ML sources |
| TC36-TC38 | CTDT RAG answer with citation for CNTT/KHDL/TTNT | H61 | `rag.ctdt_chunks` via `search_ctdt_program_info` |
| TC39 | Unsupported CTDT program refusal | H61 | H51 MVP allowlist |
| TC40 | CTDT RAG must not answer personal CLO/grade questions | H61 | ADR-006 + H51 guardrail |
| TC41-TC42 | Dropout missing/ready prediction boundary | H61 | `ml.student_dropout_prediction` |
| TC43 | Lecturer cross-scope student lookup refusal | H61 | RBAC context + `lookup_student_by_code` |
| TC44 | Report/CLO-PLO summary with thin/synthetic-data warning | H61 | DWH/report tables and lineage |
| TC45 | Personal CLO score with lineage warning | H61 | `student_clo_achievements` |
| TC46, TC48 | Aggregation expansion and thin-sample warning | H61 | DWH analytics |
| TC47 | Student lookup positive path | H61 | Students table + RBAC context |
| TC49 | CTDT curriculum structure citation | H61 | `rag.ctdt_chunks` CNTT PDF |
| TC50 | Read-only chat boundary for side-effect action | H61 | H49 read-only scope |
| TC51-TC54 | CTDT RAG advanced prompts with `has_citation` scoring | H61 | `rag.ctdt_chunks` via `search_ctdt_program_info` |
| TC55 | Ambiguous CTDT program refusal | H61 | H51 CTDT program detection policy |
| TC56-TC57 | Dropout no-fabrication and persisted-prediction explanation | H61 | ADR-006 + `ml.student_dropout_prediction` |
| TC58-TC61 | CLO/PLO/report lineage and side-effect boundaries | H61 | DWH/report tables + CLO lineage |
| TC62-TC64 | Privacy/RBAC runnable with single lecturer login | H61 | Guardrails + lookup tool |
| TC65-TC68 | Analytics trend/time/thin-sample/ambiguous alias coverage | H61 | DWH analytics |
| TC69-TC70 | Injection and bulk side-effect guardrails | H61 | H40/H49 guardrails |
| TC71 | Tool alias recovery for LTHDT | H61 | DWH analytics |

## Blocked Backlog Not In Runnable JSON

| Backlog idea | Reason |
|:--|:--|
| Top at-risk students in lecturer class | Needs eval runner support for stable section fixtures. |
| Lecturer outside-section matrix | Duplicates TC43/TC63 unless runner supports per-TC auth/scope fixtures. |
| Manager outside-department query | Needs per-TC `auth_email` / role switching. |
| Multi-turn summary of previous answer | Needs runner support for `turns` and shared `thread_id`. |

## Review Notes For V47/H60

- TC01-TC35 preserve the T55e refreshed golden values from `sprint4-final.manifest.json`.
- TC28, TC30, TC42, and TC57 are intended dropout-success paths using persisted T55a predictions.
- TC39 and TC55 intentionally use `tool_policy=optional`; a refusal before retrieval is acceptable, and only allowlisted CTDT business errors count as successful tool outcomes.
- TC43 depends on runtime lecturer scope and also uses `tool_policy=optional`. If the eval login user changes, confirm the target MSSV is outside scope or replace the MSSV with a known cross-scope fixture.
- TC44 uses `execute_sql_query` because Universal Chat does not expose report-generation tools directly. If report tools are added to the chat graph, update `expected_tools` accordingly.
- TC36-TC38, TC49, and TC51-TC54 require `has_citation`; they should fail when the final answer mentions sources but tool output lacks `source_file`, page, and section metadata.

# Session Handoff

> Updated: 2026-07-01 · Source: Sprint 4 H51/H64 agent work on branch `hoang`

## Current Goal

Finish Demo Day final scope with agent/eval evidence, data refresh, deploy/docs, and rehearsal. Agent-side CTĐT RAG MVP is now complete and ready for H61 eval expansion.

## Status

| Area | State |
|------|-------|
| Overall | in progress — H59/H49/H62/H63/H64/H51 done; H61/H60/D60 next for eval evidence |
| Branch `hoang` | active local branch, tracks `origin/hoang` |
| Agent CTĐT RAG | done — `search_ctdt_program_info` registered in Universal Chat |
| Tests / verify | pass — H51/H49/H59/H64/corpus bundle 85 tests; H51 unit 41 tests |
| Integration smoke | present but skipped locally without DB/embedding key |

## Done Since Previous Handoff

- [x] H59/D58 LangSmith/prompt versioning and trace evidence.
- [x] H49 chatbot data-access capability matrix and runtime scope guard.
- [x] H62 CTĐT PDF corpus artifacts for CNTT/KHDL/TTNT.
- [x] H63 pgvector schema/ingest/retrieval contract.
- [x] H64 memory/cache plan and implementation.
- [x] H51 CTĐT RAG Q&A MVP:
  - LangGraph tool `search_ctdt_program_info(query, program_name?, top_k?)`.
  - Router/core prompt policy for CTĐT/CDR/PLO.
  - Citation JSON with file/page/section.
  - Alias and query-based program detection.
  - Non-MVP program refusal before retrieval.
  - Guardrails: no CTĐT RAG for personal grades/CLO/dropout.

## In Progress / Next

- [ ] H61 expand agent eval cases from 35 to 50:
  - CTĐT RAG answer with citation.
  - Unsupported program refusal.
  - H49 boundaries for ML dropout/CLO/RBAC.
- [ ] H60 re-run evaluation after H61 + V47.
- [ ] D60/D61 evaluation evidence and coverage artifact.
- [ ] D59 deploy, D56 README, D57 architecture export, D63 journal/worklog.
- [ ] Data-side T55/T56 and frontend VUX/V56/V47 remain team open focus.

## Important Boundaries

- Do not generate ML pass/fail/dropout probabilities in the LLM; use schema `ml` only.
- CTĐT RAG answers must include citation file/page/section and only cover indexed MVP programs.
- Non-MVP CTĐT questions should refuse softly until the corpus is expanded.
- Retrieval-specific observability events are not done; H51 currently appears through generic tool-call events.

## Verification Commands

```powershell
cd backend
python -m ruff check --no-cache app/agent app/rag tests/test_ctdt_tool_h51.py tests/test_ctdt_retrieval_smoke.py
pytest -q --no-cov -p no:cacheprovider tests/test_ctdt_tool_h51.py
pytest -q --no-cov -p no:cacheprovider tests/test_ctdt_tool_h51.py tests/test_chat_scope_h49.py tests/test_prompt_versioning_h59.py tests/test_ctdt_cache_h64.py tests/test_ctdt_inventory.py tests/test_ingest_ctdt_rag_dry_run.py
pytest -q --no-cov -p no:cacheprovider -m integration tests/test_ctdt_retrieval_smoke.py
```

Latest local results:

- Ruff: pass.
- H51 unit/regression: 41 passed.
- H51/H49/H59/H64/corpus/ingest dry-run bundle: 85 passed.
- Integration smoke: 3 skipped locally without DB/embedding key.

## Key Files

| Path | Role |
|------|------|
| `backend/app/agent/tools.py` | H49 tools plus H51 CTĐT RAG tool |
| `backend/app/agent/nodes.py` | Universal Chat tool registration |
| `backend/app/agent/prompts.py` | Router/core prompt policy and prompt versions |
| `backend/app/rag/ctdt_retrieval.py` | pgvector retrieval + H64 cache |
| `backend/tests/test_ctdt_tool_h51.py` | H51 regression coverage |
| `docs/07-Sprint-Planning/stories/H51.md` | H51 story packet and DoD |
| `walkthrough.md` | H51 implementation walkthrough |

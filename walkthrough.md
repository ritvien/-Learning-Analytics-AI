# H51 — CTĐT RAG Q&A MVP Walkthrough

## Summary

Integrated CTĐT retrieval (H62/H63/H64) into the Universal Chat Agent as a new LangGraph tool `search_ctdt_program_info`. The agent can now answer questions about curriculum programs (ngành, mục tiêu đào tạo, CĐR/PLO, khối kiến thức, học phần) with citation to source PDF files.

## Changes Made

### 1. [tools.py](file:///c:/Users/Admin/Work/AI In Action/C2-App-056/backend/app/agent/tools.py) — New tool + alias resolution

- **`_MVP_PROGRAMS`**: Set of 3 indexed programs (CNTT, KHDL, TTNT)
- **`_PROGRAM_ALIASES`**: Maps MVP aliases (abbreviations, accentless names, codes) to canonical names
- **`resolve_program_alias()` / `detect_program_from_query()`**: Alias resolution plus deterministic query inference when the LLM omits `program_name`
- **`search_ctdt_program_info()`**: Async `@tool` that:
  1. Resolves program alias
  2. Rejects non-MVP programs with `ERROR:` prefix (no retrieval call)
  3. Clamps `top_k` to `[1, 5]`
  4. Calls `search_ctdt_chunks()` from `app.rag.ctdt_retrieval`
  5. Filters hits below score threshold (0.3)
  6. Returns structured JSON with citation fields or descriptive error

---

### 2. [nodes.py](file:///c:/Users/Admin/Work/AI In Action/C2-App-056/backend/app/agent/nodes.py) — Tool registration

- Added `search_ctdt_program_info` to imports and `_BASE_TOOLS` list
- `TOOLS = wrap_tools_with_timing(_BASE_TOOLS)` auto-wraps with instrumentation

---

### 3. [prompts.py](file:///c:/Users/Admin/Work/AI In Action/C2-App-056/backend/app/agent/prompts.py) — Prompt updates

| Area | Change |
|:-----|:-------|
| **Router prompt** | New rule: CTĐT/CĐR/PLO questions → `core_agent` + `needs_tools=true` |
| **Router example** | Added: `"Chuẩn đầu ra ngành CNTT là gì?"` → core_agent |
| **Guardrail block** | CTĐT policy: mandatory `search_ctdt_program_info`, no hallucination, **Nguồn** section |
| **Core Capabilities** | Listed `search_ctdt_program_info` with usage rules |
| **Specialized tools** | Updated CTĐT/CĐR/PLO section with mandatory citation policy |
| **Constraints** | Added `search_ctdt_program_info` to allowed tool list |
| **Versions** | `ROUTER_PROMPT_VERSION` and `CORE_AGENT_PROMPT_VERSION` bumped to `2026-07-01.2` |

---

### 4. [test_ctdt_tool_h51.py](file:///c:/Users/Admin/Work/AI In Action/C2-App-056/backend/tests/test_ctdt_tool_h51.py) — 41 tests

| Test Class | Count | Coverage |
|:-----------|:-----:|:---------|
| `TestResolveAlias` | 15 | CNTT/KHDL/TTNT abbreviations, codes, full names/accentless names, query detection, None, empty, unknown, whitespace |
| `TestHitStructure` | 3 | Citation fields present, query preserved, multiple hits |
| `TestUnsupportedProgram` | 5 | Non-MVP rejected, code rejected, None passes through, inferred MVP, inferred non-MVP rejection |
| `TestEmptyAndLowScore` | 4 | Empty hits, low score filtered, mixed scores, retrieval exception |
| `TestTopKClamp` | 4 | 0→1, -3→1, 10→5, 3→3 |
| `TestToolRegistry` | 2 | Tool in TOOLS list, _BASE_TOOLS count = 5 |
| `TestPromptCtdtPolicy` | 8 | Router routing, example, tool name, citation, mandatory, constraints, versions, checksums |

## What Was Tested

```
cd backend; python -m ruff check --no-cache app/agent app/rag tests/test_ctdt_tool_h51.py tests/test_ctdt_retrieval_smoke.py
→ All checks passed!
cd backend; pytest -q --no-cov -p no:cacheprovider tests/test_ctdt_tool_h51.py
→ 41 passed
cd backend; pytest -q --no-cov -p no:cacheprovider tests/test_ctdt_tool_h51.py tests/test_chat_scope_h49.py tests/test_prompt_versioning_h59.py tests/test_ctdt_cache_h64.py tests/test_ctdt_inventory.py tests/test_ingest_ctdt_rag_dry_run.py
→ 85 passed
cd backend; pytest -q --no-cov -p no:cacheprovider -m integration tests/test_ctdt_retrieval_smoke.py
→ 3 skipped locally without DB/embedding key
```

## Validation Results

- ✅ **Ruff**: Clean — no lint issues
- ✅ **H51 tool tests**: 41/41 passed
- ✅ **H49 scope tests**: 3/3 passed (no regression)
- ✅ **H59 prompt versioning tests**: 16/16 passed (no regression, checksums valid)
- ✅ **H64/corpus dry-run regression bundle**: included in 85-test pass
- ⚠️ **Integration smoke**: tool-level smoke added; skipped locally without DB/embedding key
- ✅ **No API/schema/migration/frontend changes** per PLAN.md scope

## Contracts Preserved

- HTTP API unchanged: `POST /api/v1/chat`, `POST /api/v1/chat/stream`
- SSE event shape unchanged — new tool appears as a `tool_call` name
- H49 boundary intact — dropout via ML tool, CLO via CLO tool, analytics via DWH/view whitelist

## Follow-up Fixes After Review

- Added deterministic program detection from the user query when the LLM omits `program_name`.
- Non-MVP programs mentioned in the query (for example `QTKD`) now return the H51 unsupported-program `ERROR:` before retrieval.
- Added H51 regression coverage for inferred MVP programs, inferred non-MVP rejection, and accentless full-name aliases.
- Added an integration smoke test that goes through `search_ctdt_program_info` instead of only calling raw retrieval.

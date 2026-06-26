# H40 — Guardrails Test Evidence (G3-3)

Automated and manual test cases for AI-side guardrails (scope, safety, privacy, injection, refusal, uncertainty).

## Unit tests (`pytest`)

| ID | Loại | Input / focus | Expected | Command |
|:---|:-----|:--------------|:---------|:--------|
| H40-U01 | 3.4 Injection | EN TC15 payload | `is_prompt_injection` → True | `pytest tests/test_guardrails_h40.py::TestInjectionDetection -q` |
| H40-U02 | 3.1 Scope | Stock price TC14 | `is_out_of_domain` → True | `pytest tests/test_guardrails_h40.py::TestOutOfDomain -q` |
| H40-U03 | 3.2 Safety | Malware / weapon requests | `is_unsafe_request` → True | `pytest tests/test_guardrails_h40.py::TestSafetyDetection -q` |
| H40-U04 | 3.3 Privacy | API key / JWT exfil ask | `classify_input` → `privacy` | `pytest tests/test_guardrails_h40.py::TestPrivacyExfil -q` |
| H40-U05 | 3.7 Refusal | `build_refusal(kind)` | Short, no numbered steps, academic alternative | `pytest tests/test_guardrails_h40.py::TestRefusalContract -q` |
| H40-U06 | 3.3 Output | Email / `sk-` in output | Masked / redacted | `pytest tests/test_guardrails_h40.py::TestPrivacyMasking -q` |
| H40-U07 | 3.5 Tool policy | `CORE_AGENT_SYSTEM_PROMPT` | Read-only tools, ADR-006 dropout | `pytest tests/test_guardrails_h40.py::TestToolPolicyPrompt -q` |
| H40-U08 | 3.10 Style | Core prompt | Professional tone | `pytest tests/test_guardrails_h40.py::TestStylePrompt -q` |

## API integration tests

| ID | Loại | Endpoint | Expected |
|:---|:-----|:---------|:---------|
| H40-I01 | 3.4 | `POST /api/v1/chat` injection | 200, refusal, agent not invoked |
| H40-I02 | 3.2 | `POST /api/v1/chat` safety | 200, safety refusal |
| H40-I03 | 3.3 | `POST /api/v1/chat` privacy exfil | 200, privacy refusal |
| H40-I04 | 3.1 | `POST /api/v1/chat` TC14 scope | 200, `ngoài phạm vi` + academic hint |
| H40-I05 | 3.3+3.6 | Node output sanitize | Schema/SQL redacted in core + fast nodes |

Command:

```powershell
cd backend
pytest tests/test_chat_guardrails_h40.py -q
```

## Eval test cases (`gate3_test_cases.json`)

| TC | Category | Description |
|:---|:---------|:------------|
| TC14 | `guardrail_scope` | Stock price — refuse |
| TC15 | `guardrail_injection` | EN injection — no schema leak |
| TC19–TC21 | scope / injection | VI injection, marketing, ADR-006 dropout |
| TC22 | `data_query` | Regression — in-domain not blocked |
| TC23 | `guardrail_safety` | SQL attack instructions — refuse |
| TC24 | `guardrail_privacy` | Credential exfil — refuse |
| TC25 | `guardrail_injection` | Untrusted doc injection |
| TC26 | `guardrail_uncertainty` | No fabricated 100% claims |

Command (requires backend + LLM key):

```powershell
cd backend
python scripts/run_evaluation.py
```

## Implementation map

| Layer | Module |
|:------|:-------|
| Input heuristic | `backend/app/agent/guardrails.py` — `classify_input`, `build_refusal` |
| Prompt contract | `backend/app/agent/prompts.py`, `report_prompts.py` |
| Short-circuit | `backend/app/api/v1/endpoints/chat.py` |
| Output sanitize | `backend/app/agent/nodes.py`, `report_service.py` |

## Verify (full)

```powershell
cd backend
ruff check .
pytest tests/test_guardrails_h40.py tests/test_chat_guardrails_h40.py tests/test_error_handling_h52.py tests/test_chat_agent_h48.py -v
```

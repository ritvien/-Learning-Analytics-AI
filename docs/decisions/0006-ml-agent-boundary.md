# ADR-006: ML prediction vs LLM explanation boundary

**Status:** accepted

## Context

Pass/fail predictions must be reproducible, auditable, and statistically valid. LLMs hallucinate probabilities.

## Decision

- ML models predict **pass/fail probability per enrollment**, then aggregate expected passed/failed credits per student-semester.
- The **LLM only explains** predictions retrieved from schema `ml` — it must **not** generate probabilities directly.

## Consequences

- Agent tools read from `ml` / DWH; no "estimate pass rate" in free-form LLM output
- Docs, prompts, and tests must enforce this boundary
- Verify: guardrail tests in Gate G3 (H40/T40) and agent eval cases

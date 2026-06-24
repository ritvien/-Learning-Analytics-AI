# ADR-003: OpenAI GPT-5 series with model tiering

**Status:** accepted · **Date:** 2026-06

## Context

Cost and latency vary widely by task type (routing vs deep reasoning). A single model for all steps is inefficient.

## Decision

Use **OpenAI GPT-5 series** with tiered routing:

- **GPT-5.4 Nano** — router, guard, fast classification
- **GPT-5.4** — core reasoning and complex tool orchestration

## Consequences

- Router/guard prompts should stay on the smaller model
- Cost reporting must split router vs core usage (see Gate G3-5)
- Do not swap providers without updating eval baselines

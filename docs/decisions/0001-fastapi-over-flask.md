# ADR-001: FastAPI over Flask/Django

**Status:** accepted

## Context

The backend must stream AI responses (SSE) and handle concurrent async I/O for chat, analytics, and tool calls.

## Decision

Use **FastAPI** instead of Flask or Django.

## Consequences

- Native async support for streaming endpoints
- Pydantic validation integrated with OpenAPI
- Verify: `pytest tests/test_health.py` and chat-related integration tests

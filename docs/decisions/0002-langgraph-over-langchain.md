# ADR-002: LangGraph over standard LangChain

**Status:** accepted

## Context

The agent must retry and recover when tool calls fail, using conditional loops rather than a single forward pass.

## Decision

Use **LangGraph** instead of standard LangChain chains for the cognitive layer.

## Consequences

- Cyclic graphs with `ToolNode(handle_tool_errors=True)` and retry policies
- Agent design documented in [LangGraphAgent.md](../10-References/LangGraphAgent.md)
- Verify: agent integration tests under `backend/tests/`

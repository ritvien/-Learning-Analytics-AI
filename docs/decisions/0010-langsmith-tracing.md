# ADR-010 — LangSmith tracing for agent observability

| Field    | Value                           |
|:---------|:--------------------------------|
| Status   | accepted                        |
| Date     | 2026-06-29                      |
| Sprint   | Sprint 4 (H59)                  |
| Authors  | Hoàng                           |

## Context

EduInsight cần trace agent runs để debug, evaluate, và demo. Hai lựa chọn:

1. **LangSmith** — native LangChain/LangGraph tracing, bật bằng env vars, tự động capture chain/tool/LLM calls, metadata/tags/run_id.
2. **Langfuse** — open-source, self-hosted, nhưng cần thêm SDK + callback integration.

## Decision

Chọn **LangSmith** cho Sprint 4 vì:

- Repo đã dùng LangChain/LangGraph → tracing tự động qua env `LANGSMITH_TRACING=true`.
- Metadata, tags, run_id truyền qua `RunnableConfig` — không cần thêm SDK/callback.
- Setup chỉ cần env vars: `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`.
- Đủ cho demo + evaluation Sprint 4 scope.

**Langfuse deferred** — nếu cần self-hosted hoặc tính năng Langfuse-specific (prompt management UI, scoring UI) thì evaluate lại Sprint 5+.

## Consequences

- Agent runs tự động gửi traces khi `LANGSMITH_TRACING=true`.
- Chat endpoint truyền `RunnableConfig` với `run_name`, `tags`, `metadata` (trace_id, agent_run_id, user_role, prompt_versions).
- Prompt version manifest được persist vào bảng `agent_prompt_versions` sẵn có.
- Metadata **không** chứa raw prompt content — chỉ checksums để trace ngược.
- Phụ thuộc LangSmith free tier hoặc paid plan cho production.

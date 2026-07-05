# ADR-011 — In-process semaphore for agent concurrency limiting

| Field    | Value                           |
|:---------|:--------------------------------|
| Status   | accepted                        |
| Date     | 2026-07-05                      |
| Sprint   | Sprint 4 (H67)                  |
| Authors  | Hoàng                           |

## Context

Production chạy trên Render Free: **1 uvicorn worker, 512 MB RAM, 0.1 CPU** (`backend/entrypoint.sh`, `WORKERS=1`). Trước H67 không có queue, rate limit, hay backpressure — mọi chat request chạy song song trong asyncio event loop:

- Mỗi agent run giữ LangGraph state + tool output trong RAM 5–30 giây → nhiều run đồng thời dễ OOM.
- LLM API key dùng chung → concurrent runs dễ trigger 429 từ provider.
- Vercel proxy có `maxDuration=120` nhưng backend không tự enforce timeout — run treo giữ tài nguyên vô hạn.

Các lựa chọn:

1. **External queue (Redis/Valkey + worker, Celery, Kafka)** — backpressure thật sự, survive restart, scale ngang.
2. **FastAPI `BackgroundTasks` + DB job table** — async response, nhưng đổi contract API sang polling.
3. **In-process `asyncio.Semaphore`** — giới hạn concurrent runs ngay trong event loop, zero dependency.

## Decision

Chọn **`asyncio.Semaphore` in-process** (Lớp 1):

- Render Free không có budget cho Redis/worker riêng; thêm dependency mới bị H67 acceptance criteria loại trừ.
- Single instance + single worker → semaphore trong event loop là đủ chính xác (không cần distributed lock).
- Demo Day < 5 concurrent users; giới hạn 3 slot đủ giữ RAM và tránh LLM 429.

Cụ thể:

- `_AGENT_SEMAPHORE = asyncio.Semaphore(MAX_CONCURRENT_AGENT_RUNS)` (env, default **3**) trong `backend/app/api/v1/endpoints/chat.py`.
- **Fail-fast, không xếp hàng**: hết slot → `POST /chat` trả **HTTP 429** (kèm `Retry-After`), `POST /chat/stream` trả SSE `{"type":"error","code":"server_busy",...}`. Request bị từ chối log event `agent_run_rejected`.
- **Timeout 120s** (env `AGENT_RUN_TIMEOUT_SECONDS`) enforce quanh `ainvoke`/`astream_events`; quá hạn log event `agent_run_timeout` và trả lỗi thân thiện (504 / SSE error).
- Guardrail refusal và session CRUD **không** chiếm slot — chỉ agent run (LLM + tools) bị giới hạn.
- Frontend hiển thị thông báo retry-friendly + nút "Thử lại" sau 5 giây, không auto-retry.

## Khi nào nâng cấp

| Giai đoạn | Trigger | Giải pháp |
|:----------|:--------|:----------|
| Hiện tại (H67) | Demo Day / <5 concurrent users | `asyncio.Semaphore(3)` in-process |
| Lớp 2 | Cần async response cho report dài | FastAPI `BackgroundTasks` + DB job table + polling |
| Lớp 3 | >10 concurrent / Render Paid / multi-instance | Render Key Value (Valkey) + Background Worker + `arq`/`taskiq` |

Semaphore in-process **mất hiệu lực khi chạy nhiều worker/instance** — nếu tăng `WORKERS` hoặc scale ngang thì bắt buộc chuyển Lớp 3.

## Consequences

- Không thêm dependency mới; giới hạn chỉ đúng trong phạm vi 1 process (chấp nhận với `WORKERS=1`).
- User thứ 4 trở đi khi hệ thống bận sẽ bị từ chối ngay thay vì chờ — trade-off có chủ đích để giữ p95 latency và RAM.
- Report scheduler (asyncio.create_task, polling 60s) nằm ngoài semaphore — theo dõi riêng nếu thành nguồn nghẽn.
- Observability có thêm `agent_run_rejected` / `agent_run_timeout` để đo tần suất nghẽn thật trên production, làm input cho quyết định nâng Lớp 3.

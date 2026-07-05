"""H67 — Agent concurrency limiter & backpressure (ADR-0011).

Covers: semaphore fail-fast semantics (3 parallel, extras rejected), slot
release on success/failure, HTTP 429 + SSE server_busy mapping, and the
120s (patched short) run-timeout enforcement on both chat endpoints.
"""

from __future__ import annotations

import asyncio
import json
from contextlib import AsyncExitStack
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from langchain_core.messages import AIMessage, HumanMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints import chat as chat_module

# ── Shared fixtures / helpers (mirrors test_chat_agent_h48) ─────────────


class _TestSessionCM:
    """Route chat endpoint DB access to the pytest async session."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def __aenter__(self) -> AsyncSession:
        return self._session

    async def __aexit__(self, *args: object) -> None:
        return None


def _chat_patches(db_session: AsyncSession):
    """Patch AsyncSessionLocal + observability for chat endpoint tests."""
    return (
        patch("app.api.v1.endpoints.chat.AsyncSessionLocal", lambda: _TestSessionCM(db_session)),
        patch("app.api.v1.endpoints.chat.log_event", new_callable=AsyncMock),
    )


def _agent_result(response_text: str = "Trả lời mẫu") -> dict[str, Any]:
    return {
        "messages": [HumanMessage(content="Q"), AIMessage(content=response_text)],
        "context": {
            "intent": "core_agent",
            "intent_category": "analytics",
            "complexity": "complex",
            "route_decision": {
                "mode": "full_chat",
                "target_route": "/chatbot",
                "reason": "Cần tools",
                "preserve_context": True,
            },
        },
    }


def _patch_title():
    return patch(
        "app.api.v1.endpoints.chat.generate_title",
        new_callable=AsyncMock,
        return_value="H67 test chat",
    )


def _slot_count() -> int:
    return chat_module._settings.max_concurrent_agent_runs


async def _saturate_semaphore() -> None:
    for _ in range(_slot_count()):
        await chat_module._AGENT_SEMAPHORE.acquire()


def _release_semaphore() -> None:
    for _ in range(_slot_count()):
        chat_module._AGENT_SEMAPHORE.release()


async def _assert_all_slots_free() -> None:
    """Prove no slot leaked: all permits must be acquirable without busy."""
    async with AsyncExitStack() as stack:
        for _ in range(_slot_count()):
            await stack.enter_async_context(chat_module._agent_slot())


def _logged_event_names(mock_log: AsyncMock) -> list[str]:
    return [call.args[0] for call in mock_log.await_args_list]


async def _collect_sse_events(
    client: AsyncClient, payload: dict[str, Any]
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    async with client.stream("POST", "/api/v1/chat/stream", json=payload) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line.removeprefix("data: ")))
    return events


# ── Semaphore slot semantics (unit) ─────────────────────────────────────


class TestAgentSlot:
    async def test_five_concurrent_runs_only_three_parallel(self):
        """5 runs đồng thời: đúng 3 chạy song song, 2 bị reject fail-fast."""
        release = asyncio.Event()
        active = 0
        max_active = 0
        completed = 0
        rejected = 0

        async def run_once() -> None:
            nonlocal active, max_active, completed, rejected
            try:
                async with chat_module._agent_slot():
                    active += 1
                    max_active = max(max_active, active)
                    await release.wait()
                    active -= 1
                    completed += 1
            except chat_module.AgentBusyError:
                rejected += 1

        tasks = [asyncio.create_task(run_once()) for _ in range(5)]
        try:
            for _ in range(100):
                if rejected == 2 and active == _slot_count():
                    break
                await asyncio.sleep(0.01)
            assert active == _slot_count() == 3
            assert rejected == 2
        finally:
            release.set()
            await asyncio.gather(*tasks)

        assert completed == 3
        assert max_active == 3
        await _assert_all_slots_free()

    async def test_slot_released_when_run_raises(self):
        with pytest.raises(RuntimeError):
            async with chat_module._agent_slot():
                raise RuntimeError("boom")
        await _assert_all_slots_free()

    async def test_rejected_run_does_not_consume_a_slot(self):
        await _saturate_semaphore()
        try:
            with pytest.raises(chat_module.AgentBusyError):
                async with chat_module._agent_slot():
                    pass
        finally:
            _release_semaphore()
        await _assert_all_slots_free()


# ── POST /api/v1/chat — busy → 429, timeout → 504 ───────────────────────


class TestChatBackpressure:
    async def test_busy_returns_429_with_retry_after(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        patch_local, patch_log = _chat_patches(db_session)
        await _saturate_semaphore()
        try:
            with patch_local, patch_log as mock_log, _patch_title(), patch(
                "app.api.v1.endpoints.chat._agent"
            ) as mock_agent:
                mock_agent.ainvoke = AsyncMock(return_value=_agent_result())
                response = await client.post(
                    "/api/v1/chat",
                    json={"message": "Top 5 môn trượt?", "context": {}},
                )
        finally:
            _release_semaphore()

        assert response.status_code == 429
        assert response.json()["detail"] == chat_module.SERVER_BUSY_MESSAGE
        assert response.headers["Retry-After"] == str(
            chat_module.SERVER_BUSY_RETRY_AFTER_SECONDS
        )
        mock_agent.ainvoke.assert_not_awaited()
        assert "agent_run_rejected" in _logged_event_names(mock_log)
        await _assert_all_slots_free()

    async def test_timeout_returns_504_and_logs_timeout_event(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        async def slow_invoke(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
            await asyncio.sleep(5)
            return _agent_result()

        patch_local, patch_log = _chat_patches(db_session)
        with patch_local, patch_log as mock_log, _patch_title(), patch(
            "app.api.v1.endpoints.chat._agent"
        ) as mock_agent, patch.object(
            chat_module._settings, "agent_run_timeout_seconds", 0.05
        ):
            mock_agent.ainvoke = slow_invoke
            response = await client.post(
                "/api/v1/chat",
                json={"message": "Câu hỏi chạy quá lâu", "context": {}},
            )

        assert response.status_code == 504
        assert response.json()["detail"] == chat_module.AGENT_TIMEOUT_MESSAGE
        assert "agent_run_timeout" in _logged_event_names(mock_log)
        await _assert_all_slots_free()

    async def test_slot_released_after_successful_run(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        patch_local, patch_log = _chat_patches(db_session)
        with patch_local, patch_log, _patch_title(), patch(
            "app.api.v1.endpoints.chat._agent"
        ) as mock_agent:
            mock_agent.ainvoke = AsyncMock(return_value=_agent_result())
            response = await client.post(
                "/api/v1/chat",
                json={"message": "Xin chào", "context": {}},
            )

        assert response.status_code == 200
        await _assert_all_slots_free()


# ── POST /api/v1/chat/stream — busy/timeout → SSE error ─────────────────


class TestChatStreamBackpressure:
    async def test_busy_emits_server_busy_sse_error_before_session_create(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        patch_local, patch_log = _chat_patches(db_session)
        await _saturate_semaphore()
        try:
            with patch_local, patch_log as mock_log, _patch_title(), patch(
                "app.api.v1.endpoints.chat._agent"
            ):
                events = await _collect_sse_events(
                    client, {"message": "Phân tích KPI", "context": {}}
                )
        finally:
            _release_semaphore()

        assert len(events) == 1
        busy = events[0]
        assert busy["type"] == "error"
        assert busy["code"] == "server_busy"
        assert busy["message"] == chat_module.SERVER_BUSY_MESSAGE
        assert busy["retry_after_seconds"] == chat_module.SERVER_BUSY_RETRY_AFTER_SECONDS
        # Rejected before any session/title work — no session_created event.
        assert not any(event["type"] == "session_created" for event in events)
        assert "agent_run_rejected" in _logged_event_names(mock_log)
        await _assert_all_slots_free()

    async def test_timeout_emits_agent_timeout_sse_error(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        async def slow_stream(*_args: Any, **_kwargs: Any):
            await asyncio.sleep(5)
            yield {"event": "noop", "name": "noop", "data": {}, "metadata": {}}

        patch_local, patch_log = _chat_patches(db_session)
        with patch_local, patch_log as mock_log, _patch_title(), patch(
            "app.api.v1.endpoints.chat._agent"
        ) as mock_agent, patch.object(
            chat_module._settings, "agent_run_timeout_seconds", 0.05
        ):
            mock_agent.astream_events = slow_stream
            events = await _collect_sse_events(
                client, {"message": "Câu hỏi chạy quá lâu", "context": {}}
            )

        error_events = [event for event in events if event["type"] == "error"]
        assert len(error_events) == 1
        assert error_events[0]["code"] == "agent_timeout"
        assert error_events[0]["message"] == chat_module.AGENT_TIMEOUT_MESSAGE
        assert "agent_run_timeout" in _logged_event_names(mock_log)
        await _assert_all_slots_free()

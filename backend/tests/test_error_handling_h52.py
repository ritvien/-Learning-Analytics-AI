"""Tests for H52 — three-tier agent error handling + HTTP mapping."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import status
from httpx import AsyncClient
from langchain_core.messages import AIMessage, HumanMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.errors import (
    AUTH_ERROR_PROD_MESSAGE,
    GENERIC_HTTP_MESSAGE,
    RATE_LIMIT_MESSAGE,
    MissingLLMCredentialsError,
    map_agent_exception_to_http,
    stream_error_message,
    tool_error_handler,
)
from app.agent.nodes import core_agent_node, router_node
from app.agent.route_decision import RouteMode


class TestErrorClassification:
    def test_rate_limit_by_class_name(self):
        class FakeRateLimitError(Exception):
            pass

        code, detail = map_agent_exception_to_http(
            FakeRateLimitError("quota"), is_development=False
        )
        assert code == status.HTTP_429_TOO_MANY_REQUESTS
        assert detail == RATE_LIMIT_MESSAGE

    def test_missing_credentials_production_hides_detail(self):
        exc = MissingLLMCredentialsError("secret key info")
        code, detail = map_agent_exception_to_http(exc, is_development=False)
        assert code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert detail == AUTH_ERROR_PROD_MESSAGE
        assert "secret" not in detail

    def test_generic_production_hides_exception_text(self):
        code, detail = map_agent_exception_to_http(
            RuntimeError("db connection string leaked"),
            is_development=False,
        )
        assert code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert detail == GENERIC_HTTP_MESSAGE

    def test_generic_development_includes_exception(self):
        code, detail = map_agent_exception_to_http(
            RuntimeError("debug info"),
            is_development=True,
        )
        assert code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "debug info" in detail

    def test_stream_error_message_matches_http_mapping(self):
        exc = RuntimeError("internal")
        assert stream_error_message(exc, is_development=False) == GENERIC_HTTP_MESSAGE


class TestToolErrorHandler:
    def test_timeout_returns_actionable_message(self):
        msg = tool_error_handler(TimeoutError(), {"name": "execute_sql_query"})
        assert "execute_sql_query" in msg
        assert "timeout" in msg.lower()

    def test_connection_error_suggests_alternative(self):
        msg = tool_error_handler(ConnectionError(), {"name": "calculate_student_clo_scores"})
        assert "calculate_student_clo_scores" in msg
        assert "kết nối" in msg.lower() or "tool" in msg.lower()


class TestRouterNodeGracefulFailure:
    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_fast_response(self):
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = RuntimeError("LLM unavailable")

        with patch("app.agent.nodes.get_model", return_value=mock_llm):
            result = await router_node(
                {
                    "messages": [HumanMessage(content="Xin chào")],
                    "context": {"route": "/dashboard", "module": "dashboard"},
                }
            )

        ctx = result["context"]
        assert ctx["intent"] == "fast_response"
        assert ctx["route_decision"]["mode"] == RouteMode.inline.value
        assert ctx["route_decision"]["target_route"] == "/dashboard"
        assert "error" in result

    @pytest.mark.asyncio
    async def test_missing_credentials_propagates(self):
        with patch(
            "app.agent.nodes.get_model",
            side_effect=MissingLLMCredentialsError("no key"),
        ):
            with pytest.raises(MissingLLMCredentialsError):
                await router_node({"messages": [HumanMessage(content="Hi")]})


class TestCoreAgentNodeGracefulFailure:
    @pytest.mark.asyncio
    async def test_llm_failure_returns_fallback_message(self):
        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke = AsyncMock(side_effect=RuntimeError("model down"))

        with patch("app.agent.nodes.get_model", return_value=mock_llm):
            result = await core_agent_node(
                {"messages": [HumanMessage(content="Top 5 môn trượt?")]}
            )

        assert len(result["messages"]) == 1
        assert isinstance(result["messages"][0], AIMessage)
        assert result["messages"][0].content
        assert "error" in result


class _TestSessionCM:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def __aenter__(self) -> AsyncSession:
        return self._session

    async def __aexit__(self, *args: object) -> None:
        return None


def _chat_patches(db_session: AsyncSession):
    return (
        patch("app.api.v1.endpoints.chat.AsyncSessionLocal", lambda: _TestSessionCM(db_session)),
        patch("app.api.v1.endpoints.chat.log_event", new_callable=AsyncMock),
    )


@asynccontextmanager
async def _mock_chat_agent(db_session: AsyncSession, side_effect: Exception):
    patch_local, patch_log = _chat_patches(db_session)
    with patch_local, patch_log, patch("app.api.v1.endpoints.chat._agent") as mock_agent:
        mock_agent.ainvoke = AsyncMock(side_effect=side_effect)
        with patch(
            "app.api.v1.endpoints.chat.generate_title",
            new_callable=AsyncMock,
            return_value="Test",
        ):
            yield


class TestChatHttpErrorHandling:
    @pytest.mark.asyncio
    async def test_missing_credentials_returns_503(self, client: AsyncClient, db_session: AsyncSession):
        async with _mock_chat_agent(
            db_session,
            MissingLLMCredentialsError("Set OPENAI_API_KEY"),
        ):
            response = await client.post(
                "/api/v1/chat",
                json={"message": "Xin chào", "context": {"module": "dashboard"}},
            )

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    @pytest.mark.asyncio
    async def test_rate_limit_returns_429(self, client: AsyncClient, db_session: AsyncSession):
        class RateLimitError(Exception):
            status_code = 429

        async with _mock_chat_agent(db_session, RateLimitError("too many")):
            response = await client.post(
                "/api/v1/chat",
                json={"message": "Phân tích KPI", "context": {"module": "dashboard"}},
            )

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert RATE_LIMIT_MESSAGE in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_unexpected_error_hides_details_in_production(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        async with _mock_chat_agent(db_session, RuntimeError("secret internal detail")):
            with patch("app.api.v1.endpoints.chat._is_development", return_value=False):
                response = await client.post(
                    "/api/v1/chat",
                    json={"message": "Test", "context": {"module": "dashboard"}},
                )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.json()["detail"] == GENERIC_HTTP_MESSAGE
        assert "secret" not in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_stream_error_event_is_user_safe(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        async def failing_astream_events(*_args: Any, **_kwargs: Any):
            raise RuntimeError("leaked stack info")
            yield  # pragma: no cover — makes this an async generator

        patch_local, patch_log = _chat_patches(db_session)
        with patch_local, patch_log, patch("app.api.v1.endpoints.chat._agent") as mock_agent:
            mock_agent.astream_events = failing_astream_events
            with patch(
                "app.api.v1.endpoints.chat.generate_title",
                new_callable=AsyncMock,
                return_value="Stream",
            ):
                with patch("app.api.v1.endpoints.chat._is_development", return_value=False):
                    events: list[dict[str, Any]] = []
                    async with client.stream(
                        "POST",
                        "/api/v1/chat/stream",
                        json={"message": "Hi", "context": {"module": "dashboard"}},
                    ) as response:
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                events.append(json.loads(line.removeprefix("data: ")))

        error_events = [e for e in events if e.get("type") == "error"]
        assert error_events
        assert error_events[0]["message"] == GENERIC_HTTP_MESSAGE
        assert "leaked" not in error_events[0]["message"]

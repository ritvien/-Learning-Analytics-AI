"""Comprehensive tests for H48 — Universal Chatbot Core."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from httpx import AsyncClient
from langchain_core.messages import AIMessage, HumanMessage, messages_to_dict
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.context_rbac import validate_and_merge_context
from app.agent.nodes import route_after_router, router_node
from app.agent.route_decision import (
    ComplexityLevel,
    IntentCategory,
    RouteMode,
    RouterClassification,
    build_route_decision,
    parse_router_response,
)
from app.models.chat import ChatSession
from app.models.people import User, UserRole

# ── Shared fixtures / helpers ───────────────────────────────────────────


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


def _agent_context(
    *,
    graph_route: str = "core_agent",
    intent_category: str = "analytics",
    complexity: str = "complex",
    mode: str = "full_chat",
    target_route: str = "/chatbot",
    reason: str = "Cần tools",
) -> dict[str, Any]:
    return {
        "intent": graph_route,
        "intent_category": intent_category,
        "complexity": complexity,
        "route_decision": {
            "mode": mode,
            "target_route": target_route,
            "reason": reason,
            "preserve_context": True,
        },
    }


def _agent_result(context: dict[str, Any], response_text: str = "Trả lời mẫu") -> dict[str, Any]:
    return {
        "messages": [HumanMessage(content="Q"), AIMessage(content=response_text)],
        "context": context,
    }


async def _create_session(
    db_session: AsyncSession,
    *,
    user_id: str = "test-admin",
    title: str = "Existing chat",
    messages: list | None = None,
) -> ChatSession:
    session = ChatSession(
        id=uuid.uuid4(),
        user_id=user_id,
        title=title,
        messages=messages_to_dict(messages or [HumanMessage(content="Xin chào")]),
    )
    db_session.add(session)
    await db_session.flush()
    return session


@asynccontextmanager
async def _mock_chat_agent(db_session: AsyncSession, agent_result: dict[str, Any]):
    patch_local, patch_log = _chat_patches(db_session)
    with patch_local, patch_log, patch("app.api.v1.endpoints.chat._agent") as mock_agent:
        mock_agent.ainvoke = AsyncMock(return_value=agent_result)
        yield mock_agent


def _router_json(**overrides: Any) -> str:
    payload = {
        "graph_route": "fast_response",
        "intent_category": "chitchat",
        "complexity": "simple",
        "needs_tools": False,
        "reason": "Chào hỏi",
    }
    payload.update(overrides)
    return json.dumps(payload)


async def _mock_router_node(state: dict[str, Any], router_payload: dict[str, Any]) -> dict[str, Any]:
    mock_response = MagicMock()
    mock_response.content = json.dumps(router_payload)
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = mock_response
    with patch("app.agent.nodes.get_model", return_value=mock_llm):
        return await router_node(state)


# ── Route decision unit tests ───────────────────────────────────────────


class TestRouteDecisionParsing:
    @pytest.mark.parametrize(
        ("intent", "expected"),
        [
            ("analytics", IntentCategory.analytics),
            ("report", IntentCategory.report),
            ("navigation", IntentCategory.navigation),
            ("help", IntentCategory.help),
            ("chitchat", IntentCategory.chitchat),
        ],
    )
    def test_parse_intent_categories(self, intent: str, expected: IntentCategory):
        raw = _router_json(intent_category=intent)
        assert parse_router_response(raw).intent_category == expected

    def test_parse_json_router_response(self):
        raw = _router_json(
            graph_route="core_agent",
            intent_category="analytics",
            complexity="complex",
            needs_tools=True,
            reason="Cần truy vấn thống kê",
        )
        result = parse_router_response(raw)
        assert result.graph_route == "core_agent"
        assert result.complexity == ComplexityLevel.complex
        assert result.needs_tools is True

    def test_parse_legacy_fast_response_token(self):
        result = parse_router_response("fast_response")
        assert result.graph_route == "fast_response"
        assert result.complexity == ComplexityLevel.simple

    def test_parse_invalid_json_falls_back_to_core_agent(self):
        result = parse_router_response("{not valid json")
        assert result.graph_route == "core_agent"
        assert result.needs_tools is True

    def test_build_route_decision_inline_chitchat(self):
        classification = RouterClassification(
            graph_route="fast_response",
            intent_category=IntentCategory.chitchat,
            complexity=ComplexityLevel.simple,
            needs_tools=False,
            reason="Chào hỏi",
        )
        decision = build_route_decision(classification, {"route": "/dashboard"})
        assert decision.mode == RouteMode.inline
        assert decision.target_route == "/dashboard"
        assert decision.preserve_context is True

    def test_build_route_decision_inline_page_context_without_tools(self):
        classification = RouterClassification(
            graph_route="core_agent",
            intent_category=IntentCategory.help,
            complexity=ComplexityLevel.simple,
            needs_tools=False,
            reason="Giải thích metric trên trang",
        )
        decision = build_route_decision(
            classification,
            {"route": "/reports/42", "entity_type": "report", "entity_id": "42"},
        )
        assert decision.mode == RouteMode.inline
        assert decision.target_route == "/reports/42"

    def test_build_route_decision_full_chat_for_tools(self):
        classification = RouterClassification(
            graph_route="core_agent",
            intent_category=IntentCategory.analytics,
            complexity=ComplexityLevel.complex,
            needs_tools=True,
            reason="Cần nhiều tool",
        )
        decision = build_route_decision(classification, {"route": "/reports/1"})
        assert decision.mode == RouteMode.full_chat
        assert decision.target_route == "/chatbot"


# ── RBAC unit tests ─────────────────────────────────────────────────────


class TestContextRbac:
    def test_merges_trusted_user_fields(self):
        user = User(
            id="u1",
            email="m@example.com",
            hashed_password="x",
            full_name="Manager",
            role=UserRole.manager,
            department_id=3,
        )
        merged = validate_and_merge_context(
            user,
            {"user_role": "admin", "department_scope": 99, "module": "dashboard"},
        )
        assert merged["user_role"] == "manager"
        assert merged["department_scope"] == 3
        assert merged["department_id"] == 3

    def test_rejects_forbidden_module_for_lecturer(self):
        user = User(
            id="u2",
            email="l@example.com",
            hashed_password="x",
            full_name="Lecturer",
            role=UserRole.lecturer,
            department_id=1,
        )
        with pytest.raises(HTTPException) as exc:
            validate_and_merge_context(user, {"module": "admin"})
        assert exc.value.status_code == 403

    def test_rejects_lecturer_department_scope_mismatch_on_student_entity(self):
        user = User(
            id="u3",
            email="l2@example.com",
            hashed_password="x",
            full_name="Lecturer",
            role=UserRole.lecturer,
            department_id=1,
        )
        with pytest.raises(HTTPException) as exc:
            validate_and_merge_context(
                user,
                {
                    "module": "dashboard",
                    "entity_type": "student",
                    "entity_id": "SV001",
                    "department_id": 99,
                },
            )
        assert exc.value.status_code == 403
        assert "mismatch" in exc.value.detail.lower()


# ── Router node tests ───────────────────────────────────────────────────


class TestRouterNode:
    @pytest.mark.asyncio
    async def test_fast_response_sets_inline_route_decision(self):
        result = await _mock_router_node(
            {
                "messages": [HumanMessage(content="Xin chào")],
                "context": {"route": "/tree", "module": "tree"},
            },
            {
                "graph_route": "fast_response",
                "intent_category": "chitchat",
                "complexity": "simple",
                "needs_tools": False,
                "reason": "Chào hỏi",
            },
        )
        ctx = result["context"]
        assert ctx["intent"] == "fast_response"
        assert ctx["route_decision"]["mode"] == "inline"
        assert ctx["route_decision"]["target_route"] == "/tree"
        assert route_after_router({"context": ctx}) == "fast_response"

    @pytest.mark.asyncio
    async def test_core_agent_sets_full_chat_route_decision(self):
        result = await _mock_router_node(
            {
                "messages": [HumanMessage(content="Top 5 môn trượt?")],
                "context": {"route": "/dashboard", "module": "dashboard"},
            },
            {
                "graph_route": "core_agent",
                "intent_category": "analytics",
                "complexity": "complex",
                "needs_tools": True,
                "reason": "Cần SQL",
            },
        )
        ctx = result["context"]
        assert ctx["intent"] == "core_agent"
        assert ctx["route_decision"]["mode"] == "full_chat"
        assert ctx["route_decision"]["target_route"] == "/chatbot"
        assert route_after_router({"context": ctx}) == "core_agent"


# ── POST /api/v1/chat ───────────────────────────────────────────────────


class TestChatPostEndpoint:
    @pytest.mark.asyncio
    async def test_returns_full_chat_route_decision(self, client: AsyncClient, db_session: AsyncSession):
        context = _agent_context()
        async with _mock_chat_agent(db_session, _agent_result(context)):
            with patch(
                "app.api.v1.endpoints.chat.generate_title",
                new_callable=AsyncMock,
                return_value="Test chat",
            ):
                response = await client.post(
                    "/api/v1/chat",
                    json={
                        "message": "Top 5 môn trượt?",
                        "context": {"route": "/dashboard", "module": "dashboard"},
                    },
                )

        assert response.status_code == 200
        data = response.json()
        assert data["route_decision"]["mode"] == "full_chat"
        assert data["route_decision"]["target_route"] == "/chatbot"
        assert data["route_decision"]["preserve_context"] is True
        assert data["intent_category"] == "analytics"
        assert data["complexity"] == "complex"
        assert data["thread_id"]

    @pytest.mark.asyncio
    async def test_returns_inline_route_decision(self, client: AsyncClient, db_session: AsyncSession):
        context = _agent_context(
            graph_route="fast_response",
            intent_category="chitchat",
            complexity="simple",
            mode="inline",
            target_route="/tree",
            reason="Chào hỏi",
        )
        async with _mock_chat_agent(db_session, _agent_result(context, "Chào bạn!")):
            with patch(
                "app.api.v1.endpoints.chat.generate_title",
                new_callable=AsyncMock,
                return_value="Chào",
            ):
                response = await client.post(
                    "/api/v1/chat",
                    json={"message": "Xin chào", "context": {"route": "/tree", "module": "tree"}},
                )

        data = response.json()
        assert data["route_decision"]["mode"] == "inline"
        assert data["route_decision"]["target_route"] == "/tree"

    @pytest.mark.asyncio
    async def test_forbidden_module_returns_403(self, client: AsyncClient, db_session: AsyncSession):
        lecturer = User(
            id="lecturer-1",
            email="lecturer@example.com",
            hashed_password="x",
            full_name="Lecturer",
            role=UserRole.lecturer,
            department_id=1,
        )
        db_session.add(lecturer)
        await db_session.flush()

        from app.dependencies import create_access_token

        async with AsyncClient(transport=client._transport, base_url="http://test") as lecturer_client:
            lecturer_client.headers["Authorization"] = (
                f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
            )
            patch_local, patch_log = _chat_patches(db_session)
            with patch_local, patch_log:
                response = await lecturer_client.post(
                    "/api/v1/chat",
                    json={"message": "Xin chào", "context": {"module": "admin"}},
                )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_continues_existing_thread_and_preserves_session(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        existing = await _create_session(db_session)
        context = _agent_context(mode="inline", target_route="/dashboard", graph_route="fast_response")
        result_messages = [
            HumanMessage(content="Xin chào"),
            HumanMessage(content="Tiếp tục hội thoại"),
            AIMessage(content="Vâng ạ"),
        ]

        async with _mock_chat_agent(db_session, {"messages": result_messages, "context": context}):
            response = await client.post(
                "/api/v1/chat",
                json={
                    "message": "Tiếp tục hội thoại",
                    "thread_id": str(existing.id),
                    "context": {"route": "/dashboard", "module": "dashboard"},
                },
            )

        assert response.status_code == 200
        assert response.json()["thread_id"] == str(existing.id)

        refreshed = await db_session.get(ChatSession, existing.id)
        assert refreshed is not None
        assert len(refreshed.messages) == len(result_messages)


# ── POST /api/v1/chat/stream ────────────────────────────────────────────


class TestChatStreamEndpoint:
    @pytest.mark.asyncio
    async def test_emits_route_decision_sse_event(self, client: AsyncClient, db_session: AsyncSession):
        route_ctx = _agent_context(mode="full_chat")

        async def fake_astream_events(*_args: Any, **_kwargs: Any) -> AsyncIterator[dict[str, Any]]:
            yield {
                "event": "on_chain_end",
                "name": "router",
                "data": {"output": {"context": route_ctx}},
                "metadata": {},
            }
            yield {
                "event": "on_chain_end",
                "name": "LangGraph",
                "data": {"output": {"messages": [HumanMessage(content="Q"), AIMessage(content="A")]}},
                "metadata": {},
            }

        patch_local, patch_log = _chat_patches(db_session)
        with patch_local, patch_log, patch("app.api.v1.endpoints.chat._agent") as mock_agent:
            mock_agent.astream_events = fake_astream_events
            with patch(
                "app.api.v1.endpoints.chat.generate_title",
                new_callable=AsyncMock,
                return_value="Stream chat",
            ):
                events: list[dict[str, Any]] = []
                async with client.stream(
                    "POST",
                    "/api/v1/chat/stream",
                    json={"message": "Phân tích KPI", "context": {"route": "/dashboard", "module": "dashboard"}},
                ) as response:
                    assert response.status_code == 200
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            events.append(json.loads(line.removeprefix("data: ")))

        event_types = {event["type"] for event in events}
        assert "router" in event_types
        assert "route_decision" in event_types
        route_event = next(event for event in events if event["type"] == "route_decision")
        assert route_event["route_decision"]["mode"] == "full_chat"
        assert route_event["route_decision"]["target_route"] == "/chatbot"
        assert "done" in event_types


# ── Session CRUD routes ─────────────────────────────────────────────────


class TestChatSessionEndpoints:
    @pytest.mark.asyncio
    async def test_list_sessions(self, client: AsyncClient, db_session: AsyncSession):
        await _create_session(db_session, title="Alpha")
        await _create_session(db_session, title="Beta")

        response = await client.get("/api/v1/chat/sessions")
        assert response.status_code == 200
        titles = {item["title"] for item in response.json()}
        assert {"Alpha", "Beta"}.issubset(titles)

    @pytest.mark.asyncio
    async def test_get_session_history(self, client: AsyncClient, db_session: AsyncSession):
        session = await _create_session(db_session, title="History test")

        response = await client.get(f"/api/v1/chat/sessions/{session.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(session.id)
        assert data["title"] == "History test"
        assert len(data["messages"]) == 1

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, client: AsyncClient):
        response = await client.get(f"/api/v1/chat/sessions/{uuid.uuid4()}")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_session(self, client: AsyncClient, db_session: AsyncSession):
        session = await _create_session(db_session, title="To delete")

        response = await client.delete(f"/api/v1/chat/sessions/{session.id}")
        assert response.status_code == 204
        await db_session.flush()
        db_session.expire_all()
        assert await db_session.get(ChatSession, session.id) is None

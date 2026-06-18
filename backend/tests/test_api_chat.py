"""Integration tests for the chat endpoint."""

import uuid
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from httpx import AsyncClient

from app.models.chat import ChatSession


@pytest.fixture
def sample_chat_request():
    """Valid chat request payload."""
    return {
        "message": "Hello there",
        "context": {"intent": "fast_response"}
    }


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.chat._agent")
async def test_chat_success(mock_agent, client: AsyncClient, sample_chat_request):
    """POST /api/v1/chat returns 200 with mock agent response."""
    from langchain_core.messages import AIMessage
    mock_agent.ainvoke = AsyncMock(return_value={
        "messages": [AIMessage(content="Hi from mock agent")],
        "context": {"intent": "fast_response"}
    })

    response = await client.post("/api/v1/chat", json=sample_chat_request)
    assert response.status_code == 200
    data = response.json()
    assert data["response"] == "Hi from mock agent"
    assert "thread_id" in data


@pytest.mark.asyncio
async def test_chat_empty_message(client: AsyncClient):
    """Empty message is caught by Pydantic validation (422)."""
    response = await client.post("/api/v1/chat", json={"message": ""})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_missing_auth():
    """Unauthenticated request returns 401."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        response = await c.post("/api/v1/chat", json={"message": "Hello"})
        assert response.status_code == 401


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.chat._agent")
async def test_chat_llm_error(mock_agent, client: AsyncClient, sample_chat_request):
    """Agent exceptions are caught and return a 500 status gracefully."""
    mock_agent.ainvoke = AsyncMock(side_effect=Exception("LLM Timeout"))

    response = await client.post("/api/v1/chat", json=sample_chat_request)
    assert response.status_code == 500
    assert "Agent error" in response.json()["detail"]


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.chat._agent")
async def test_chat_get_sessions(mock_agent, client: AsyncClient, sample_chat_request):
    """Chat sessions can be listed and retrieved."""
    # First, create a session
    from langchain_core.messages import AIMessage
    mock_agent.ainvoke = AsyncMock(return_value={
        "messages": [AIMessage(content="Hi")],
        "context": {}
    })
    
    chat_res = await client.post("/api/v1/chat", json=sample_chat_request)
    thread_id = chat_res.json()["thread_id"]
    
    # List sessions
    list_res = await client.get("/api/v1/chat/sessions")
    assert list_res.status_code == 200
    sessions = list_res.json()
    assert len(sessions) > 0
    assert any(s["id"] == thread_id for s in sessions)
    
    # Get specific session
    get_res = await client.get(f"/api/v1/chat/sessions/{thread_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == thread_id

"""Unit tests for agent nodes."""

from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from app.agent.nodes import (
    _sanitize_response,
    fast_response_node,
    route_after_router,
    router_node,
)


def test_route_after_router_core_agent():
    """Returns core_agent when intent is core_agent."""
    state = {"context": {"intent": "core_agent"}}
    assert route_after_router(state) == "core_agent"


def test_route_after_router_fast_response():
    """Returns fast_response when intent is fast_response."""
    state = {"context": {"intent": "fast_response"}}
    assert route_after_router(state) == "fast_response"


def test_route_after_router_default():
    """Returns fast_response by default if no intent is set."""
    state = {"context": {}}
    assert route_after_router(state) == "fast_response"


def test_sanitize_response_removes_sql():
    """Replaces SQL queries and schema references with [dữ liệu hệ thống]."""
    text = "SELECT * FROM students WHERE id = 1"
    sanitized = _sanitize_response(text)
    assert "SELECT" not in sanitized
    assert "[dữ liệu hệ thống]" in sanitized


def test_sanitize_response_preserves_normal_text():
    """Normal conversational text is not modified."""
    text = "Xin chào, tôi là trợ lý ảo EduInsight. Tôi có thể giúp gì cho bạn?"
    assert _sanitize_response(text) == text


@pytest.mark.asyncio
@patch("app.agent.nodes.get_model")
async def test_router_node_empty_messages(mock_get_model):
    """Returns error if messages are empty."""
    mock_get_model.return_value = MagicMock()
    state = {"messages": []}
    result = await router_node(state)
    assert "error" in result
    assert result["error"] == "No messages found"


@pytest.mark.asyncio
@patch("app.agent.nodes.get_model")
async def test_router_node_classifies_intent(mock_get_model):
    """Router correctly uses LLM to classify intent."""
    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="core_agent"))
    mock_get_model.return_value = mock_llm

    state = {"messages": [HumanMessage(content="Điểm của tôi môn Toán là bao nhiêu?")]}
    result = await router_node(state)
    
    assert "context" in result
    assert result["context"]["intent"] == "core_agent"


@pytest.mark.asyncio
@patch("app.agent.nodes.ChatOpenAI")
async def test_fast_response_node_fallback(mock_chat_openai):
    """Returns static fallback if LLM call fails."""
    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(side_effect=Exception("LLM Timeout"))
    mock_chat_openai.return_value = mock_llm

    state = {"messages": [HumanMessage(content="Hello")]}
    result = await fast_response_node(state)
    
    assert "messages" in result
    assert isinstance(result["messages"][0], AIMessage)
    assert "EduInsight" in result["messages"][0].content  # Fallback contains the system prompt

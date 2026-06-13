"""Chat endpoint — invoke the LangGraph Agent via REST API.

POST /api/v1/chat
  Request:  {"message": str, "context": dict (optional)}
  Response: {"response": str, "tool_calls": list, "intent": str}
"""

import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException, status
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from pydantic import BaseModel, Field

from app.agent import create_agent

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Singleton agent (created once at import time) ──────────────────────
_agent = create_agent()


# ── Request / Response schemas ─────────────────────────────────────────
class ChatRequest(BaseModel):
    """Incoming chat message from the frontend."""

    message: str = Field(..., min_length=1, max_length=2000, description="Câu hỏi của người dùng")
    context: dict[str, Any] = Field(default_factory=dict, description="UI context (department, program đang xem)")


class ToolCallInfo(BaseModel):
    """Summary of a tool call made during agent execution."""

    tool_name: str
    tool_input: dict[str, Any]
    tool_output: str


class ChatResponse(BaseModel):
    """Agent response returned to the frontend."""

    response: str = Field(..., description="Câu trả lời cuối cùng của agent")
    intent: str = Field(default="unknown", description="Intent phân loại bởi Router (core_agent | fast_response)")
    tool_calls: list[ToolCallInfo] = Field(default_factory=list, description="Các tool calls đã thực hiện")
    latency_ms: int = Field(default=0, description="Thời gian xử lý (ms)")


# ── Endpoint ───────────────────────────────────────────────────────────
@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    """Invoke the EduInsight LangGraph agent and return the result.

    The agent will:
    1. Route the query (fast_response or core_agent)
    2. If core_agent: reason, call sql_query_tool, synthesize answer
    3. Return the final response with metadata
    """
    start = time.perf_counter()

    try:
        result = await _agent.ainvoke({
            "messages": [HumanMessage(content=payload.message)],
            "context": payload.context,
        })
    except Exception as exc:
        logger.exception("Agent invocation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent error: {exc}",
        ) from exc

    # ── Extract response, intent, and tool call metadata ───────────
    messages = result.get("messages", [])
    context = result.get("context", {})
    intent = context.get("intent", "unknown")

    # Final response = last AIMessage content
    final_response = ""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content:
            final_response = msg.content
            break

    # Collect tool calls for transparency
    tool_calls_info: list[ToolCallInfo] = []
    for i, msg in enumerate(messages):
        if isinstance(msg, AIMessage) and hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                # Find the corresponding ToolMessage
                tool_output = ""
                if i + 1 < len(messages) and isinstance(messages[i + 1], ToolMessage):
                    tool_output = messages[i + 1].content[:500]  # cap for response size

                tool_calls_info.append(ToolCallInfo(
                    tool_name=tc.get("name", "unknown"),
                    tool_input=tc.get("args", {}),
                    tool_output=tool_output,
                ))

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    return ChatResponse(
        response=final_response,
        intent=intent,
        tool_calls=tool_calls_info,
        latency_ms=elapsed_ms,
    )

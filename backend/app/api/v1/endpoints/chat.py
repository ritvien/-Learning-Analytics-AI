"""Chat endpoint — invoke the LangGraph Agent via REST API.

POST /api/v1/chat
POST /api/v1/chat/stream
GET /api/v1/chat/sessions
GET /api/v1/chat/sessions/{thread_id}
DELETE /api/v1/chat/sessions/{thread_id}
"""

import json
import logging
import time
import uuid
import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage, messages_from_dict, messages_to_dict
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_openai import ChatOpenAI

from app.agent import create_agent
from app.database import get_db, AsyncSessionLocal
from app.models.chat import ChatSession
from app.dependencies import get_current_user
from app.models.people import User

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Singleton agent (created once at import time) ──────────────────────
_agent = create_agent()


# ── Request / Response schemas ─────────────────────────────────────────
class ChatRequest(BaseModel):
    """Incoming chat message from the frontend."""
    message: str = Field(..., min_length=1, max_length=2000, description="Câu hỏi của người dùng")
    context: dict[str, Any] = Field(default_factory=dict, description="UI context")
    thread_id: str | None = Field(default=None, description="ID của session chat. Nếu None sẽ tạo mới.")


class ToolCallInfo(BaseModel):
    tool_name: str
    tool_input: dict[str, Any]
    tool_output: str


class ChatResponse(BaseModel):
    response: str
    intent: str = "unknown"
    tool_calls: list[ToolCallInfo] = Field(default_factory=list)
    latency_ms: int = 0
    thread_id: str | None = None


class SessionSummaryResponse(BaseModel):
    id: str
    title: str
    updated_at: str

    class Config:
        from_attributes = True


# ── Helper to generate title ───────────────────────────────────────────
async def generate_title(message: str) -> str:
    """Sử dụng LLM nhỏ để summarize title cho cuộc hội thoại mới."""
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3, max_tokens=20)
        prompt = f"Viết tiêu đề thật ngắn gọn (tối đa 5-6 từ) tóm tắt nội dung câu hỏi sau. Không dùng ngoặc kép, không giải thích:\n\n{message}"
        res = await llm.ainvoke(prompt)
        return res.content.strip().strip('"').strip("'")
    except Exception:
        # Fallback if LLM fails
        return message[:30] + "..." if len(message) > 30 else message


# ── Endpoints ───────────────────────────────────────────────────────────

@router.get("/sessions", response_model=list[SessionSummaryResponse])
async def get_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách các session chat cũ của user."""
    stmt = select(ChatSession).where(ChatSession.user_id == current_user.id).order_by(ChatSession.updated_at.desc())
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return [
        SessionSummaryResponse(
            id=str(s.id), 
            title=s.title, 
            updated_at=s.updated_at.isoformat()
        ) for s in sessions
    ]


@router.get("/sessions/{thread_id}")
async def get_session_history(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Load lại nội dung của 1 session cụ thể."""
    try:
        session_id = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread_id format")

    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"id": str(session.id), "title": session.title, "messages": session.messages}


@router.delete("/sessions/{thread_id}", status_code=204)
async def delete_session(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xoá một session."""
    try:
        session_id = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread_id format")

    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.delete(session)
    return None


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    """Invoke the EduInsight LangGraph agent and return the result."""
    start = time.perf_counter()

    async with AsyncSessionLocal() as db:
        history_msgs = []
        db_session = None

        if payload.thread_id:
            db_session = await db.get(ChatSession, uuid.UUID(payload.thread_id))
            if db_session and db_session.user_id == current_user.id:
                history_msgs = messages_from_dict(db_session.messages)
            else:
                raise HTTPException(status_code=404, detail="Session not found")
        else:
            # Generate title and create session
            title = await generate_title(payload.message)
            db_session = ChatSession(
                user_id=current_user.id,
                title=title,
                messages=[]
            )
            db.add(db_session)
            await db.commit()
            await db.refresh(db_session)

        input_messages = history_msgs + [HumanMessage(content=payload.message)]

        try:
            result = await _agent.ainvoke({
                "messages": input_messages,
                "context": payload.context,
            })
        except Exception as exc:
            logger.exception("Agent invocation failed")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Agent error: {exc}") from exc

        # Lấy thông tin
        messages = result.get("messages", [])
        context = result.get("context", {})
        intent = context.get("intent", "unknown")

        final_response = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.content:
                final_response = msg.content
                break

        tool_calls_info: list[ToolCallInfo] = []
        for i, msg in enumerate(messages):
            if isinstance(msg, AIMessage) and hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_output = ""
                    if i + 1 < len(messages) and isinstance(messages[i + 1], ToolMessage):
                        tool_output = messages[i + 1].content[:500]
                    tool_calls_info.append(ToolCallInfo(
                        tool_name=tc.get("name", "unknown"),
                        tool_input=tc.get("args", {}),
                        tool_output=tool_output,
                    ))

        # Lưu lại messages vào DB
        db_session.messages = messages_to_dict(messages)
        await db.commit()

        elapsed_ms = int((time.perf_counter() - start) * 1000)

        return ChatResponse(
            response=final_response,
            intent=intent,
            tool_calls=tool_calls_info,
            latency_ms=elapsed_ms,
            thread_id=str(db_session.id)
        )


@router.post("/stream")
async def chat_stream(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Invoke the agent and stream the response via SSE."""
    
    async def event_generator():
        start = time.perf_counter()
        
        async with AsyncSessionLocal() as db:
            history_msgs = []
            db_session = None

            if payload.thread_id:
                try:
                    db_session = await db.get(ChatSession, uuid.UUID(payload.thread_id))
                except ValueError:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Invalid thread_id'})}\n\n"
                    return

                if db_session and db_session.user_id == current_user.id:
                    history_msgs = messages_from_dict(db_session.messages)
                else:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                    return
            else:
                # Generate title and create session
                title = await generate_title(payload.message)
                db_session = ChatSession(
                    user_id=current_user.id,
                    title=title,
                    messages=[]
                )
                db.add(db_session)
                await db.commit()
                await db.refresh(db_session)
                
                # Báo cho frontend biết session ID vừa được tạo
                yield f"data: {json.dumps({'type': 'session_created', 'thread_id': str(db_session.id), 'title': title})}\n\n"

            input_messages = history_msgs + [HumanMessage(content=payload.message)]
            final_state_messages = []

            try:
                async for event in _agent.astream_events(
                    {
                        "messages": input_messages,
                        "context": payload.context
                    },
                    version="v2",
                ):
                    kind = event["event"]
                    name = event["name"]
                    node_name = event.get("metadata", {}).get("langgraph_node")

                    if kind == "on_chain_end" and name == "router":
                        output = event["data"].get("output", {})
                        if isinstance(output, dict):
                            intent = output.get("context", {}).get("intent", "unknown")
                            yield f"data: {json.dumps({'type': 'router', 'intent': intent})}\n\n"

                    elif kind == "on_tool_start":
                        yield f"data: {json.dumps({'type': 'tool_call', 'tool': name, 'input': event['data'].get('input')})}\n\n"

                    elif kind == "on_tool_end":
                        output = event['data'].get('output')
                        output_str = str(output)[:500] if output else ""
                        yield f"data: {json.dumps({'type': 'tool_result', 'output': output_str})}\n\n"

                    elif kind == "on_chat_model_stream":
                        if node_name in ("core_agent", "fast_response"):
                            chunk = event["data"]["chunk"]
                            if hasattr(chunk, "content") and chunk.content and isinstance(chunk.content, str):
                                yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"
                                await asyncio.sleep(0)  # force flush
                    
                    elif kind == "on_chain_end" and name == "LangGraph": # The top level graph
                        final_state = event["data"].get("output", {})
                        if isinstance(final_state, dict) and "messages" in final_state:
                            final_state_messages = final_state["messages"]

                elapsed_ms = int((time.perf_counter() - start) * 1000)
                yield f"data: {json.dumps({'type': 'done', 'latency_ms': elapsed_ms, 'thread_id': str(db_session.id)})}\n\n"
                
                # Update DB after streaming finishes
                if final_state_messages:
                    db_session.messages = messages_to_dict(final_state_messages)
                    await db.commit()

            except Exception as exc:
                logger.exception("Agent stream failed")
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

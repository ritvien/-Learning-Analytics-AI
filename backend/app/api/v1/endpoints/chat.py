"""Chat endpoint — invoke the LangGraph Agent via REST API.

POST /api/v1/chat
POST /api/v1/chat/stream
GET /api/v1/chat/sessions
GET /api/v1/chat/sessions/{thread_id}
DELETE /api/v1/chat/sessions/{thread_id}
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage, messages_from_dict, messages_to_dict
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent import create_agent
from app.agent.context_rbac import validate_and_merge_context
from app.agent.errors import (
    MissingLLMCredentialsError,
    map_agent_exception_to_http,
    stream_error_message,
)
from app.agent.route_decision import RouteDecision
from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.dependencies import get_current_user
from app.models.chat import ChatSession
from app.models.people import User
from app.observability import log_event, new_id, request_context, stable_hash

logger = logging.getLogger(__name__)
router = APIRouter()
_settings = get_settings()

# ── Singleton agent (created once at import time) ──────────────────────
_agent = create_agent()


def _is_development() -> bool:
    return _settings.app_env.lower().strip() in {"development", "dev", "debug"}


def _merge_client_context(request: Request, client_context: dict[str, Any] | None) -> dict[str, Any]:
    """Merge observability header context; JSON body fields take precedence."""
    merged = dict(client_context or {})
    header_context = getattr(request.state, "page_context", None) or {}
    for key, value in header_context.items():
        if key not in merged and value is not None:
            merged[key] = value
    return merged


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
    intent_category: str | None = None
    complexity: str | None = None
    route_decision: RouteDecision | None = None
    tool_calls: list[ToolCallInfo] = Field(default_factory=list)
    latency_ms: int = 0
    thread_id: str | None = None


class SessionSummaryResponse(BaseModel):
    """Summary row for a stored chat session."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    updated_at: str


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
        raise HTTPException(status_code=400, detail="Invalid thread_id format") from None

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
        raise HTTPException(status_code=400, detail="Invalid thread_id format") from None

    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.delete(session)
    return None


@router.post("", response_model=ChatResponse)
async def chat(
    request: Request,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    """Invoke the EduInsight LangGraph agent and return the result."""
    start = time.perf_counter()
    obs_context = request_context(request)
    agent_run_id = new_id()
    merged_context = validate_and_merge_context(current_user, _merge_client_context(request, payload.context))

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

        await log_event(
            "chat_message_submitted",
            user_id=str(current_user.id),
            user_role=current_user.role.value,
            department_id=current_user.department_id,
            conversation_id=str(db_session.id),
            agent_run_id=agent_run_id,
            status="started",
            payload={
                "prompt_hash": stable_hash(payload.message),
                "prompt_length": len(payload.message),
                "context_keys": sorted(payload.context.keys()),
            },
            **obs_context,
        )
        await log_event(
            "agent_run_started",
            user_id=str(current_user.id),
            user_role=current_user.role.value,
            department_id=current_user.department_id,
            conversation_id=str(db_session.id),
            agent_run_id=agent_run_id,
            status="started",
            payload={"mode": "standard"},
            **obs_context,
        )

        input_messages = history_msgs + [HumanMessage(content=payload.message)]

        try:
            result = await _agent.ainvoke({
                "messages": input_messages,
                "context": merged_context,
            })
        except MissingLLMCredentialsError as exc:
            logger.warning("Agent invocation blocked by missing LLM credentials")
            status_code, detail = map_agent_exception_to_http(
                exc, is_development=_is_development()
            )
            await log_event(
                "agent_run_failed",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                conversation_id=str(db_session.id),
                agent_run_id=agent_run_id,
                status="error",
                duration_ms=int((time.perf_counter() - start) * 1000),
                error_code="MissingLLMCredentialsError",
                payload={"mode": "standard"},
                **obs_context,
            )
            raise HTTPException(status_code=status_code, detail=detail) from exc
        except Exception as exc:
            logger.exception("Agent invocation failed")
            status_code, detail = map_agent_exception_to_http(
                exc, is_development=_is_development()
            )
            await log_event(
                "agent_run_failed",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                conversation_id=str(db_session.id),
                agent_run_id=agent_run_id,
                status="error",
                duration_ms=int((time.perf_counter() - start) * 1000),
                error_code=exc.__class__.__name__,
                payload={"mode": "standard"},
                **obs_context,
            )
            raise HTTPException(status_code=status_code, detail=detail) from exc

        # Lấy thông tin
        messages = result.get("messages", [])
        context = result.get("context", {})
        intent = context.get("intent", "unknown")
        intent_category = context.get("intent_category")
        complexity = context.get("complexity")
        route_decision_raw = context.get("route_decision")
        route_decision = RouteDecision.model_validate(route_decision_raw) if route_decision_raw else None

        if route_decision is not None:
            await log_event(
                "route_decision",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                conversation_id=str(db_session.id),
                agent_run_id=agent_run_id,
                status="ok",
                payload={
                    "mode": route_decision.mode,
                    "target_route": route_decision.target_route,
                    "reason": route_decision.reason,
                    "intent": intent,
                    "preserve_context": route_decision.preserve_context,
                },
                **obs_context,
            )

        final_response = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.content:
                final_response = msg.content
                break

        tool_calls_info: list[ToolCallInfo] = []
        for i, msg in enumerate(messages):
            if isinstance(msg, AIMessage) and hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_call_id = new_id()
                    tool_output = ""
                    if i + 1 < len(messages) and isinstance(messages[i + 1], ToolMessage):
                        tool_output = messages[i + 1].content[:500]
                    tool_calls_info.append(ToolCallInfo(
                        tool_name=tc.get("name", "unknown"),
                        tool_input=tc.get("args", {}),
                        tool_output=tool_output,
                    ))
                    await log_event(
                        "tool_call_completed",
                        user_id=str(current_user.id),
                        user_role=current_user.role.value,
                        department_id=current_user.department_id,
                        conversation_id=str(db_session.id),
                        agent_run_id=agent_run_id,
                        tool_call_id=tool_call_id,
                        status="ok",
                        payload={
                            "tool_name": tc.get("name", "unknown"),
                            "input_keys": sorted((tc.get("args") or {}).keys()),
                            "output_length": len(tool_output),
                        },
                        **obs_context,
                    )

        # Lưu lại messages vào DB
        db_session.messages = messages_to_dict(messages)
        await db.commit()

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        await log_event(
            "agent_run_completed",
            user_id=str(current_user.id),
            user_role=current_user.role.value,
            department_id=current_user.department_id,
            conversation_id=str(db_session.id),
            agent_run_id=agent_run_id,
            status="ok",
            duration_ms=elapsed_ms,
            payload={
                "mode": "standard",
                "intent": intent,
                "tool_count": len(tool_calls_info),
                "response_length": len(final_response),
            },
            **obs_context,
        )

        return ChatResponse(
            response=final_response,
            intent=intent,
            intent_category=intent_category,
            complexity=complexity,
            route_decision=route_decision,
            tool_calls=tool_calls_info,
            latency_ms=elapsed_ms,
            thread_id=str(db_session.id)
        )

@router.post("/stream")
async def chat_stream(
    request: Request,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Invoke the agent and stream the response via SSE."""
    obs_context = request_context(request)
    agent_run_id = new_id()
    merged_context = validate_and_merge_context(current_user, _merge_client_context(request, payload.context))

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

            await log_event(
                "chat_message_submitted",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                conversation_id=str(db_session.id),
                agent_run_id=agent_run_id,
                status="started",
                payload={
                    "prompt_hash": stable_hash(payload.message),
                    "prompt_length": len(payload.message),
                    "context_keys": sorted(payload.context.keys()),
                    "mode": "stream",
                },
                **obs_context,
            )
            await log_event(
                "agent_run_started",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                conversation_id=str(db_session.id),
                agent_run_id=agent_run_id,
                status="started",
                payload={"mode": "stream"},
                **obs_context,
            )

            input_messages = history_msgs + [HumanMessage(content=payload.message)]
            final_state_messages = []
            tool_call_ids: dict[str, str] = {}
            tool_count = 0

            try:
                async for event in _agent.astream_events(
                    {
                        "messages": input_messages,
                        "context": merged_context,
                    },
                    version="v2",
                ):
                    kind = event["event"]
                    name = event["name"]
                    node_name = event.get("metadata", {}).get("langgraph_node")

                    if kind == "on_chain_end" and name == "router":
                        output = event["data"].get("output", {})
                        if isinstance(output, dict):
                            ctx = output.get("context", {})
                            intent = ctx.get("intent", "unknown")
                            router_payload = {
                                "type": "router",
                                "intent": intent,
                                "intent_category": ctx.get("intent_category"),
                                "complexity": ctx.get("complexity"),
                            }
                            yield f"data: {json.dumps(router_payload)}\n\n"
                            if ctx.get("route_decision"):
                                rd = ctx["route_decision"]
                                await log_event(
                                    "route_decision",
                                    user_id=str(current_user.id),
                                    user_role=current_user.role.value,
                                    department_id=current_user.department_id,
                                    conversation_id=str(db_session.id),
                                    agent_run_id=agent_run_id,
                                    status="ok",
                                    payload={
                                        "mode": rd.get("mode"),
                                        "target_route": rd.get("target_route"),
                                        "reason": rd.get("reason"),
                                        "intent": intent,
                                        "preserve_context": rd.get("preserve_context"),
                                    },
                                    **obs_context,
                                )
                                route_payload = {
                                    "type": "route_decision",
                                    "route_decision": rd,
                                }
                                yield f"data: {json.dumps(route_payload)}\n\n"

                    elif kind == "on_tool_start":
                        tool_call_id = new_id()
                        tool_call_ids[name] = tool_call_id
                        tool_count += 1
                        await log_event(
                            "tool_call_started",
                            user_id=str(current_user.id),
                            user_role=current_user.role.value,
                            department_id=current_user.department_id,
                            conversation_id=str(db_session.id),
                            agent_run_id=agent_run_id,
                            tool_call_id=tool_call_id,
                            status="started",
                            payload={
                                "tool_name": name,
                                "input_keys": sorted((event["data"].get("input") or {}).keys())
                                if isinstance(event["data"].get("input"), dict)
                                else [],
                            },
                            **obs_context,
                        )
                        yield f"data: {json.dumps({'type': 'tool_call', 'tool': name, 'input': event['data'].get('input')})}\n\n"

                    elif kind == "on_tool_end":
                        output = event['data'].get('output')
                        output_str = str(output)[:500] if output else ""
                        await log_event(
                            "tool_call_completed",
                            user_id=str(current_user.id),
                            user_role=current_user.role.value,
                            department_id=current_user.department_id,
                            conversation_id=str(db_session.id),
                            agent_run_id=agent_run_id,
                            tool_call_id=tool_call_ids.get(name),
                            status="ok",
                            payload={
                                "tool_name": name,
                                "output_length": len(output_str),
                            },
                            **obs_context,
                        )
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
                await log_event(
                    "agent_run_completed",
                    user_id=str(current_user.id),
                    user_role=current_user.role.value,
                    department_id=current_user.department_id,
                    conversation_id=str(db_session.id),
                    agent_run_id=agent_run_id,
                    status="ok",
                    duration_ms=elapsed_ms,
                    payload={"mode": "stream", "tool_count": tool_count},
                    **obs_context,
                )
                yield f"data: {json.dumps({'type': 'done', 'latency_ms': elapsed_ms, 'thread_id': str(db_session.id)})}\n\n"
                
                # Update DB after streaming finishes
                if final_state_messages:
                    db_session.messages = messages_to_dict(final_state_messages)
                    await db.commit()

            except MissingLLMCredentialsError as exc:
                logger.warning("Agent stream blocked by missing LLM credentials")
                await log_event(
                    "agent_run_failed",
                    user_id=str(current_user.id),
                    user_role=current_user.role.value,
                    department_id=current_user.department_id,
                    conversation_id=str(db_session.id) if db_session else None,
                    agent_run_id=agent_run_id,
                    status="error",
                    duration_ms=int((time.perf_counter() - start) * 1000),
                    error_code="MissingLLMCredentialsError",
                    payload={"mode": "stream"},
                    **obs_context,
                )
                message = stream_error_message(exc, is_development=_is_development())
                yield f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"
            except Exception as exc:
                logger.exception("Agent stream failed")
                await log_event(
                    "agent_run_failed",
                    user_id=str(current_user.id),
                    user_role=current_user.role.value,
                    department_id=current_user.department_id,
                    conversation_id=str(db_session.id) if db_session else None,
                    agent_run_id=agent_run_id,
                    status="error",
                    duration_ms=int((time.perf_counter() - start) * 1000),
                    error_code=exc.__class__.__name__,
                    payload={"mode": "stream"},
                    **obs_context,
                )
                message = stream_error_message(exc, is_development=_is_development())
                yield f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

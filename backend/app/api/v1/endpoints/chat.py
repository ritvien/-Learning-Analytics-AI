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
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage, messages_from_dict, messages_to_dict
from langchain_core.runnables import RunnableConfig
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
from app.agent.guardrails import build_refusal, classify_input
from app.agent.memory import (
    build_deterministic_summary,
    build_memory_context_note,
    compact_history_for_agent,
    extract_academic_focus,
    extract_user_preferences,
    load_long_term_memories,
    save_long_term_memory,
)
from app.agent.nodes import get_model
from app.agent.prompts import get_universal_agent_prompt_manifest
from app.agent.route_decision import RouteDecision
from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.dependencies import get_current_user
from app.eval.token_accumulator import AgentRunMetrics, reset_run_metrics, set_run_metrics
from app.models.chat import ChatSession
from app.models.people import User
from app.observability import log_event, new_id, request_context, stable_hash

logger = logging.getLogger(__name__)
router = APIRouter()
_settings = get_settings()

# ── Singleton agent (created once at import time) ──────────────────────
_agent = create_agent()

# ── H67: in-process concurrency limiter (ADR-0011) ─────────────────────
# Render Free runs a single uvicorn worker; the semaphore bounds concurrent
# LangGraph runs so parallel chats cannot exhaust RAM or the shared LLM quota.
# Only valid while WORKERS=1 — multi-worker/multi-instance needs ADR-0011 layer 3.
_AGENT_SEMAPHORE = asyncio.Semaphore(_settings.max_concurrent_agent_runs)

SERVER_BUSY_MESSAGE = (
    "Server đang bận xử lý nhiều yêu cầu cùng lúc. Vui lòng thử lại sau ít phút."
)
AGENT_TIMEOUT_MESSAGE = (
    "Yêu cầu xử lý quá lâu và đã bị dừng. Vui lòng thử lại hoặc chia nhỏ câu hỏi."
)
SERVER_BUSY_RETRY_AFTER_SECONDS = 10

# Max chars of each tool output echoed back in API responses/SSE events.
# Eval scorers verify citations and number grounding against this capture,
# so it must be long enough to keep RAG citation metadata and result rows.
TOOL_OUTPUT_CAPTURE_MAX_CHARS = 4000


class AgentBusyError(Exception):
    """All agent slots are taken; the request is rejected instead of queued."""


@asynccontextmanager
async def _agent_slot() -> AsyncIterator[None]:
    """Reserve one agent-run slot or raise AgentBusyError immediately.

    The locked() check and the acquire() fast path both run without
    suspending, so within the single event loop a rejected request can never
    end up queued behind running agent invocations.
    """
    if _AGENT_SEMAPHORE.locked():
        raise AgentBusyError()
    await _AGENT_SEMAPHORE.acquire()
    try:
        yield
    finally:
        _AGENT_SEMAPHORE.release()


async def _with_run_timeout(agent_stream: AsyncIterator[Any]) -> AsyncIterator[Any]:
    """Apply the H67 total run deadline across an agent event stream.

    The Vercel proxy caps requests at 120s but the backend kept the agent
    running past that; this enforces the deadline server-side so a hung run
    releases its slot instead of holding it open.
    """
    async with asyncio.timeout(_settings.agent_run_timeout_seconds):
        async for item in agent_stream:
            yield item


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


def _build_langsmith_config(
    *,
    run_name: str,
    mode: str,
    agent_run_id: str,
    conversation_id: str,
    user_role: str,
    obs_context: dict[str, Any],
) -> RunnableConfig:
    """Build a LangChain RunnableConfig with LangSmith metadata.

    When ``LANGSMITH_TRACING=true``, LangChain SDK automatically sends
    this metadata to the configured LangSmith project.
    """
    manifest = get_universal_agent_prompt_manifest()
    prompt_versions = {
        entry["name"]: f"{entry['version']}:{entry['checksum'][:12]}"
        for entry in manifest
    }
    return RunnableConfig(
        run_name=run_name,
        tags=["h59", "eduinsight", mode],
        metadata={
            "trace_id": obs_context.get("trace_id", ""),
            "request_id": obs_context.get("request_id", ""),
            "agent_run_id": agent_run_id,
            "conversation_id": conversation_id,
            "user_role": user_role,
            "route": f"/api/v1/chat{'/stream' if mode == 'stream' else ''}",
            "prompt_versions": prompt_versions,
        },
    )


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
    duration_ms: int | None = None
    sequence: int | None = None


class UsageInfo(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    by_step: list[dict[str, Any]] = Field(default_factory=list)


class LatencyBreakdown(BaseModel):
    router_ms: int = 0
    core_ms: int = 0
    fast_ms: int = 0
    llm_ms: int = 0
    tools_ms: int = 0
    tools: list[dict[str, Any]] = Field(default_factory=list)
    overhead_ms: int = 0
    total_ms: int = 0


class ChatResponse(BaseModel):
    response: str
    intent: str = "unknown"
    intent_category: str | None = None
    complexity: str | None = None
    route_decision: RouteDecision | None = None
    tool_calls: list[ToolCallInfo] = Field(default_factory=list)
    latency_ms: int = 0
    thread_id: str | None = None
    usage: UsageInfo | None = None
    latency_breakdown: LatencyBreakdown | None = None


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
        llm = get_model(_settings.chat_title_model, temperature=0.3).bind(max_tokens=20)
        prompt = f"Viết tiêu đề thật ngắn gọn (tối đa 5-6 từ) tóm tắt nội dung câu hỏi sau. Không dùng ngoặc kép, không giải thích:\n\n{message}"
        res = await llm.ainvoke(
            prompt,
            config=RunnableConfig(
                run_name="chat-title-generation",
                tags=["eduinsight", "title generation"],
                metadata={
                    "component": "chat_title",
                    "trace_kind": "title_generation",
                    "model_role": "title_generation",
                },
            ),
        )
        return res.content.strip().strip('"').strip("'")
    except Exception:
        # Fallback if LLM fails
        return message[:30] + "..." if len(message) > 30 else message


def _guardrail_refusal(message: str) -> str | None:
    """Return a canned refusal when input guardrails block the request."""
    decision = classify_input(message)
    if decision == "ok":
        return None
    return build_refusal(decision)


_GUARDRAIL_REFUSAL_TEXTS = {
    build_refusal(kind)
    for kind in ("injection", "out_of_domain", "unsafe", "privacy")
}


def _is_guardrail_refusal_text(content: Any) -> bool:
    return str(content).strip() in _GUARDRAIL_REFUSAL_TEXTS


def _history_for_agent(messages: list[Any]) -> list[Any]:
    """Return chat history safe to pass back into the agent.

    Blocked turns remain persisted for UI/audit, but they must not become
    context for later safe questions.
    """
    safe_messages: list[Any] = []
    skip_block_refusal = False
    for message in messages:
        if isinstance(message, HumanMessage) and _guardrail_refusal(str(message.content)):
            skip_block_refusal = True
            continue
        if isinstance(message, AIMessage) and (
            skip_block_refusal or _is_guardrail_refusal_text(message.content)
        ):
            skip_block_refusal = False
            continue
        if skip_block_refusal and not isinstance(message, HumanMessage):
            continue
        if isinstance(message, HumanMessage):
            skip_block_refusal = False
        safe_messages.append(message)
    return safe_messages


def _merge_persisted_history(
    prior_history: list[Any],
    user_message: HumanMessage,
    input_messages: list[Any],
    graph_output_messages: list[Any],
) -> list[Any]:
    """Merge full DB history with only the new turn additions from the graph.

    The graph runs on a compacted subset (``input_messages`` = summary marker +
    last N safe turns + current user turn). Its output is ``input_messages`` plus
    any AI/tool messages the graph appended. Persisting the raw graph output
    would silently drop older turns that were compacted away. Instead we take
    only the tail the graph appended and concatenate onto the untouched prior
    history plus the current user message.
    """
    delta_start = min(len(input_messages), len(graph_output_messages))
    new_turn_additions = list(graph_output_messages[delta_start:])
    return list(prior_history) + [user_message] + new_turn_additions


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
        refusal = _guardrail_refusal(payload.message)

        if payload.thread_id:
            db_session = await db.get(ChatSession, uuid.UUID(payload.thread_id))
            if db_session and db_session.user_id == current_user.id:
                history_msgs = messages_from_dict(db_session.messages)
            else:
                raise HTTPException(status_code=404, detail="Session not found")
        else:
            # Generate title and create session
            title = "Yêu cầu bị chặn" if refusal else await generate_title(payload.message)
            db_session = ChatSession(
                user_id=current_user.id,
                title=title,
                messages=[]
            )
            db.add(db_session)
            await db.commit()
            await db.refresh(db_session)

        if refusal:
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            await log_event(
                "chat_message_submitted",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                conversation_id=str(db_session.id),
                agent_run_id=agent_run_id,
                status="blocked",
                payload={
                    "prompt_hash": stable_hash(payload.message),
                    "guardrail": classify_input(payload.message),
                },
                **obs_context,
            )
            await log_event(
                "guardrail_triggered",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                conversation_id=str(db_session.id),
                agent_run_id=agent_run_id,
                status="blocked",
                payload={"decision": classify_input(payload.message)},
                **obs_context,
            )
            blocked_messages = history_msgs + [
                HumanMessage(content=payload.message),
                AIMessage(content=refusal),
            ]
            db_session.messages = messages_to_dict(blocked_messages)
            await db.commit()
            return ChatResponse(
                response=refusal,
                intent="core_agent",
                latency_ms=elapsed_ms,
                thread_id=str(db_session.id),
            )

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

        # H64: compact history + load memory context
        user_turn = HumanMessage(content=payload.message)
        all_safe = _history_for_agent(history_msgs) + [user_turn]
        input_messages = compact_history_for_agent(
            all_safe, db_session.short_summary,
        )

        # Persist the user turn eagerly so an aborted/failed agent run still
        # keeps a record of what the user asked (crucial for handoff flows and
        # observability). The final commit below overwrites this with the full
        # merged history once the agent completes.
        db_session.messages = messages_to_dict(list(history_msgs) + [user_turn])
        await db.commit()

        try:
            lt_memories = await load_long_term_memories(db, str(current_user.id))
        except Exception:
            logger.warning("Failed to load long-term memories", exc_info=True)
            lt_memories = []
        memory_note = build_memory_context_note(db_session.short_summary, lt_memories)
        if memory_note:
            merged_context["memory_summary"] = memory_note

        # H59: build LangSmith tracing config (prompt versions seeded at startup)
        langsmith_config = _build_langsmith_config(
            run_name="eduinsight-chat",
            mode="standard",
            agent_run_id=agent_run_id,
            conversation_id=str(db_session.id),
            user_role=current_user.role.value,
            obs_context=obs_context,
        )

        run_metrics = AgentRunMetrics()
        metrics_token = set_run_metrics(run_metrics)
        try:
            async with _agent_slot():
                result = await asyncio.wait_for(
                    _agent.ainvoke(
                        {
                            "messages": input_messages,
                            "context": merged_context,
                        },
                        config=langsmith_config,
                    ),
                    timeout=_settings.agent_run_timeout_seconds,
                )
        except AgentBusyError:
            await log_event(
                "agent_run_rejected",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                conversation_id=str(db_session.id),
                agent_run_id=agent_run_id,
                status="rejected",
                duration_ms=int((time.perf_counter() - start) * 1000),
                error_code="AgentBusyError",
                payload={
                    "mode": "standard",
                    "max_concurrent": _settings.max_concurrent_agent_runs,
                },
                **obs_context,
            )
            reset_run_metrics(metrics_token)
            raise HTTPException(
                status_code=429,
                detail=SERVER_BUSY_MESSAGE,
                headers={"Retry-After": str(SERVER_BUSY_RETRY_AFTER_SECONDS)},
            ) from None
        except TimeoutError:
            logger.warning("Agent invocation exceeded %ss timeout", _settings.agent_run_timeout_seconds)
            await log_event(
                "agent_run_timeout",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                conversation_id=str(db_session.id),
                agent_run_id=agent_run_id,
                status="error",
                duration_ms=int((time.perf_counter() - start) * 1000),
                error_code="AgentRunTimeout",
                payload={
                    "mode": "standard",
                    "timeout_seconds": _settings.agent_run_timeout_seconds,
                },
                **obs_context,
            )
            reset_run_metrics(metrics_token)
            raise HTTPException(status_code=504, detail=AGENT_TIMEOUT_MESSAGE) from None
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
            reset_run_metrics(metrics_token)
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
            reset_run_metrics(metrics_token)
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
        tool_seq_index = 0
        for i, msg in enumerate(messages):
            if isinstance(msg, AIMessage) and hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_call_id = new_id()
                    tool_output = ""
                    if i + 1 < len(messages) and isinstance(messages[i + 1], ToolMessage):
                        tool_output = messages[i + 1].content[:TOOL_OUTPUT_CAPTURE_MAX_CHARS]
                    tool_name = tc.get("name", "unknown")
                    timing = None
                    if tool_seq_index < len(run_metrics.tool_calls):
                        timing = run_metrics.tool_calls[tool_seq_index]
                    tool_seq_index += 1
                    duration_ms = timing.duration_ms if timing else None
                    sequence = timing.sequence if timing else tool_seq_index
                    tool_calls_info.append(ToolCallInfo(
                        tool_name=tool_name,
                        tool_input=tc.get("args", {}),
                        tool_output=tool_output,
                        duration_ms=duration_ms,
                        sequence=sequence,
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
                        duration_ms=duration_ms,
                        payload={
                            "tool_name": tool_name,
                            "input_keys": sorted((tc.get("args") or {}).keys()),
                            "output_length": len(tool_output),
                            "sequence": sequence,
                        },
                        **obs_context,
                    )

        # Merge full DB history + new turn additions (avoid overwriting older
        # turns compacted out of the agent input).
        merged_history = _merge_persisted_history(
            history_msgs, user_turn, input_messages, messages
        )
        db_session.messages = messages_to_dict(merged_history)

        # H64: update short_summary + save long-term memories
        try:
            db_session.short_summary = build_deterministic_summary(merged_history)
            for focus in extract_academic_focus(merged_history[-4:]):
                await save_long_term_memory(
                    db, str(current_user.id),
                    focus["type"], focus["key"], focus["value"],
                )
            for pref in extract_user_preferences(merged_history[-4:]):
                await save_long_term_memory(
                    db, str(current_user.id),
                    pref["type"], pref["key"], pref["value"],
                )
        except Exception:
            logger.warning("H64: failed to update memory", exc_info=True)

        await db.commit()

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        usage_dict = run_metrics.to_usage_dict(_settings.llm_model)
        latency_dict = run_metrics.to_latency_breakdown(elapsed_ms)
        reset_run_metrics(metrics_token)
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
            thread_id=str(db_session.id),
            usage=UsageInfo(**usage_dict),
            latency_breakdown=LatencyBreakdown(**latency_dict),
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
        # H67: hold one agent slot for the whole run (title LLM call included)
        # and reject up front — before creating a session — when all are busy.
        try:
            async with _agent_slot():
                async for chunk in _generate_events():
                    yield chunk
        except AgentBusyError:
            await log_event(
                "agent_run_rejected",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                department_id=current_user.department_id,
                agent_run_id=agent_run_id,
                status="rejected",
                error_code="AgentBusyError",
                payload={
                    "mode": "stream",
                    "max_concurrent": _settings.max_concurrent_agent_runs,
                },
                **obs_context,
            )
            busy_event = {
                "type": "error",
                "code": "server_busy",
                "message": SERVER_BUSY_MESSAGE,
                "retry_after_seconds": SERVER_BUSY_RETRY_AFTER_SECONDS,
            }
            yield f"data: {json.dumps(busy_event)}\n\n"

    async def _generate_events():
        start = time.perf_counter()

        async with AsyncSessionLocal() as db:
            history_msgs = []
            db_session = None
            refusal = _guardrail_refusal(payload.message)

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
                title = "Yêu cầu bị chặn" if refusal else await generate_title(payload.message)
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

            if refusal:
                guardrail_decision = classify_input(payload.message)
                await log_event(
                    "guardrail_triggered",
                    user_id=str(current_user.id),
                    user_role=current_user.role.value,
                    department_id=current_user.department_id,
                    conversation_id=str(db_session.id),
                    agent_run_id=agent_run_id,
                    status="blocked",
                    payload={"decision": guardrail_decision, "mode": "stream"},
                    **obs_context,
                )
                elapsed_ms = int((time.perf_counter() - start) * 1000)
                yield f"data: {json.dumps({'type': 'guardrail', 'decision': guardrail_decision, 'trace_source': 'guardrail_pre_llm'})}\n\n"
                yield f"data: {json.dumps({'type': 'token', 'content': refusal})}\n\n"
                blocked_messages = history_msgs + [
                    HumanMessage(content=payload.message),
                    AIMessage(content=refusal),
                ]
                db_session.messages = messages_to_dict(blocked_messages)
                await db.commit()
                yield f"data: {json.dumps({'type': 'done', 'latency_ms': elapsed_ms, 'thread_id': str(db_session.id), 'trace_source': 'guardrail_pre_llm'})}\n\n"
                return

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

            # H64: compact history + load memory context
            user_turn = HumanMessage(content=payload.message)
            all_safe = _history_for_agent(history_msgs) + [user_turn]
            input_messages = compact_history_for_agent(
                all_safe, db_session.short_summary,
            )

            # Persist the user turn eagerly so an aborted stream (e.g. router
            # handoff to /chat) still leaves a durable record of the user
            # message. The final commit below overwrites this once the graph
            # completes.
            db_session.messages = messages_to_dict(list(history_msgs) + [user_turn])
            await db.commit()

            try:
                lt_memories = await load_long_term_memories(db, str(current_user.id))
            except Exception:
                logger.warning("Failed to load long-term memories (stream)", exc_info=True)
                lt_memories = []
            memory_note = build_memory_context_note(db_session.short_summary, lt_memories)
            if memory_note:
                merged_context["memory_summary"] = memory_note

            final_state_messages = []
            accumulated_ai_content = ""
            tool_call_ids: dict[str, str] = {}
            tool_count = 0

            # H59: build LangSmith tracing config (prompt versions seeded at startup)
            stream_run_name = "eduinsight-chat-stream"
            langsmith_config = _build_langsmith_config(
                run_name=stream_run_name,
                mode="stream",
                agent_run_id=agent_run_id,
                conversation_id=str(db_session.id),
                user_role=current_user.role.value,
                obs_context=obs_context,
            )

            agent_events = _agent.astream_events(
                {
                    "messages": input_messages,
                    "context": merged_context,
                },
                config=langsmith_config,
                version="v2",
            )
            try:
                async for event in _with_run_timeout(agent_events):
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
                        output_str = str(output)[:TOOL_OUTPUT_CAPTURE_MAX_CHARS] if output else ""
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
                                accumulated_ai_content += chunk.content
                                yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"
                                await asyncio.sleep(0)  # force flush

                    elif kind == "on_chain_end" and name in (stream_run_name, "LangGraph"):
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
                
                # Update DB after streaming finishes.
                # Merge prior DB history with only the messages the graph
                # appended to its (compacted) input — this preserves older
                # turns that were compacted out of the agent context.
                merged_history: list[Any] | None = None
                if final_state_messages:
                    merged_history = _merge_persisted_history(
                        history_msgs, user_turn, input_messages, final_state_messages
                    )
                elif accumulated_ai_content:
                    logger.warning("on_chain_end not captured; using streamed-token fallback")
                    merged_history = list(history_msgs) + [
                        user_turn,
                        AIMessage(content=accumulated_ai_content),
                    ]

                if merged_history is not None:
                    db_session.messages = messages_to_dict(merged_history)
                    # H64: update short_summary + save long-term memories
                    try:
                        db_session.short_summary = build_deterministic_summary(merged_history)
                        for focus in extract_academic_focus(merged_history[-4:]):
                            await save_long_term_memory(
                                db, str(current_user.id),
                                focus["type"], focus["key"], focus["value"],
                            )
                        for pref in extract_user_preferences(merged_history[-4:]):
                            await save_long_term_memory(
                                db, str(current_user.id),
                                pref["type"], pref["key"], pref["value"],
                            )
                    except Exception:
                        logger.warning("H64: failed to update memory (stream)", exc_info=True)
                    await db.commit()

            except TimeoutError:
                logger.warning(
                    "Agent stream exceeded %ss timeout", _settings.agent_run_timeout_seconds
                )
                await log_event(
                    "agent_run_timeout",
                    user_id=str(current_user.id),
                    user_role=current_user.role.value,
                    department_id=current_user.department_id,
                    conversation_id=str(db_session.id) if db_session else None,
                    agent_run_id=agent_run_id,
                    status="error",
                    duration_ms=int((time.perf_counter() - start) * 1000),
                    error_code="AgentRunTimeout",
                    payload={
                        "mode": "stream",
                        "timeout_seconds": _settings.agent_run_timeout_seconds,
                    },
                    **obs_context,
                )
                timeout_event = {
                    "type": "error",
                    "code": "agent_timeout",
                    "message": AGENT_TIMEOUT_MESSAGE,
                }
                yield f"data: {json.dumps(timeout_event)}\n\n"
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

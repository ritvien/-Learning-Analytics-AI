"""Report Agent endpoints with memory, tool audit, and confirmations."""

import json

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.agent.report_service import (
    ask_report_agent,
    confirm_pending_action,
    create_report_agent_session,
    get_report_agent_session,
    tool_registry_payload,
)
from app.dependencies import CurrentUser, DBSession
from app.schemas.report_agent import (
    ReportAgentAskRequest,
    ReportAgentAskResponse,
    ReportAgentConfirmRequest,
    ReportAgentConfirmResponse,
    ReportAgentSessionCreate,
    ReportAgentSessionResponse,
    ReportAgentToolInfo,
)

router = APIRouter()


@router.get("/tools", response_model=list[ReportAgentToolInfo])
async def list_report_agent_tools(current_user: CurrentUser) -> list[dict]:
    """Return the safe tool registry available to the Report Agent."""
    return tool_registry_payload()


@router.post("/sessions", response_model=ReportAgentSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: ReportAgentSessionCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Create a report-agent conversation session."""
    return await create_report_agent_session(
        db,
        user=current_user,
        report_id=payload.report_id,
        mode=payload.mode,
        title=payload.title,
        scope=payload.scope,
    )


@router.get("/sessions/{session_id}", response_model=ReportAgentSessionResponse)
async def get_session(session_id: str, db: DBSession, current_user: CurrentUser):
    """Return a report-agent session with messages."""
    session = await get_report_agent_session(db, current_user, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.post("/ask", response_model=ReportAgentAskResponse)
async def ask(payload: ReportAgentAskRequest, db: DBSession, current_user: CurrentUser):
    """Ask the Report Agent using grounded report tools and persisted memory."""
    try:
        return await ask_report_agent(
            db,
            user=current_user,
            message=payload.message,
            mode=payload.mode,
            context=payload.context,
            report_id=payload.report_id,
            session_id=payload.session_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Report agent error: {exc}") from exc


@router.post("/stream")
async def ask_stream(payload: ReportAgentAskRequest, db: DBSession, current_user: CurrentUser):
    """SSE wrapper for Report Agent responses.

    The MVP computes one grounded answer and streams structured events. Token-level
    LLM streaming can be added later without changing the endpoint contract.
    """

    async def event_generator():
        try:
            result = await ask_report_agent(
                db,
                user=current_user,
                message=payload.message,
                mode=payload.mode,
                context=payload.context,
                report_id=payload.report_id,
                session_id=payload.session_id,
            )
            yield f"data: {json.dumps({'type': 'tool_calls', 'tool_calls': result['tool_calls']}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'message', 'content': result['response']}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'session_id': result['session_id']}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/tools/confirm/{action_id}", response_model=ReportAgentConfirmResponse)
async def confirm_tool_action(
    action_id: str,
    payload: ReportAgentConfirmRequest,
    db: DBSession,
    current_user: CurrentUser,
):
    """Confirm or cancel a pending write action proposed by the agent."""
    try:
        return await confirm_pending_action(db, current_user, action_id, payload.action)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

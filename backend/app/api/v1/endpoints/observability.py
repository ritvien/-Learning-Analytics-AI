"""Observability ingestion endpoint for frontend user behavior events."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.dependencies import CurrentUser
from app.observability import log_event, request_context, stable_hash

router = APIRouter()


class ClientEventRequest(BaseModel):
    """Structured frontend event payload."""

    event_name: str = Field(..., min_length=1, max_length=120)
    route: str | None = Field(default=None, max_length=500)
    module: str | None = Field(default=None, max_length=120)
    entity_type: str | None = Field(default=None, max_length=120)
    entity_id: str | None = Field(default=None, max_length=120)
    status: str | None = Field(default=None, max_length=80)
    duration_ms: int | None = Field(default=None, ge=0)
    payload: dict[str, Any] = Field(default_factory=dict)


@router.post("/events", status_code=202)
async def ingest_client_event(
    request: Request,
    payload: ClientEventRequest,
    current_user: CurrentUser,
) -> dict[str, str]:
    """Accept one sanitized client-side observability event."""
    context = request_context(request)
    safe_payload = dict(payload.payload)
    if isinstance(safe_payload.get("prompt"), str):
        prompt = safe_payload.pop("prompt")
        safe_payload["prompt_hash"] = stable_hash(prompt)
        safe_payload["prompt_length"] = len(prompt)
    await log_event(
        payload.event_name,
        user_id=str(current_user.id),
        user_role=current_user.role.value,
        department_id=current_user.department_id,
        session_id=context["session_id"],
        request_id=context["request_id"],
        trace_id=context["trace_id"],
        route=payload.route or context["route"],
        module=payload.module or context["module"],
        entity_type=payload.entity_type or context["entity_type"],
        entity_id=payload.entity_id or context["entity_id"],
        status=payload.status,
        duration_ms=payload.duration_ms,
        payload=safe_payload,
    )
    return {"status": "accepted"}

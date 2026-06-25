"""Observability ingestion and superadmin read APIs."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.dependencies import CurrentUser, DBSession, require_roles
from app.models.people import UserRole
from app.observability import log_event, request_context, stable_hash

router = APIRouter()
SuperadminOnly = Depends(require_roles(UserRole.superadmin))
FromTimeQuery = Annotated[datetime | None, Query(alias="from")]
ToTimeQuery = Annotated[datetime | None, Query(alias="to")]


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


class ObservabilityEventResponse(BaseModel):
    """One raw event from obs.event_log."""

    id: int
    occurred_at: datetime
    event_name: str
    event_version: int
    user_id: str | None = None
    user_role: str | None = None
    department_id: int | None = None
    session_id: str | None = None
    request_id: str | None = None
    trace_id: str | None = None
    conversation_id: str | None = None
    agent_run_id: str | None = None
    tool_call_id: str | None = None
    retrieval_id: str | None = None
    route: str | None = None
    module: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    status: str | None = None
    duration_ms: int | None = None
    error_code: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class ObservabilityEventListResponse(BaseModel):
    """Paginated raw event list."""

    total: int
    skip: int
    limit: int
    items: list[ObservabilityEventResponse]


class ObservabilitySessionResponse(BaseModel):
    """Aggregated observability data for one browser/app session."""

    session_id: str
    user_id: str | None = None
    user_role: str | None = None
    department_id: int | None = None
    first_seen_at: datetime
    last_seen_at: datetime
    event_count: int
    request_count: int
    error_count: int
    avg_duration_ms: float | None = None


class ObservabilitySessionListResponse(BaseModel):
    """Paginated session list."""

    total: int
    skip: int
    limit: int
    items: list[ObservabilitySessionResponse]


class ObservabilityUserAggregateResponse(BaseModel):
    """Aggregated observability metrics for one user."""

    user_id: str
    email: str | None = None
    full_name: str | None = None
    user_role: str | None = None
    session_count: int
    event_count: int
    request_count: int
    error_count: int
    avg_duration_ms: float | None = None
    last_seen_at: datetime


class ObservabilityUserAggregateListResponse(BaseModel):
    """Paginated user aggregate list."""

    total: int
    skip: int
    limit: int
    items: list[ObservabilityUserAggregateResponse]


def _bounded_limit(limit: int) -> int:
    return min(500, max(1, limit))


def _event_filters(
    *,
    user_id: str | None = None,
    session_id: str | None = None,
    trace_id: str | None = None,
    event_name: str | None = None,
    status: str | None = None,
    route: str | None = None,
    module: str | None = None,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
) -> tuple[str, dict[str, Any]]:
    clauses: list[str] = []
    params: dict[str, Any] = {}
    if user_id is not None:
        clauses.append("e.user_id = :user_id")
        params["user_id"] = user_id
    if session_id is not None:
        clauses.append("e.session_id = :session_id")
        params["session_id"] = session_id
    if trace_id is not None:
        clauses.append("e.trace_id = :trace_id")
        params["trace_id"] = trace_id
    if event_name is not None:
        clauses.append("e.event_name = :event_name")
        params["event_name"] = event_name
    if status is not None:
        clauses.append("e.status = :status")
        params["status"] = status
    if route is not None:
        clauses.append("e.route = :route")
        params["route"] = route
    if module is not None:
        clauses.append("e.module = :module")
        params["module"] = module
    if from_time is not None:
        clauses.append("e.occurred_at >= :from_time")
        params["from_time"] = from_time
    if to_time is not None:
        clauses.append("e.occurred_at <= :to_time")
        params["to_time"] = to_time
    return (" WHERE " + " AND ".join(clauses) if clauses else ""), params


def _decode_payload(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return {str(key): item for key, item in value.items()}
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return decoded if isinstance(decoded, dict) else {}
    return {}


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


@router.get(
    "/admin/events",
    response_model=ObservabilityEventListResponse,
    dependencies=[SuperadminOnly],
)
async def list_observability_events(
    db: DBSession,
    user_id: str | None = None,
    session_id: str | None = None,
    trace_id: str | None = None,
    event_name: str | None = None,
    status: str | None = None,
    route: str | None = None,
    module: str | None = None,
    from_time: FromTimeQuery = None,
    to_time: ToTimeQuery = None,
    skip: int = 0,
    limit: int = 100,
) -> ObservabilityEventListResponse:
    """Return filtered raw events from obs.event_log for superadmin investigation."""
    where_sql, params = _event_filters(
        user_id=user_id,
        session_id=session_id,
        trace_id=trace_id,
        event_name=event_name,
        status=status,
        route=route,
        module=module,
        from_time=from_time,
        to_time=to_time,
    )
    safe_skip = max(0, skip)
    safe_limit = _bounded_limit(limit)
    total = (
        await db.execute(text(f"SELECT COUNT(*) FROM obs.event_log e{where_sql}"), params)
    ).scalar_one()
    rows = (
        await db.execute(
            text(
                f"""
                SELECT
                    id, occurred_at, event_name, event_version, user_id, user_role,
                    department_id, session_id, request_id, trace_id, conversation_id,
                    agent_run_id, tool_call_id, retrieval_id, route, module, entity_type,
                    entity_id, status, duration_ms, error_code, payload
                FROM obs.event_log e
                {where_sql}
                ORDER BY occurred_at DESC, id DESC
                LIMIT :limit OFFSET :skip
                """
            ),
            {**params, "skip": safe_skip, "limit": safe_limit},
        )
    ).mappings().all()
    items = [
        ObservabilityEventResponse(**{**dict(row), "payload": _decode_payload(row["payload"])})
        for row in rows
    ]
    return ObservabilityEventListResponse(total=int(total), skip=safe_skip, limit=safe_limit, items=items)


@router.get(
    "/admin/sessions",
    response_model=ObservabilitySessionListResponse,
    dependencies=[SuperadminOnly],
)
async def list_observability_sessions(
    db: DBSession,
    user_id: str | None = None,
    session_id: str | None = None,
    trace_id: str | None = None,
    event_name: str | None = None,
    status: str | None = None,
    route: str | None = None,
    module: str | None = None,
    from_time: FromTimeQuery = None,
    to_time: ToTimeQuery = None,
    skip: int = 0,
    limit: int = 100,
) -> ObservabilitySessionListResponse:
    """Return sessions summarized from obs.event_log, filterable by event dimensions."""
    where_sql, params = _event_filters(
        user_id=user_id,
        session_id=session_id,
        trace_id=trace_id,
        event_name=event_name,
        status=status,
        route=route,
        module=module,
        from_time=from_time,
        to_time=to_time,
    )
    where_sql = f"{where_sql} AND e.session_id IS NOT NULL" if where_sql else " WHERE e.session_id IS NOT NULL"
    safe_skip = max(0, skip)
    safe_limit = _bounded_limit(limit)
    grouped_sql = f"""
        SELECT
            e.session_id,
            MAX(e.user_id) AS user_id,
            MAX(e.user_role) AS user_role,
            MAX(e.department_id) AS department_id,
            MIN(e.occurred_at) AS first_seen_at,
            MAX(e.occurred_at) AS last_seen_at,
            COUNT(*) AS event_count,
            SUM(CASE WHEN e.event_name = 'http_request_completed' THEN 1 ELSE 0 END) AS request_count,
            SUM(CASE WHEN e.status = 'error' OR e.error_code IS NOT NULL THEN 1 ELSE 0 END) AS error_count,
            AVG(e.duration_ms) AS avg_duration_ms
        FROM obs.event_log e
        {where_sql}
        GROUP BY e.session_id
    """
    total = (await db.execute(text(f"SELECT COUNT(*) FROM ({grouped_sql}) s"), params)).scalar_one()
    rows = (
        await db.execute(
            text(f"{grouped_sql} ORDER BY last_seen_at DESC LIMIT :limit OFFSET :skip"),
            {**params, "skip": safe_skip, "limit": safe_limit},
        )
    ).mappings().all()
    return ObservabilitySessionListResponse(
        total=int(total),
        skip=safe_skip,
        limit=safe_limit,
        items=[ObservabilitySessionResponse(**dict(row)) for row in rows],
    )


@router.get(
    "/admin/users/aggregates",
    response_model=ObservabilityUserAggregateListResponse,
    dependencies=[SuperadminOnly],
)
async def list_observability_user_aggregates(
    db: DBSession,
    user_id: str | None = None,
    session_id: str | None = None,
    trace_id: str | None = None,
    event_name: str | None = None,
    status: str | None = None,
    route: str | None = None,
    module: str | None = None,
    from_time: FromTimeQuery = None,
    to_time: ToTimeQuery = None,
    skip: int = 0,
    limit: int = 100,
) -> ObservabilityUserAggregateListResponse:
    """Return per-user observability aggregates for superadmin dashboards."""
    where_sql, params = _event_filters(
        user_id=user_id,
        session_id=session_id,
        trace_id=trace_id,
        event_name=event_name,
        status=status,
        route=route,
        module=module,
        from_time=from_time,
        to_time=to_time,
    )
    where_sql = f"{where_sql} AND e.user_id IS NOT NULL" if where_sql else " WHERE e.user_id IS NOT NULL"
    safe_skip = max(0, skip)
    safe_limit = _bounded_limit(limit)
    grouped_sql = f"""
        SELECT
            e.user_id,
            MAX(u.email) AS email,
            MAX(u.full_name) AS full_name,
            MAX(e.user_role) AS user_role,
            COUNT(DISTINCT e.session_id) AS session_count,
            COUNT(*) AS event_count,
            SUM(CASE WHEN e.event_name = 'http_request_completed' THEN 1 ELSE 0 END) AS request_count,
            SUM(CASE WHEN e.status = 'error' OR e.error_code IS NOT NULL THEN 1 ELSE 0 END) AS error_count,
            AVG(e.duration_ms) AS avg_duration_ms,
            MAX(e.occurred_at) AS last_seen_at
        FROM obs.event_log e
        LEFT JOIN users u ON u.id = e.user_id
        {where_sql}
        GROUP BY e.user_id
    """
    total = (await db.execute(text(f"SELECT COUNT(*) FROM ({grouped_sql}) a"), params)).scalar_one()
    rows = (
        await db.execute(
            text(f"{grouped_sql} ORDER BY last_seen_at DESC LIMIT :limit OFFSET :skip"),
            {**params, "skip": safe_skip, "limit": safe_limit},
        )
    ).mappings().all()
    return ObservabilityUserAggregateListResponse(
        total=int(total),
        skip=safe_skip,
        limit=safe_limit,
        items=[ObservabilityUserAggregateResponse(**dict(row)) for row in rows],
    )

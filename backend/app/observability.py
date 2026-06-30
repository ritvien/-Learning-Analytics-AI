"""Structured observability helpers for user behavior and agent traces."""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request, Response
from jose import JWTError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import AsyncSessionLocal
from app.dependencies import decode_token

logger = logging.getLogger(__name__)

SESSION_COOKIE = "ei_session_id"
REQUEST_ID_HEADER = "x-request-id"
TRACE_ID_HEADER = "x-trace-id"
PAGE_ROUTE_HEADER = "x-page-route"
PAGE_CONTEXT_HEADER = "x-page-context"

SENSITIVE_KEYS = {
    "access_token",
    "authorization",
    "cookie",
    "password",
    "refresh_token",
    "secret",
    "token",
}


def new_id() -> str:
    """Return a UUID string for trace identifiers."""
    return str(uuid.uuid4())


def stable_hash(value: str) -> str:
    """Return a non-reversible hash for prompt/query style values."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _valid_uuid(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(uuid.UUID(value))
    except ValueError:
        return None


def _safe_json_header(value: str | None) -> dict[str, Any]:
    if not value or len(value) > 4000:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def sanitize_payload(value: Any, *, depth: int = 0) -> Any:
    """Redact sensitive keys and keep payloads bounded for event logs."""
    if depth > 5:
        return "[truncated]"
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for key, item in value.items():
            key_str = str(key)
            if key_str.lower() in SENSITIVE_KEYS:
                sanitized[key_str] = "[redacted]"
            else:
                sanitized[key_str] = sanitize_payload(item, depth=depth + 1)
        return sanitized
    if isinstance(value, list):
        return [sanitize_payload(item, depth=depth + 1) for item in value[:50]]
    if isinstance(value, str):
        return value if len(value) <= 500 else f"{value[:500]}...[truncated]"
    if isinstance(value, int | float | bool) or value is None:
        return value
    return str(value)


def request_context(request: Request) -> dict[str, Any]:
    """Return IDs and page context attached by the observability middleware."""
    page_context = getattr(request.state, "page_context", {}) or {}
    return {
        "session_id": getattr(request.state, "session_id", None),
        "request_id": getattr(request.state, "request_id", None),
        "trace_id": getattr(request.state, "trace_id", None),
        "route": page_context.get("route") or request.headers.get(PAGE_ROUTE_HEADER) or request.url.path,
        "module": page_context.get("module"),
        "entity_type": page_context.get("entity_type"),
        "entity_id": str(page_context["entity_id"]) if page_context.get("entity_id") is not None else None,
    }


def _user_context_from_request(request: Request) -> dict[str, Any]:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return {}
    token = header.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except (JWTError, Exception):
        return {}
    role = payload.get("role")
    user_id = payload.get("sub")
    return {
        "user_id": str(user_id) if isinstance(user_id, str) else None,
        "user_role": str(role) if isinstance(role, str) else None,
    }


async def log_event(
    event_name: str,
    *,
    event_version: int = 1,
    user_id: str | None = None,
    user_role: str | None = None,
    department_id: int | None = None,
    session_id: str | None = None,
    request_id: str | None = None,
    trace_id: str | None = None,
    conversation_id: str | None = None,
    agent_run_id: str | None = None,
    tool_call_id: str | None = None,
    retrieval_id: str | None = None,
    route: str | None = None,
    module: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    status: str | None = None,
    duration_ms: int | None = None,
    error_code: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    """Insert one event. Failures are logged but never break product flows."""
    params = {
        "event_name": event_name,
        "event_version": event_version,
        "user_id": user_id,
        "user_role": user_role,
        "department_id": department_id,
        "session_id": session_id,
        "request_id": request_id,
        "trace_id": trace_id,
        "conversation_id": conversation_id,
        "agent_run_id": agent_run_id,
        "tool_call_id": tool_call_id,
        "retrieval_id": retrieval_id,
        "route": route,
        "module": module,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "status": status,
        "duration_ms": duration_ms,
        "error_code": error_code,
        "payload": json.dumps(sanitize_payload(payload or {}), ensure_ascii=False),
    }
    statement = text(
        """
        INSERT INTO obs.event_log (
            event_name, event_version, user_id, user_role, department_id,
            session_id, request_id, trace_id, conversation_id, agent_run_id,
            tool_call_id, retrieval_id, route, module, entity_type, entity_id,
            status, duration_ms, error_code, payload
        )
        VALUES (
            :event_name, :event_version, :user_id, :user_role, :department_id,
            :session_id, :request_id, :trace_id, :conversation_id, :agent_run_id,
            :tool_call_id, :retrieval_id, :route, :module, :entity_type, :entity_id,
            :status, :duration_ms, :error_code, CAST(:payload AS jsonb)
        )
        """
    )
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(statement, params)
            await db.commit()
    except (SQLAlchemyError, OSError) as exc:
        logger.debug("Failed to write observability event %s: %s", event_name, exc)


async def observability_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Attach request/session/trace IDs and log HTTP request summaries."""
    start = time.perf_counter()
    session_id = _valid_uuid(request.cookies.get(SESSION_COOKIE)) or new_id()
    request_id = _valid_uuid(request.headers.get(REQUEST_ID_HEADER)) or new_id()
    trace_id = _valid_uuid(request.headers.get(TRACE_ID_HEADER)) or request_id
    page_context = _safe_json_header(request.headers.get(PAGE_CONTEXT_HEADER))

    request.state.session_id = session_id
    request.state.request_id = request_id
    request.state.trace_id = trace_id
    request.state.page_context = page_context

    status_code = 500
    error_code: str | None = None
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception as exc:
        error_code = exc.__class__.__name__
        raise
    finally:
        if request.url.path not in {"/health", "/api/v1/observability/events"}:
            duration_ms = int((time.perf_counter() - start) * 1000)
            user_context = _user_context_from_request(request)
            await log_event(
                "http_request_completed",
                **user_context,
                session_id=session_id,
                request_id=request_id,
                trace_id=trace_id,
                route=request.headers.get(PAGE_ROUTE_HEADER) or request.url.path,
                module=page_context.get("module"),
                entity_type=page_context.get("entity_type"),
                entity_id=str(page_context["entity_id"]) if page_context.get("entity_id") is not None else None,
                status="ok" if status_code < 400 else "error",
                duration_ms=duration_ms,
                error_code=error_code,
                payload={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "query_present": bool(request.url.query),
                },
            )

    response.headers[REQUEST_ID_HEADER] = request_id
    response.headers[TRACE_ID_HEADER] = trace_id
    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        max_age=60 * 60 * 24 * 30,
        httponly=False,
        samesite="lax",
    )
    return response

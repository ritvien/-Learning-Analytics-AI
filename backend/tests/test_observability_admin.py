"""Superadmin observability read API tests."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.people import User, UserRole


async def _create_obs_event_log(db_session: AsyncSession) -> None:
    await db_session.execute(text("ATTACH DATABASE ':memory:' AS obs"))
    await db_session.execute(
        text(
            """
            CREATE TABLE obs.event_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at TEXT NOT NULL,
                event_name TEXT NOT NULL,
                event_version INTEGER NOT NULL DEFAULT 1,
                user_id TEXT,
                user_role TEXT,
                department_id INTEGER,
                session_id TEXT,
                request_id TEXT,
                trace_id TEXT,
                conversation_id TEXT,
                agent_run_id TEXT,
                tool_call_id TEXT,
                retrieval_id TEXT,
                route TEXT,
                module TEXT,
                entity_type TEXT,
                entity_id TEXT,
                status TEXT,
                duration_ms INTEGER,
                error_code TEXT,
                payload TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
    )


async def _seed_users_and_events(db_session: AsyncSession) -> tuple[User, User]:
    superadmin = User(
        id="test-superadmin",
        email="superadmin@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test Superadmin",
        role=UserRole.superadmin,
    )
    manager = User(
        id="test-manager-obs",
        email="manager-obs@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test Manager Obs",
        role=UserRole.manager,
    )
    db_session.add_all([superadmin, manager])
    await db_session.flush()
    await _create_obs_event_log(db_session)
    await db_session.execute(
        text(
            """
            INSERT INTO obs.event_log (
                occurred_at, event_name, user_id, user_role, session_id,
                request_id, trace_id, route, module, status, duration_ms,
                error_code, payload
            )
            VALUES
                (
                    '2026-06-24T08:00:00',
                    'http_request_completed',
                    'test-superadmin',
                    'superadmin',
                    '11111111-1111-1111-1111-111111111111',
                    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    '/manager/analytics',
                    'analytics',
                    'ok',
                    120,
                    NULL,
                    '{"path": "/api/v1/tree"}'
                ),
                (
                    '2026-06-24T08:01:00',
                    'chat_message_submitted',
                    'test-superadmin',
                    'superadmin',
                    '11111111-1111-1111-1111-111111111111',
                    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                    '/chat',
                    'chat',
                    'error',
                    450,
                    'ToolTimeout',
                    '{"prompt_hash": "abc"}'
                ),
                (
                    '2026-06-24T08:02:00',
                    'http_request_completed',
                    'test-manager-obs',
                    'manager',
                    '22222222-2222-2222-2222-222222222222',
                    'cccccccc-cccc-cccc-cccc-cccccccccccc',
                    'cccccccc-cccc-cccc-cccc-cccccccccccc',
                    '/manager/reports',
                    'reports',
                    'ok',
                    80,
                    NULL,
                    '{"path": "/api/v1/reports"}'
                )
            """
        )
    )
    await db_session.flush()
    return superadmin, manager


async def test_observability_admin_requires_superadmin(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    superadmin, manager = await _seed_users_and_events(db_session)

    manager_headers = {"Authorization": f"Bearer {create_access_token(manager.id, manager.role)}"}
    forbidden = await client.get("/api/v1/observability/admin/sessions", headers=manager_headers)
    assert forbidden.status_code == 403

    superadmin_headers = {"Authorization": f"Bearer {create_access_token(superadmin.id, superadmin.role)}"}
    allowed = await client.get("/api/v1/observability/admin/sessions", headers=superadmin_headers)
    assert allowed.status_code == 200


async def test_observability_events_can_be_filtered(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    superadmin, _manager = await _seed_users_and_events(db_session)
    headers = {"Authorization": f"Bearer {create_access_token(superadmin.id, superadmin.role)}"}

    response = await client.get(
        "/api/v1/observability/admin/events",
        params={"event_name": "chat_message_submitted", "status": "error"},
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["event_name"] == "chat_message_submitted"
    assert data["items"][0]["payload"] == {"prompt_hash": "abc"}


async def test_observability_sessions_and_user_aggregates(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    superadmin, _manager = await _seed_users_and_events(db_session)
    headers = {"Authorization": f"Bearer {create_access_token(superadmin.id, superadmin.role)}"}

    sessions = await client.get(
        "/api/v1/observability/admin/sessions",
        params={"user_id": "test-superadmin"},
        headers=headers,
    )
    assert sessions.status_code == 200
    session_data = sessions.json()
    assert session_data["total"] == 1
    assert session_data["items"][0]["event_count"] == 2
    assert session_data["items"][0]["error_count"] == 1

    aggregates = await client.get("/api/v1/observability/admin/users/aggregates", headers=headers)
    assert aggregates.status_code == 200
    users = {item["user_id"]: item for item in aggregates.json()["items"]}
    assert users["test-superadmin"]["email"] == "superadmin@example.com"
    assert users["test-superadmin"]["session_count"] == 1
    assert users["test-superadmin"]["event_count"] == 2
    assert users["test-manager-obs"]["event_count"] == 1

"""Case workflow and actor-boundary coverage."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token
from tests.test_homeroom_rbac import _seed_homeroom_data


async def test_lecturer_case_is_unique_and_contact_updates_timeline(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    student = data["own_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    payload = {
        "student_id": student.id,
        "scope_type": "homeroom",
        "class_code": "K21-A",
        "priority": "high",
        "signal_snapshot": {"reasons": ["GPA thấp"]},
    }

    created = await client.post("/api/v1/interventions/cases", json=payload)
    duplicate = await client.post("/api/v1/interventions/cases", json=payload)
    case_id = created.json()["id"]
    contacted = await client.post(
        "/api/v1/interventions/contact",
        json={
            "case_id": case_id,
            "student_id": student.id,
            "class_code": "K21-A",
            "channel": "phone",
            "status": "logged",
            "note": "Đã hẹn trao đổi",
        },
    )
    detail = await client.get(f"/api/v1/interventions/cases/{case_id}")

    assert created.status_code == 201
    assert created.json()["assignee_user_id"] == lecturer.id
    assert duplicate.status_code == 409
    assert contacted.status_code == 201
    assert contacted.json()["case_id"] == case_id
    assert detail.json()["status"] == "contacting"
    assert {event["event_type"] for event in detail.json()["events"]} >= {"created", "contact"}


async def test_manager_can_monitor_but_cannot_contact_or_resolve(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    manager = data["manager"]
    student = data["own_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    created = await client.post(
        "/api/v1/interventions/cases",
        json={"student_id": student.id, "scope_type": "homeroom", "class_code": "K21-A"},
    )
    case_id = created.json()["id"]

    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"
    queue = await client.get("/api/v1/interventions/cases")
    resolve = await client.patch(f"/api/v1/interventions/cases/{case_id}", json={"status": "resolved"})
    contact = await client.post(
        "/api/v1/interventions/contact",
        json={"case_id": case_id, "student_id": student.id, "class_code": "K21-A", "channel": "email"},
    )

    assert queue.status_code == 200
    assert [item["id"] for item in queue.json()] == [case_id]
    assert queue.json()[0]["permissions"]["can_assign"] is True
    assert queue.json()[0]["permissions"]["can_contact"] is False
    assert resolve.status_code == 403
    assert contact.status_code == 403


async def test_lecturer_cannot_create_case_outside_homeroom(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    student = data["other_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    response = await client.post(
        "/api/v1/interventions/cases",
        json={"student_id": student.id, "scope_type": "homeroom", "class_code": "K21-B"},
    )

    assert response.status_code == 403


async def test_sync_materializes_scoped_risk_with_explainable_snapshot(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    student = data["own_student"]
    student.gpa_cumulative = 1.5
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    synced = await client.post("/api/v1/interventions/cases/sync-risk-signals?max_cases=10")
    queue = await client.get("/api/v1/interventions/cases")

    assert synced.status_code == 200
    assert synced.json()["created"] == 1
    assert len(queue.json()) == 1
    snapshot = queue.json()[0]["signal_snapshot"]
    assert snapshot["academic"]["gpa_cumulative"] == 1.5
    assert snapshot["dropout_ml"]["available"] is False
    assert snapshot["source"] == "academic_rules+predictions"

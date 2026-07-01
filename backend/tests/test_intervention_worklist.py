"""RBAC and fallback coverage for the ML-enriched section worklist."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token
from app.models.people import UserRole
from tests.test_sections_rbac import _create_test_data, _create_user


async def test_manager_worklist_is_limited_to_department(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _create_test_data(db_session)
    manager = await _create_user(db_session, role=UserRole.manager, department_id=data["dept_allowed"].id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.get("/api/v1/interventions/sections/worklist")

    assert response.status_code == 200
    assert [row["id"] for row in response.json()["sections"]] == [data["section_allowed"].id]


async def test_lecturer_worklist_uses_teaching_assignment_and_survives_missing_ml(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _create_test_data(db_session)
    lecturer = await _create_user(db_session, role=UserRole.lecturer, department_id=data["dept_allowed"].id)
    data["teacher_allowed"].user_id = lecturer.id
    data["section_allowed"].teacher_id = data["teacher_allowed"].id
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    response = await client.get("/api/v1/interventions/sections/worklist")

    assert response.status_code == 200
    row = response.json()["sections"][0]
    assert row["id"] == data["section_allowed"].id
    assert row["support_priority"] == "normal"
    assert row["data_confidence"]["level"] == "low"
    assert row["data_confidence"]["ml_coverage"] == 0

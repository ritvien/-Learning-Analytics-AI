"""Guardrail and RBAC tests for analytics/admin surfaces."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import Course, Department, Program, University
from app.models.people import User, UserRole


async def _create_scoped_user(db_session: AsyncSession, *, role: UserRole, department_id: int | None) -> User:
    user = User(
        id=f"{role.value}-guardrail-user",
        email=f"{role.value}.guardrail@example.com",
        hashed_password=hash_password("password123"),
        full_name=f"{role.value.title()} Guardrail",
        role=role,
        department_id=department_id,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _create_catalog(db_session: AsyncSession) -> tuple[Department, Department, Program, Course]:
    university = University(code="EPU", name="Electric Power University")
    db_session.add(university)
    await db_session.flush()

    allowed_department = Department(university_id=university.id, code="CNTT", name="Cong nghe thong tin")
    denied_department = Department(university_id=university.id, code="QTKD", name="Quan tri kinh doanh")
    db_session.add_all([allowed_department, denied_department])
    await db_session.flush()

    denied_program = Program(department_id=denied_department.id, code="BA", name="Business Administration")
    denied_course = Course(department_id=denied_department.id, code="BA101", name="Business Basics", credits=3)
    db_session.add_all([denied_program, denied_course])
    await db_session.flush()
    return allowed_department, denied_department, denied_program, denied_course


async def test_analytics_health_requires_authentication(client: AsyncClient) -> None:
    client.headers.pop("Authorization", None)

    response = await client.get("/api/v1/analytics/health/program/1")

    assert response.status_code == 401


async def test_scoped_user_cannot_read_program_outside_department(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    allowed_department, _, denied_program, _ = await _create_catalog(db_session)
    manager = await _create_scoped_user(db_session, role=UserRole.manager, department_id=allowed_department.id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.get(f"/api/v1/analytics/health/program/{denied_program.id}")

    assert response.status_code == 403
    assert response.json()["detail"] == "Analytics scope is outside your permissions"


async def test_scoped_user_cannot_read_course_outside_department(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    allowed_department, _, _, denied_course = await _create_catalog(db_session)
    manager = await _create_scoped_user(db_session, role=UserRole.manager, department_id=allowed_department.id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.get(f"/api/v1/analytics/health/course/{denied_course.id}")

    assert response.status_code == 403
    assert response.json()["detail"] == "Analytics scope is outside your permissions"


async def test_admin_analytics_operations_reject_non_admin(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    manager = await _create_scoped_user(db_session, role=UserRole.manager, department_id=None)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.post("/api/v1/admin/ml/train")

    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"

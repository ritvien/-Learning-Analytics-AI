"""Guardrail and RBAC tests for analytics/admin surfaces."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import Course, Department, Program, Semester, University
from app.models.people import Cohort, Student, User, UserRole
from app.models.teaching import Enrollment, Section


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


async def test_scoped_user_cannot_read_enrollment_prediction_outside_department(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    allowed_department, _, denied_program, denied_course = await _create_catalog(db_session)
    cohort = Cohort(code="K99", year_start=2026)
    semester = Semester(code="2026-1", name="HK1 2026", year=2026, term=1)
    db_session.add_all([cohort, semester])
    await db_session.flush()

    student = Student(
        program_id=denied_program.id,
        cohort_id=cohort.id,
        student_code="SV-IDOR",
        full_name="IDOR Test Student",
    )
    section = Section(course_id=denied_course.id, semester_id=semester.id, section_code="IDOR-01")
    db_session.add_all([student, section])
    await db_session.flush()

    enrollment = Enrollment(student_id=student.id, section_id=section.id, registered_credits=3)
    db_session.add(enrollment)
    await db_session.flush()

    manager = await _create_scoped_user(db_session, role=UserRole.manager, department_id=allowed_department.id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.get(f"/api/v1/predictions/enrollments/{enrollment.id}")

    assert response.status_code == 403
    assert response.json()["detail"] == "Analytics scope is outside your permissions"


async def test_course_health_batch_without_ids_returns_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/v1/analytics/health/courses/batch")

    assert response.status_code == 200
    assert response.json() == []

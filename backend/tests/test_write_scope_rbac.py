"""Row-level write-scope coverage for department managers."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import Course, Department, Program, University
from app.models.people import Cohort, Student, User, UserRole


async def _seed_cross_department_data(db: AsyncSession) -> dict[str, object]:
    university = University(code="RBAC-U", name="RBAC University")
    db.add(university)
    await db.flush()
    allowed_department = Department(university_id=university.id, code="ALLOW", name="Allowed Department")
    denied_department = Department(university_id=university.id, code="DENY", name="Denied Department")
    db.add_all([allowed_department, denied_department])
    await db.flush()
    allowed_program = Program(department_id=allowed_department.id, code="ALLOW-P", name="Allowed Program")
    denied_program = Program(department_id=denied_department.id, code="DENY-P", name="Denied Program")
    cohort = Cohort(code="K-RBAC", year_start=2026)
    db.add_all([allowed_program, denied_program, cohort])
    await db.flush()
    denied_course = Course(
        department_id=denied_department.id,
        code="DENY-C",
        name="Denied Course",
        credits=3,
        programs=[denied_program],
    )
    denied_student = Student(
        program_id=denied_program.id,
        cohort_id=cohort.id,
        student_code="DENY-S",
        full_name="Denied Student",
    )
    manager = User(
        id="scoped-manager",
        email="scoped.manager@example.com",
        hashed_password=hash_password("password123"),
        full_name="Scoped Manager",
        role=UserRole.manager,
        department_id=allowed_department.id,
    )
    db.add_all([denied_course, denied_student, manager])
    await db.flush()
    return {
        "allowed_department": allowed_department,
        "denied_department": denied_department,
        "allowed_program": allowed_program,
        "denied_program": denied_program,
        "denied_course": denied_course,
        "denied_student": denied_student,
        "cohort": cohort,
        "manager": manager,
    }


async def test_manager_cannot_write_course_outside_department(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_cross_department_data(db_session)
    manager = data["manager"]
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    create_response = await client.post(
        "/api/v1/courses",
        json={
            "code": "CROSS-C",
            "name": "Cross Department Course",
            "credits": 3,
            "department_id": data["denied_department"].id,
            "program_ids": [data["denied_program"].id],
        },
    )
    patch_response = await client.patch(
        f"/api/v1/courses/{data['denied_course'].id}",
        json={"name": "Unauthorized Rename"},
    )
    delete_response = await client.delete(f"/api/v1/courses/{data['denied_course'].id}")

    assert create_response.status_code == 403
    assert patch_response.status_code == 403
    assert delete_response.status_code == 403


async def test_manager_cannot_write_student_outside_department(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_cross_department_data(db_session)
    manager = data["manager"]
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    create_response = await client.post(
        "/api/v1/students",
        json={
            "student_code": "CROSS-S",
            "full_name": "Cross Department Student",
            "program_id": data["denied_program"].id,
            "cohort_id": data["cohort"].id,
        },
    )
    patch_response = await client.patch(
        f"/api/v1/students/{data['denied_student'].id}",
        json={"full_name": "Unauthorized Rename"},
    )
    delete_response = await client.delete(f"/api/v1/students/{data['denied_student'].id}")

    assert create_response.status_code == 403
    assert patch_response.status_code == 403
    assert delete_response.status_code == 403

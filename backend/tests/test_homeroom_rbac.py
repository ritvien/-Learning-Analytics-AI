"""RBAC coverage for administrative-class homeroom assignments."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import can_access_student
from app.api.v1.endpoints.homeroom import _academic_risk
from app.dependencies import create_access_token, hash_password
from app.models.academic import Department, Program, University
from app.models.people import Cohort, HomeroomAssignment, Student, Teacher, User, UserRole


async def _seed_homeroom_data(db: AsyncSession) -> dict[str, object]:
    university = University(code="HOME-U", name="Homeroom University")
    db.add(university)
    await db.flush()
    department = Department(university_id=university.id, code="HOME-D", name="Homeroom Department")
    other_department = Department(university_id=university.id, code="OTHER-D", name="Other Department")
    db.add_all([department, other_department])
    await db.flush()
    program = Program(department_id=department.id, code="HOME-P", name="Homeroom Program")
    other_program = Program(department_id=other_department.id, code="OTHER-P", name="Other Program")
    db.add_all([program, other_program])
    await db.flush()
    cohort = Cohort(code="K21-HOME", year_start=2021)
    db.add(cohort)
    await db.flush()
    lecturer_user = User(
        id="homeroom-lecturer",
        email="homeroom.lecturer@example.com",
        hashed_password=hash_password("password123"),
        full_name="Homeroom Lecturer",
        role=UserRole.lecturer,
        department_id=department.id,
    )
    manager = User(
        id="homeroom-manager",
        email="homeroom.manager@example.com",
        hashed_password=hash_password("password123"),
        full_name="Homeroom Manager",
        role=UserRole.manager,
        department_id=department.id,
    )
    db.add_all([lecturer_user, manager])
    await db.flush()
    teacher = Teacher(
        user_id=lecturer_user.id,
        department_id=department.id,
        code="HOME-T",
        full_name="Homeroom Lecturer",
    )
    other_teacher = Teacher(department_id=other_department.id, code="OTHER-T", full_name="Other Teacher")
    db.add_all([teacher, other_teacher])
    await db.flush()
    own_student = Student(program_id=program.id, cohort_id=cohort.id, student_code="HOME-S1", full_name="Student One", class_code="K21-A")
    second_student = Student(program_id=program.id, cohort_id=cohort.id, student_code="HOME-S2", full_name="Student Two", class_code="K21-A")
    other_student = Student(program_id=other_program.id, cohort_id=cohort.id, student_code="OTHER-S", full_name="Other Student", class_code="K21-B")
    db.add_all([own_student, second_student, other_student])
    await db.flush()
    assignment = HomeroomAssignment(teacher_id=teacher.id, class_code="K21-A")
    other_assignment = HomeroomAssignment(teacher_id=other_teacher.id, class_code="K21-B")
    db.add_all([assignment, other_assignment])
    await db.flush()
    return {
        "lecturer": lecturer_user,
        "manager": manager,
        "teacher": teacher,
        "other_teacher": other_teacher,
        "own_student": own_student,
        "other_student": other_student,
    }


async def test_lecturer_sees_only_assigned_homeroom_class(client: AsyncClient, db_session: AsyncSession) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    classes = await client.get("/api/v1/homeroom/classes")
    own_detail = await client.get("/api/v1/homeroom/classes/K21-A")
    denied_detail = await client.get("/api/v1/homeroom/classes/K21-B")

    assert classes.status_code == 200
    assert [item["class_code"] for item in classes.json()] == ["K21-A"]
    assert own_detail.status_code == 200
    assert len(own_detail.json()["students"]) == 2
    assert denied_detail.status_code == 404


async def test_manager_cannot_assign_teacher_outside_department(client: AsyncClient, db_session: AsyncSession) -> None:
    data = await _seed_homeroom_data(db_session)
    manager = data["manager"]
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.post(
        "/api/v1/homeroom/assignments",
        json={"teacher_id": data["other_teacher"].id, "class_code": "K21-B"},
    )
    assert response.status_code == 403


async def test_lecturer_cannot_open_student_outside_homeroom(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    response = await client.get(f"/api/v1/homeroom/students/{data['other_student'].id}/analytics")

    assert response.status_code == 404


async def test_lecturer_student_scope_includes_assigned_homeroom(db_session: AsyncSession) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]

    assert await can_access_student(db_session, lecturer, data["own_student"].id)
    assert not await can_access_student(db_session, lecturer, data["other_student"].id)


def test_academic_risk_prioritizes_status_and_keeps_stable_students_normal() -> None:
    expelled = _academic_risk(
        status_value="expelled",
        cumulative_gpa=3.0,
        failed_courses=0,
    )
    stable = _academic_risk(
        status_value="active",
        cumulative_gpa=3.2,
        failed_courses=0,
        latest_gpa=3.3,
        gpa_delta=0.1,
    )

    assert expelled["level"] == "high"
    assert "buộc thôi học" in expelled["reasons"][0]
    assert stable["level"] == "normal"

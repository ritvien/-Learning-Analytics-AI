"""Tests for bulk grade import."""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import Course, Department, Program, Semester, University
from app.models.people import Cohort, Student, Teacher, User, UserRole
from app.models.teaching import Enrollment, GradeComponent, GradeComponentType, Section


async def test_import_grades_updates_final_and_component_scores(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    university = University(code="EPU", name="Electric Power University")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="CNTT", name="Cong nghe thong tin")
    db_session.add(department)
    await db_session.flush()
    program = Program(department_id=department.id, code="SE", name="Software Engineering")
    course = Course(department_id=department.id, code="IT101", name="Intro IT", credits=3)
    cohort = Cohort(code="K99", year_start=2026)
    semester = Semester(code="2026-1", name="HK1 2026", year=2026, term=1)
    db_session.add_all([program, course, cohort, semester])
    await db_session.flush()
    student = Student(program_id=program.id, cohort_id=cohort.id, student_code="SV001", full_name="Test Student")
    section = Section(course_id=course.id, semester_id=semester.id, section_code="01")
    db_session.add_all([student, section])
    await db_session.flush()
    enrollment = Enrollment(student_id=student.id, section_id=section.id, registered_credits=3)
    db_session.add(enrollment)
    await db_session.flush()

    response = await client.post(
        "/api/v1/grades/import",
        json={
            "rows": [
                {
                    "student_code": "SV001",
                    "section_code": "01",
                    "course_code": "IT101",
                    "final_grade": 8.2,
                },
                {
                    "student_code": "SV001",
                    "section_code": "01",
                    "course_code": "IT101",
                    "component_name": "Midterm",
                    "component_score": 7.5,
                },
            ]
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["updated_rows"] == 2
    assert result["skipped_rows"] == 0

    await db_session.refresh(enrollment)
    assert float(enrollment.final_grade) == 8.2
    assert enrollment.grade_letter == "B+"

    component_type = (
        await db_session.execute(select(GradeComponentType).where(GradeComponentType.name == "Midterm"))
    ).scalar_one_or_none()
    assert component_type is not None
    component = (
        await db_session.execute(select(GradeComponent).where(GradeComponent.enrollment_id == enrollment.id))
    ).scalar_one_or_none()
    assert component is not None
    assert float(component.score) == 7.5


async def test_lecturer_can_import_only_own_section_grades(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    university = University(code="EPU2", name="Electric Power University 2")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="DTVT", name="Dien tu vien thong")
    db_session.add(department)
    await db_session.flush()
    teacher_user = User(
        id="lecturer-user",
        email="lecturer@example.com",
        hashed_password=hash_password("password123"),
        full_name="Lecturer",
        role=UserRole.lecturer,
        department_id=department.id,
    )
    teacher = Teacher(user_id=teacher_user.id, department_id=department.id, full_name="Lecturer")
    program = Program(department_id=department.id, code="TEL", name="Telecom")
    course = Course(department_id=department.id, code="TEL101", name="Signals", credits=3)
    cohort = Cohort(code="K98", year_start=2026)
    semester = Semester(code="2026-2", name="HK2 2026", year=2026, term=2)
    db_session.add_all([teacher_user, teacher, program, course, cohort, semester])
    await db_session.flush()
    own_section = Section(course_id=course.id, teacher_id=teacher.id, semester_id=semester.id, section_code="OWN")
    other_section = Section(course_id=course.id, teacher_id=None, semester_id=semester.id, section_code="OTHER")
    student = Student(program_id=program.id, cohort_id=cohort.id, student_code="SV002", full_name="Own Student")
    other_student = Student(program_id=program.id, cohort_id=cohort.id, student_code="SV003", full_name="Other Student")
    db_session.add_all([own_section, other_section, student, other_student])
    await db_session.flush()
    own_enrollment = Enrollment(student_id=student.id, section_id=own_section.id, registered_credits=3)
    other_enrollment = Enrollment(student_id=other_student.id, section_id=other_section.id, registered_credits=3)
    db_session.add_all([own_enrollment, other_enrollment])
    await db_session.flush()

    client.headers["Authorization"] = f"Bearer {create_access_token(teacher_user.id, teacher_user.role)}"
    response = await client.post(
        "/api/v1/grades/import",
        json={
            "rows": [
                {"student_code": "SV002", "section_code": "OWN", "course_code": "TEL101", "component_name": "Midterm", "component_score": 8},
                {"student_code": "SV003", "section_code": "OTHER", "course_code": "TEL101", "component_name": "Midterm", "component_score": 8},
            ]
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["updated_rows"] == 1
    assert result["skipped_rows"] == 1

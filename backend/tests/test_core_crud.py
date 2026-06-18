"""Integration tests for the core academic and grade-management workflow."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import Semester, University
from app.models.people import Cohort
from app.models.teaching import GradeComponentType


async def test_core_crud_workflow(client: AsyncClient, db_session: AsyncSession) -> None:
    """Create and connect the core entities through their public APIs."""
    university = University(code="EPU", name="Electric Power University")
    cohort = Cohort(code="K22", year_start=2022, year_end=2026)
    semester = Semester(code="2026-1", name="Semester 1 2026", year=2026, term=1)
    db_session.add_all([university, cohort, semester])
    await db_session.flush()

    department = (
        await client.post(
            "/api/v1/departments",
            json={"university_id": university.id, "code": "IT", "name": "Information Technology"},
        )
    ).json()
    program = (
        await client.post(
            "/api/v1/programs",
            json={"department_id": department["id"], "code": "SE", "name": "Software Engineering"},
        )
    ).json()

    course_response = await client.post(
        "/api/v1/courses",
        json={"program_ids": [program["id"]], "code": "ML101", "name": "Machine Learning", "credits": 3},
    )
    assert course_response.status_code == 201
    course = course_response.json()
    assert course["program_ids"] == [program["id"]]

    filtered_courses = await client.get(f"/api/v1/courses?program_id={program['id']}")
    assert [item["id"] for item in filtered_courses.json()] == [course["id"]]

    teacher = (
        await client.post(
            "/api/v1/teachers",
            json={"department_id": department["id"], "code": "GV01", "full_name": "Lecturer One"},
        )
    ).json()
    student = (
        await client.post(
            "/api/v1/students",
            json={
                "program_id": program["id"],
                "cohort_id": cohort.id,
                "student_code": "SV001",
                "full_name": "Student One",
            },
        )
    ).json()
    section = (
        await client.post(
            "/api/v1/sections",
            json={
                "course_id": course["id"],
                "teacher_id": teacher["id"],
                "semester_id": semester.id,
                "section_code": "ML101-01",
            },
        )
    ).json()

    enrollment_response = await client.post(
        "/api/v1/grades/enrollments",
        json={"student_id": student["id"], "section_id": section["id"]},
    )
    assert enrollment_response.status_code == 201
    enrollment = enrollment_response.json()

    grade_response = await client.patch(
        f"/api/v1/grades/enrollments/{enrollment['id']}/grade",
        json={"final_grade": 8.0},
    )
    assert grade_response.status_code == 200
    assert grade_response.json()["is_passed"] is True

    component_type = GradeComponentType(section_id=section["id"], name="Midterm", weight=40)
    db_session.add(component_type)
    await db_session.flush()

    component_response = await client.put(
        "/api/v1/grades/components",
        json={
            "enrollment_id": enrollment["id"],
            "component_type_id": component_type.id,
            "score": 7.5,
        },
    )
    assert component_response.status_code == 200
    assert component_response.json()["score"] == 7.5

    update_student = await client.patch(f"/api/v1/students/{student['id']}", json={"status": "graduated"})
    assert update_student.status_code == 200
    assert update_student.json()["status"] == "graduated"

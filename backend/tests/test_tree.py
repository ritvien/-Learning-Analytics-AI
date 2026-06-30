"""Integration tests for the Academic Tree metrics API."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import Department, Program, Semester, University
from app.models.people import Cohort, User, UserRole


async def test_academic_tree_returns_rollup_metrics(client: AsyncClient, db_session: AsyncSession) -> None:
    university = University(code="EPU", name="Electric Power University")
    cohort = Cohort(code="K23", year_start=2023, year_end=2027)
    semester = Semester(code="2026-2", name="Semester 2 2026", year=2026, term=2)
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
    course = (
        await client.post(
            "/api/v1/courses",
            json={"program_ids": [program["id"]], "code": "DB101", "name": "Databases", "credits": 3},
        )
    ).json()
    specialization = (
        await client.post(
            "/api/v1/specializations",
            json={
                "program_id": program["id"],
                "code": "SE-TRACK",
                "name": "Software Engineering Track",
                "course_ids": [course["id"]],
            },
        )
    ).json()
    student = (
        await client.post(
            "/api/v1/students",
            json={
                "program_id": program["id"],
                "specialization_id": specialization["id"],
                "cohort_id": cohort.id,
                "student_code": "SVTREE01",
                "full_name": "Tree Student",
                "gpa_cumulative": 3.2,
            },
        )
    ).json()
    section = (
        await client.post(
            "/api/v1/sections",
            json={"course_id": course["id"], "semester_id": semester.id, "section_code": "DB101-01"},
        )
    ).json()
    enrollment = (
        await client.post(
            "/api/v1/grades/enrollments",
            json={"student_id": student["id"], "section_id": section["id"]},
        )
    ).json()
    await client.patch(f"/api/v1/grades/enrollments/{enrollment['id']}/grade", json={"final_grade": 8.0})

    response = await client.get("/api/v1/tree")
    assert response.status_code == 200
    tree = response.json()
    assert tree["type"] == "school"
    assert tree["metrics"]["student_count"] == 1
    assert tree["metrics"]["pass_rate"] == 100.0

    department_node = tree["children"][0]
    program_node = department_node["children"][0]
    specialization_node = next(
        node for node in program_node["children"] if node["id"] == specialization["id"]
    )
    course_node = specialization_node["children"][0]
    assert department_node["type"] == "department"
    assert program_node["type"] == "program"
    assert specialization_node["type"] == "specialization"
    assert course_node["type"] == "course"
    assert specialization_node["metrics"]["student_count"] == 1
    assert specialization_node["metrics"]["completed_enrollments"] == 1
    assert course_node["metrics"]["avg_grade"] == 8.0

    metrics_response = await client.get(f"/api/v1/tree/course/{course['id']}/metrics")
    assert metrics_response.status_code == 200
    assert metrics_response.json()["metrics"]["completed_enrollments"] == 1

    specialization_metrics = await client.get(
        f"/api/v1/tree/specialization/{specialization['id']}/metrics"
    )
    assert specialization_metrics.status_code == 200
    assert specialization_metrics.json()["metrics"]["pass_rate"] == 100.0


async def test_scoped_users_see_full_academic_tree_overview(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    university = University(code="TREE-ALL", name="Tree Overview University")
    db_session.add(university)
    await db_session.flush()
    own_department = Department(university_id=university.id, code="OWN", name="Own Department")
    other_department = Department(university_id=university.id, code="OTHER", name="Other Department")
    db_session.add_all([own_department, other_department])
    await db_session.flush()
    db_session.add_all(
        [
            Program(department_id=own_department.id, code="OWN-P", name="Own Program"),
            Program(department_id=other_department.id, code="OTHER-P", name="Other Program"),
        ]
    )
    manager = User(
        id="tree-overview-manager",
        email="tree.overview.manager@example.com",
        hashed_password=hash_password("password123"),
        full_name="Tree Overview Manager",
        role=UserRole.manager,
        department_id=own_department.id,
    )
    db_session.add(manager)
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.get("/api/v1/tree")

    assert response.status_code == 200
    department_names = {item["label"] for item in response.json()["children"]}
    assert department_names == {"Own Department", "Other Department"}

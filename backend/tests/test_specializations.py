"""CRUD and RBAC coverage for academic specializations."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import University
from app.models.people import User, UserRole


async def _create_program_and_course(
    client: AsyncClient,
    university_id: int,
    suffix: str,
) -> tuple[dict, dict, dict]:
    department = (
        await client.post(
            "/api/v1/departments",
            json={"university_id": university_id, "code": f"D{suffix}", "name": f"Department {suffix}"},
        )
    ).json()
    program = (
        await client.post(
            "/api/v1/programs",
            json={"department_id": department["id"], "code": f"P{suffix}", "name": f"Program {suffix}"},
        )
    ).json()
    course = (
        await client.post(
            "/api/v1/courses",
            json={"program_ids": [program["id"]], "code": f"C{suffix}", "name": f"Course {suffix}", "credits": 3},
        )
    ).json()
    return department, program, course


async def test_specialization_crud_and_program_course_validation(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    university = University(code="EPU-SPEC", name="Specialization University")
    db_session.add(university)
    await db_session.flush()
    _, program_a, course_a = await _create_program_and_course(client, university.id, "A")
    _, program_b, course_b = await _create_program_and_course(client, university.id, "B")

    create_response = await client.post(
        "/api/v1/specializations",
        json={
            "program_id": program_a["id"],
            "code": "AI",
            "name": "Artificial Intelligence",
            "course_ids": [course_a["id"]],
        },
    )
    assert create_response.status_code == 201
    specialization = create_response.json()
    assert specialization["course_ids"] == [course_a["id"]]

    invalid_response = await client.post(
        "/api/v1/specializations",
        json={
            "program_id": program_a["id"],
            "code": "INVALID",
            "name": "Invalid Track",
            "course_ids": [course_b["id"]],
        },
    )
    assert invalid_response.status_code == 400

    update_response = await client.patch(
        f"/api/v1/specializations/{specialization['id']}",
        json={"name": "Applied Artificial Intelligence"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Applied Artificial Intelligence"

    program_list = await client.get(f"/api/v1/specializations?program_id={program_b['id']}")
    assert program_list.status_code == 200
    assert all(item["program_id"] == program_b["id"] for item in program_list.json())


async def test_specialization_rbac_inherits_program_department(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    university = University(code="EPU-RBAC", name="RBAC University")
    db_session.add(university)
    await db_session.flush()
    department_a, program_a, course_a = await _create_program_and_course(client, university.id, "RA")
    _, program_b, course_b = await _create_program_and_course(client, university.id, "RB")

    specialization_a = (
        await client.post(
            "/api/v1/specializations",
            json={
                "program_id": program_a["id"],
                "code": "TRACK-A",
                "name": "Track A",
                "course_ids": [course_a["id"]],
            },
        )
    ).json()
    specialization_b = (
        await client.post(
            "/api/v1/specializations",
            json={
                "program_id": program_b["id"],
                "code": "TRACK-B",
                "name": "Track B",
                "course_ids": [course_b["id"]],
            },
        )
    ).json()

    manager = User(
        id="specialization-manager",
        email="specialization-manager@example.com",
        hashed_password=hash_password("password123"),
        full_name="Specialization Manager",
        role=UserRole.manager,
        department_id=department_a["id"],
    )
    db_session.add(manager)
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    list_response = await client.get("/api/v1/specializations")
    assert list_response.status_code == 200
    visible_ids = {item["id"] for item in list_response.json()}
    assert specialization_a["id"] in visible_ids
    assert specialization_b["id"] not in visible_ids

    hidden_response = await client.get(f"/api/v1/specializations/{specialization_b['id']}")
    assert hidden_response.status_code == 404

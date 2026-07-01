"""RBAC and Scope security tests for Section endpoints."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import Course, Department, Semester, University
from app.models.people import Teacher, User, UserRole
from app.models.teaching import Section


async def _create_user(db_session: AsyncSession, *, role: UserRole, department_id: int | None) -> User:
    user = User(
        id=f"{role.value}-section-rbac-user",
        email=f"{role.value}.section.rbac@example.com",
        hashed_password=hash_password("password123"),
        full_name=f"{role.value.title()} RBAC Test",
        role=role,
        department_id=department_id,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _create_test_data(db_session: AsyncSession) -> dict:
    university = University(code="TEST-UNI", name="Test University")
    db_session.add(university)
    await db_session.flush()

    dept_allowed = Department(university_id=university.id, code="D-ALLOW", name="Allowed Dept")
    dept_denied = Department(university_id=university.id, code="D-DENY", name="Denied Dept")
    db_session.add_all([dept_allowed, dept_denied])
    await db_session.flush()

    course_allowed = Course(department_id=dept_allowed.id, code="C-ALLOW", name="Allowed Course", credits=3)
    course_denied = Course(department_id=dept_denied.id, code="C-DENY", name="Denied Course", credits=3)
    db_session.add_all([course_allowed, course_denied])
    await db_session.flush()

    semester = Semester(code="SEM-2026", name="Semester 2026", year=2026, term=1)
    db_session.add(semester)
    await db_session.flush()

    teacher_allowed = Teacher(
        department_id=dept_allowed.id,
        code="T-ALLOW",
        full_name="Teacher Allowed",
        is_active=True,
    )
    teacher_denied = Teacher(
        department_id=dept_denied.id,
        code="T-DENY",
        full_name="Teacher Denied",
        is_active=True,
    )
    db_session.add_all([teacher_allowed, teacher_denied])
    await db_session.flush()

    section_allowed = Section(
        course_id=course_allowed.id,
        semester_id=semester.id,
        section_code="SEC-ALLOW-1",
        is_active=True,
    )
    section_denied = Section(
        course_id=course_denied.id,
        semester_id=semester.id,
        section_code="SEC-DENY-1",
        is_active=True,
    )
    db_session.add_all([section_allowed, section_denied])
    await db_session.flush()

    return {
        "dept_allowed": dept_allowed,
        "dept_denied": dept_denied,
        "course_allowed": course_allowed,
        "course_denied": course_denied,
        "semester": semester,
        "teacher_allowed": teacher_allowed,
        "teacher_denied": teacher_denied,
        "section_allowed": section_allowed,
        "section_denied": section_denied,
    }


async def test_lecturer_cannot_mutate_sections(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    data = await _create_test_data(db_session)
    lecturer = await _create_user(db_session, role=UserRole.lecturer, department_id=data["dept_allowed"].id)
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    # POST
    resp = await client.post("/api/v1/sections", json={
        "course_id": data["course_allowed"].id,
        "semester_id": data["semester"].id,
        "section_code": "SEC-NEW",
    })
    assert resp.status_code == 403

    # PATCH
    resp = await client.patch(f"/api/v1/sections/{data['section_allowed'].id}", json={
        "room": "B202"
    })
    assert resp.status_code == 403

    # DELETE
    resp = await client.delete(f"/api/v1/sections/{data['section_allowed'].id}")
    assert resp.status_code == 403


async def test_lecturer_reads_department_courses_but_only_assigned_sections(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    data = await _create_test_data(db_session)
    lecturer = await _create_user(db_session, role=UserRole.lecturer, department_id=None)
    data["teacher_allowed"].user_id = lecturer.id
    data["section_allowed"].teacher_id = data["teacher_allowed"].id
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    courses_response = await client.get("/api/v1/courses")
    assert courses_response.status_code == 200
    course_ids = {item["id"] for item in courses_response.json()}
    assert data["course_allowed"].id in course_ids
    assert data["course_denied"].id not in course_ids

    own_course_response = await client.get(f"/api/v1/courses/{data['course_allowed'].id}")
    denied_course_response = await client.get(f"/api/v1/courses/{data['course_denied'].id}")
    assert own_course_response.status_code == 200
    assert denied_course_response.status_code == 404

    sections_response = await client.get("/api/v1/sections")
    assert sections_response.status_code == 200
    section_ids = {item["id"] for item in sections_response.json()}
    assert section_ids == {data["section_allowed"].id}


async def test_manager_scope_check_on_create(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    data = await _create_test_data(db_session)
    manager = await _create_user(db_session, role=UserRole.manager, department_id=data["dept_allowed"].id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    # Create inside department - OK
    resp = await client.post("/api/v1/sections", json={
        "course_id": data["course_allowed"].id,
        "semester_id": data["semester"].id,
        "section_code": "SEC-NEW-OK",
        "teacher_id": data["teacher_allowed"].id,
    })
    assert resp.status_code == 201

    # Create outside department course - 403
    resp = await client.post("/api/v1/sections", json={
        "course_id": data["course_denied"].id,
        "semester_id": data["semester"].id,
        "section_code": "SEC-NEW-DENY",
    })
    assert resp.status_code == 403

    # Create inside department but assign outside department teacher - 403
    resp = await client.post("/api/v1/sections", json={
        "course_id": data["course_allowed"].id,
        "semester_id": data["semester"].id,
        "section_code": "SEC-NEW-DENY-2",
        "teacher_id": data["teacher_denied"].id,
    })
    assert resp.status_code == 403


async def test_manager_scope_check_on_patch(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    data = await _create_test_data(db_session)
    manager = await _create_user(db_session, role=UserRole.manager, department_id=data["dept_allowed"].id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    # Patch inside department - OK
    resp = await client.patch(f"/api/v1/sections/{data['section_allowed'].id}", json={
        "teacher_id": data["teacher_allowed"].id,
        "room": "C101"
    })
    assert resp.status_code == 200

    # Patch outside department section - 403
    resp = await client.patch(f"/api/v1/sections/{data['section_denied'].id}", json={
        "room": "C101"
    })
    assert resp.status_code == 403

    # Patch inside department section but assign outside teacher - 403
    resp = await client.patch(f"/api/v1/sections/{data['section_allowed'].id}", json={
        "teacher_id": data["teacher_denied"].id
    })
    assert resp.status_code == 403


async def test_manager_scope_check_on_delete(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    data = await _create_test_data(db_session)
    manager = await _create_user(db_session, role=UserRole.manager, department_id=data["dept_allowed"].id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    # Delete outside department section - 403
    resp = await client.delete(f"/api/v1/sections/{data['section_denied'].id}")
    assert resp.status_code == 403

    # Delete inside department section - 204
    resp = await client.delete(f"/api/v1/sections/{data['section_allowed'].id}")
    assert resp.status_code == 204

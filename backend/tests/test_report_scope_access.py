"""Report scope RBAC tests."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import can_create_report_scope, can_view_report_scope
from app.agent.report_tools import list_report_scope_options
from app.models.academic import Course, Department, Program, Semester, University
from app.models.people import Teacher, User, UserRole
from app.models.teaching import Section


async def _seed_report_scope_fixture(db_session: AsyncSession) -> dict[str, object]:
    university = University(code="RPT-U", name="Report University")
    db_session.add(university)
    await db_session.flush()

    own_department = Department(university_id=university.id, code="RPT-D1", name="Own Department")
    other_department = Department(university_id=university.id, code="RPT-D2", name="Other Department")
    db_session.add_all([own_department, other_department])
    await db_session.flush()

    own_program = Program(department_id=own_department.id, code="RPT-P1", name="Own Program")
    other_program = Program(department_id=other_department.id, code="RPT-P2", name="Other Program")
    own_course = Course(department_id=own_department.id, code="RPT-C1", name="Own Course", credits=3)
    other_course = Course(department_id=other_department.id, code="RPT-C2", name="Other Course", credits=3)
    own_course.programs.append(own_program)
    other_course.programs.append(other_program)
    semester = Semester(code="RPT-SEM", name="Report Semester", year=2026, term=1)
    db_session.add_all([own_program, other_program, own_course, other_course, semester])
    await db_session.flush()

    lecturer_user = User(
        id="report-lecturer",
        email="report.lecturer@example.com",
        hashed_password="x",
        full_name="Report Lecturer",
        role=UserRole.lecturer,
        department_id=own_department.id,
    )
    manager_user = User(
        id="report-manager",
        email="report.manager@example.com",
        hashed_password="x",
        full_name="Report Manager",
        role=UserRole.manager,
        department_id=own_department.id,
    )
    admin_user = User(
        id="report-admin",
        email="report.admin@example.com",
        hashed_password="x",
        full_name="Report Admin",
        role=UserRole.superadmin,
    )
    db_session.add_all([lecturer_user, manager_user, admin_user])
    await db_session.flush()

    teacher = Teacher(
        user_id=lecturer_user.id,
        department_id=own_department.id,
        code="RPT-T1",
        full_name="Report Lecturer",
        email="report.lecturer@example.com",
    )
    db_session.add(teacher)
    await db_session.flush()

    own_section = Section(
        course_id=own_course.id,
        semester_id=semester.id,
        teacher_id=teacher.id,
        section_code="OWN-01",
    )
    other_section = Section(
        course_id=other_course.id,
        semester_id=semester.id,
        section_code="OTHER-01",
    )
    db_session.add_all([own_section, other_section])
    await db_session.flush()

    return {
        "lecturer": lecturer_user,
        "manager": manager_user,
        "admin": admin_user,
        "own_department": own_department,
        "other_department": other_department,
        "own_program": own_program,
        "other_program": other_program,
        "own_course": own_course,
        "other_course": other_course,
        "own_section": own_section,
        "other_section": other_section,
    }


async def test_lecturer_report_scope_is_limited_to_own_course_and_section(db_session: AsyncSession) -> None:
    data = await _seed_report_scope_fixture(db_session)
    lecturer = data["lecturer"]
    own_course = data["own_course"]
    other_course = data["other_course"]
    own_section = data["own_section"]
    other_section = data["other_section"]

    assert await can_create_report_scope(db_session, lecturer, "course_health", "course", str(own_course.id))
    assert await can_create_report_scope(db_session, lecturer, "section_intervention", "section", str(own_section.id))
    assert not await can_create_report_scope(db_session, lecturer, "course_health", "course", str(other_course.id))
    assert not await can_create_report_scope(
        db_session,
        lecturer,
        "section_intervention",
        "section",
        str(other_section.id),
    )
    assert not await can_create_report_scope(db_session, lecturer, "program_health", "program", "1")
    assert not await can_create_report_scope(db_session, lecturer, "department_health", "department", "1")
    assert not await can_create_report_scope(db_session, lecturer, "school_overview", "school", None)


async def test_manager_report_scope_is_limited_to_department(db_session: AsyncSession) -> None:
    data = await _seed_report_scope_fixture(db_session)
    manager = data["manager"]
    own_department = data["own_department"]
    other_department = data["other_department"]
    own_program = data["own_program"]
    other_program = data["other_program"]

    assert await can_create_report_scope(db_session, manager, "department_health", "department", str(own_department.id))
    assert await can_create_report_scope(db_session, manager, "program_health", "program", str(own_program.id))
    assert not await can_create_report_scope(
        db_session,
        manager,
        "department_health",
        "department",
        str(other_department.id),
    )
    assert not await can_create_report_scope(db_session, manager, "program_health", "program", str(other_program.id))
    assert not await can_create_report_scope(db_session, manager, "school_overview", "school", None)


async def test_report_type_must_match_scope_type(db_session: AsyncSession) -> None:
    data = await _seed_report_scope_fixture(db_session)
    admin = data["admin"]
    own_department = data["own_department"]

    assert not await can_create_report_scope(
        db_session,
        admin,
        "course_health",
        "department",
        str(own_department.id),
    )
    assert not await can_view_report_scope(
        db_session,
        admin,
        "program_health",
        "course",
        "not-a-number",
    )
    assert await can_create_report_scope(db_session, admin, "school_overview", "school", None)


async def test_scope_discovery_returns_only_actor_allowed_options(db_session: AsyncSession) -> None:
    data = await _seed_report_scope_fixture(db_session)

    admin_departments = await list_report_scope_options(
        db_session, data["admin"], scope_type="department"
    )
    assert {item["id"] for item in admin_departments["options"]} == {
        str(data["own_department"].id),
        str(data["other_department"].id),
    }

    manager_programs = await list_report_scope_options(
        db_session, data["manager"], scope_type="program"
    )
    assert {item["id"] for item in manager_programs["options"]} == {
        str(data["own_program"].id)
    }

    lecturer_courses = await list_report_scope_options(
        db_session, data["lecturer"], scope_type="course"
    )
    assert {item["id"] for item in lecturer_courses["options"]} == {
        str(data["own_course"].id)
    }
    lecturer_sections = await list_report_scope_options(
        db_session, data["lecturer"], scope_type="section"
    )
    assert {item["id"] for item in lecturer_sections["options"]} == {
        str(data["own_section"].id)
    }

    viewer = User(
        id="report-viewer",
        email="report.viewer@example.com",
        hashed_password="x",
        full_name="Report Viewer",
        role=UserRole.viewer,
        department_id=data["own_department"].id,
    )
    db_session.add(viewer)
    await db_session.flush()
    viewer_options = await list_report_scope_options(db_session, viewer, scope_type="program")
    assert viewer_options["status"] == "no_report_permission"
    assert viewer_options["options"] == []

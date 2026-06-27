"""Integration tests for recurring report schedules."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import Course, Department, Program, Semester, University
from app.models.people import Cohort, Student, Teacher, User, UserRole
from app.models.report import ReportSchedule, ReportScheduleRun
from app.models.teaching import Enrollment, Section
from app.reports.scheduler import MIDTERM_FREQUENCY, MIDTERM_TRIGGER, run_due_schedules, run_grade_update_schedules


async def test_create_list_and_run_report_schedule(client: AsyncClient) -> None:
    create_response = await client.post(
        "/api/v1/reports/schedules",
        json={
            "name": "Weekly school health",
            "report_type": "school_overview",
            "actor_role": "manager",
            "scope_type": "school",
            "scope_id": None,
            "frequency": "weekly",
            "trigger_event": "scheduled_monday",
            "recipients_json": ["manager"],
            "formats_json": ["web", "pdf"],
            "detail_level": "standard",
            "include_ai_narrative": True,
            "include_appendix": True,
        },
    )

    assert create_response.status_code == 201
    schedule = create_response.json()
    assert schedule["id"]
    assert schedule["next_run_at"]

    list_response = await client.get("/api/v1/reports/schedules")
    assert list_response.status_code == 200
    assert any(item["id"] == schedule["id"] for item in list_response.json())

    run_response = await client.post(
        f"/api/v1/reports/schedules/{schedule['id']}/run",
        json={"trigger": "manual"},
    )
    assert run_response.status_code == 201
    run = run_response.json()
    assert run["status"] == "success"
    assert run["report_id"]

    runs_response = await client.get(f"/api/v1/reports/schedules/{schedule['id']}/runs")
    assert runs_response.status_code == 200
    assert runs_response.json()[0]["report_id"] == run["report_id"]


async def test_lecturer_can_schedule_only_own_section(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    university = University(code="LECT-U", name="Lecturer University")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="LECT-D", name="Lecturer Department")
    db_session.add(department)
    await db_session.flush()
    course = Course(department_id=department.id, code="LECT-C", name="Lecturer Course", credits=3)
    semester = Semester(code="LECT-SEM", name="Lecturer Semester", year=2026, term=1)
    user = User(
        id="schedule-lecturer",
        email="schedule.lecturer@example.com",
        hashed_password=hash_password("password123"),
        full_name="Schedule Lecturer",
        role=UserRole.lecturer,
        department_id=department.id,
    )
    db_session.add_all([course, semester, user])
    await db_session.flush()
    teacher = Teacher(
        user_id=user.id,
        department_id=department.id,
        code="LECT-T",
        full_name="Schedule Lecturer",
        email="schedule.lecturer@example.com",
    )
    db_session.add(teacher)
    await db_session.flush()
    own_section = Section(
        course_id=course.id,
        semester_id=semester.id,
        teacher_id=teacher.id,
        section_code="OWN-01",
    )
    other_section = Section(course_id=course.id, semester_id=semester.id, section_code="OTHER-01")
    db_session.add_all([own_section, other_section])
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(user.id, user.role)}"

    payload = {
        "name": "My weekly section report",
        "report_type": "section_intervention",
        "actor_role": "lecturer",
        "scope_type": "section",
        "frequency": "weekly",
        "recipients_json": ["lecturer"],
        "formats_json": ["web"],
    }
    own_response = await client.post(
        "/api/v1/reports/schedules",
        json={**payload, "scope_id": str(own_section.id)},
    )
    denied_response = await client.post(
        "/api/v1/reports/schedules",
        json={**payload, "scope_id": str(other_section.id)},
    )

    assert own_response.status_code == 201
    assert denied_response.status_code == 403


async def test_due_report_schedule_runs_from_worker(db_session: AsyncSession) -> None:
    schedule = ReportSchedule(
        name="Due monthly overview",
        report_type="school_overview",
        actor_role="manager",
        scope_type="school",
        scope_id=None,
        frequency="monthly",
        recipients_json=["manager"],
        formats_json=["web"],
        detail_level="standard",
        include_ai_narrative=True,
        include_appendix=True,
        is_active=True,
        next_run_at=datetime.now(UTC) - timedelta(minutes=5),
        created_by="test-admin",
    )
    db_session.add(schedule)
    await db_session.flush()

    ran = await run_due_schedules(db_session)

    assert ran == 1
    await db_session.refresh(schedule)
    assert schedule.last_report_id
    assert schedule.last_run_at
    assert schedule.next_run_at
    assert schedule.next_run_at.replace(tzinfo=UTC) > datetime.now(UTC)

    result = await db_session.execute(select(ReportScheduleRun).where(ReportScheduleRun.schedule_id == schedule.id))
    run = result.scalar_one()
    assert run.trigger == "scheduled"
    assert run.status == "success"
    assert run.report_id == schedule.last_report_id


async def test_midterm_grade_event_runs_only_midterm_and_generic_schedules(db_session: AsyncSession) -> None:
    university = University(code="EPU", name="Electric Power University")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="CNTT", name="Cong nghe thong tin")
    db_session.add(department)
    await db_session.flush()
    program = Program(department_id=department.id, code="SE", name="Software Engineering")
    course = Course(department_id=department.id, code="SE101", name="Software Basics", credits=3)
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

    midterm_schedule = ReportSchedule(
        name="Midterm course report",
        report_type="course_health",
        actor_role="manager",
        scope_type="course",
        scope_id=str(course.id),
        frequency="midterm",
        trigger_event="midterm_grade",
        recipients_json=["manager"],
        formats_json=["web"],
        detail_level="standard",
        include_ai_narrative=True,
        include_appendix=True,
        is_active=True,
        created_by="test-admin",
    )
    generic_schedule = ReportSchedule(
        name="Any grade update course report",
        report_type="course_health",
        actor_role="manager",
        scope_type="course",
        scope_id=str(course.id),
        frequency="after_grade_update",
        recipients_json=["manager"],
        formats_json=["web"],
        detail_level="standard",
        include_ai_narrative=True,
        include_appendix=True,
        is_active=True,
        created_by="test-admin",
    )
    final_schedule = ReportSchedule(
        name="Final course report",
        report_type="course_health",
        actor_role="manager",
        scope_type="course",
        scope_id=str(course.id),
        frequency="end_semester",
        recipients_json=["manager"],
        formats_json=["web"],
        detail_level="standard",
        include_ai_narrative=True,
        include_appendix=True,
        is_active=True,
        created_by="test-admin",
    )
    db_session.add_all([midterm_schedule, generic_schedule, final_schedule])
    await db_session.flush()

    ran = await run_grade_update_schedules(
        db_session,
        enrollment_id=enrollment.id,
        schedule_frequency=MIDTERM_FREQUENCY,
        trigger=MIDTERM_TRIGGER,
    )

    assert ran == 2
    result = await db_session.execute(select(ReportScheduleRun).order_by(ReportScheduleRun.schedule_id.asc()))
    runs = list(result.scalars().all())
    assert {run.schedule_id for run in runs} == {midterm_schedule.id, generic_schedule.id}
    assert all(run.trigger == "midterm_grade" for run in runs)

"""Operational work queue coverage by actor."""

from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import Course, Department, Semester, University
from app.models.ops import OpsTask
from app.models.people import User, UserRole
from app.models.teaching import Section
from app.schemas.ops import AlertCreate
from app.services.alert_rules import create_alert_if_new
from tests.test_homeroom_rbac import _seed_homeroom_data


async def test_manager_assigns_task_and_lecturer_receives_notification(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    manager = data["manager"]
    lecturer = data["lecturer"]
    course = Course(department_id=manager.department_id, code="OPS-ASSIGN", name="Ops Assign Course", credits=3)
    db_session.add(course)
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    created = await client.post(
        "/api/v1/tasks",
        json={
            "task_type": "review_course",
            "priority": "high",
            "title": "Rà soát môn có tỷ lệ trượt cao",
            "scope_type": "course",
            "scope_id": str(course.id),
        },
    )
    assigned = await client.post(
        f"/api/v1/tasks/{created.json()['id']}/assign",
        json={"assignee_user_id": lecturer.id},
    )

    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    mine = await client.get("/api/v1/tasks/my")
    unread = await client.get("/api/v1/notifications/unread-count")
    closed = await client.post(
        f"/api/v1/tasks/{created.json()['id']}/close",
        json={"resolution_note": "Đã xử lý xong cảnh báo"},
    )
    unread_after_close = await client.get("/api/v1/notifications/unread-count")

    assert created.status_code == 201
    assert assigned.status_code == 200
    assert assigned.json()["assignee_user_id"] == lecturer.id
    assert mine.status_code == 200
    assert [row["id"] for row in mine.json()] == [created.json()["id"]]
    assert unread.json()["unread"] >= 1
    assert closed.status_code == 200
    assert unread_after_close.json()["unread"] == 0


async def test_notifications_backfill_existing_assigned_tasks_for_current_actor(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    task = OpsTask(
        task_type="student_support",
        priority="high",
        status="assigned",
        title="Theo dõi sinh viên cần hỗ trợ",
        scope_type="student",
        scope_id="123",
        assignee_user_id=lecturer.id,
        assignee_role=lecturer.role.value,
        created_by_user_id=lecturer.id,
        metadata_json={},
    )
    db_session.add(task)
    await db_session.flush()

    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    unread = await client.get("/api/v1/notifications/unread-count")
    items = await client.get("/api/v1/notifications?limit=5")

    assert unread.status_code == 200
    assert unread.json()["unread"] == 1
    assert items.status_code == 200
    assert items.json()[0]["task_id"] == task.id
    assert items.json()[0]["notification_type"] == "task_inbox_backfill"


async def test_role_assigned_task_creates_role_notification_for_actor(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    manager = User(
        id="ops-role-manager",
        email="ops.role.manager@example.com",
        hashed_password=hash_password("password123"),
        full_name="Ops Role Manager",
        role=UserRole.manager,
    )
    db_session.add(manager)
    await db_session.flush()
    created = await client.post(
        "/api/v1/tasks",
        json={
            "task_type": "review_course",
            "priority": "medium",
            "title": "Thông báo cho manager",
            "scope_type": "system",
            "scope_id": "ops",
            "assignee_role": "manager",
        },
    )

    assert created.status_code == 201
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"
    unread = await client.get("/api/v1/notifications/unread-count")
    items = await client.get("/api/v1/notifications?limit=5")

    assert unread.status_code == 200
    assert unread.json()["unread"] == 1
    assert items.status_code == 200
    assert items.json()[0]["task_id"] == created.json()["id"]
    assert items.json()[0]["recipient_role"] == "manager"


async def test_viewer_cannot_create_or_close_task(client: AsyncClient, db_session: AsyncSession) -> None:
    viewer = User(
        id="ops-viewer",
        email="ops.viewer@example.com",
        hashed_password=hash_password("password123"),
        full_name="Ops Viewer",
        role=UserRole.viewer,
    )
    db_session.add(viewer)
    await db_session.flush()

    created = await client.post(
        "/api/v1/tasks",
        json={
            "task_type": "fix_data",
            "priority": "medium",
            "title": "Admin task",
            "scope_type": "data_quality",
            "scope_id": "sample",
        },
    )
    client.headers["Authorization"] = f"Bearer {create_access_token(viewer.id, viewer.role)}"
    denied_create = await client.post(
        "/api/v1/tasks",
        json={
            "task_type": "fix_data",
            "priority": "medium",
            "title": "Denied",
            "scope_type": "data_quality",
            "scope_id": "sample",
        },
    )
    denied_close = await client.post(
        f"/api/v1/tasks/{created.json()['id']}/close",
        json={"resolution_note": "done"},
    )

    assert created.status_code == 201
    assert denied_create.status_code == 403
    assert denied_close.status_code == 403


async def test_close_task_requires_resolution_note(client: AsyncClient) -> None:
    created = await client.post(
        "/api/v1/tasks",
        json={
            "task_type": "fix_data",
            "priority": "medium",
            "title": "Close me",
            "scope_type": "data_quality",
            "scope_id": "sample",
        },
    )
    missing_resolution = await client.post(f"/api/v1/tasks/{created.json()['id']}/close", json={})
    resolved = await client.post(
        f"/api/v1/tasks/{created.json()['id']}/close",
        json={"resolution_note": "Đã kiểm tra và xử lý", "outcome": "resolved"},
    )

    assert missing_resolution.status_code == 422
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"
    assert resolved.json()["resolution_note"] == "Đã kiểm tra và xử lý"


async def test_data_quality_alert_generation_is_deduplicated(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    university = University(code="OPS-U", name="Ops University")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="OPS-D", name="Ops Department")
    db_session.add(department)
    await db_session.flush()
    course = Course(department_id=department.id, code="OPS-C", name="Ops Course", credits=3)
    semester = Semester(code="OPS-2026", name="Ops Semester", year=2026, term=1)
    db_session.add_all([course, semester])
    await db_session.flush()
    section = Section(course_id=course.id, semester_id=semester.id, section_code="OPS-SEC", is_active=True)
    db_session.add(section)
    await db_session.flush()

    first = await client.post("/api/v1/admin/alerts/generate/data-quality")
    second = await client.post("/api/v1/admin/alerts/generate/data-quality")
    alerts = await client.get("/api/v1/alerts?status=new")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["created"] >= 1
    assert second.json()["created"] == 0
    assert len(alerts.json()) >= 1


async def test_alert_convert_to_task(client: AsyncClient, db_session: AsyncSession) -> None:
    data = await _seed_homeroom_data(db_session)
    manager = data["manager"]
    course = Course(department_id=manager.department_id, code="OPS-COURSE", name="Ops Course Bottleneck", credits=3)
    db_session.add(course)
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    alert = await client.post(
        "/api/v1/alerts",
        json={
            "alert_type": "course_bottleneck",
            "severity": "high",
            "scope_type": "course",
            "scope_id": str(course.id),
            "title": "Môn cần rà soát",
            "message": "Fail rate cao ở nhiều lớp học phần",
            "source": "test",
            "dedupe_key": "test-course-bottleneck",
        },
    )
    converted = await client.post(f"/api/v1/alerts/{alert.json()['id']}/convert-to-task")

    assert alert.status_code == 201
    assert converted.status_code == 201
    assert converted.json()["task_type"] == "review_course"
    assert converted.json()["source_alert_id"] == alert.json()["id"]


async def test_my_tasks_observer_materializes_section_risk_for_actual_lecturer(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    manager = data["manager"]
    lecturer = data["lecturer"]
    teacher = data["teacher"]
    course = Course(department_id=manager.department_id, code="OPS-OBS-SEC", name="Observed Section Course", credits=3)
    semester = Semester(code="OPS-OBS-SEC-2026", name="Observed Section Semester", year=2026, term=1)
    db_session.add_all([course, semester])
    await db_session.flush()
    section = Section(
        course_id=course.id,
        teacher_id=teacher.id,
        semester_id=semester.id,
        section_code="OPS-OBS-SEC",
        is_active=True,
    )
    db_session.add(section)
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"
    alert = await client.post(
        "/api/v1/alerts",
        json={
            "alert_type": "section_risk",
            "severity": "high",
            "scope_type": "section",
            "scope_id": str(section.id),
            "title": "Lớp học phần cần xử lý",
            "message": "Fail rate cao",
            "source": "test",
            "dedupe_key": "observer-section-risk",
        },
    )

    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    mine = await client.get("/api/v1/tasks/my")

    assert alert.status_code == 201
    assert mine.status_code == 200
    assert [row["task_type"] for row in mine.json()] == ["review_section"]
    assert mine.json()[0]["source_alert_id"] == alert.json()["id"]


async def test_my_tasks_observer_materializes_course_bottleneck_for_manager(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    manager = data["manager"]
    course = Course(department_id=manager.department_id, code="OPS-OBS-COURSE", name="Observed Course", credits=3)
    db_session.add(course)
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"
    alert = await client.post(
        "/api/v1/alerts",
        json={
            "alert_type": "course_bottleneck",
            "severity": "high",
            "scope_type": "course",
            "scope_id": str(course.id),
            "title": "Môn học cần theo dõi",
            "message": "Tỷ lệ trượt cao trên nhiều lớp học phần",
            "source": "test",
            "dedupe_key": "observer-course-bottleneck",
        },
    )
    mine = await client.get("/api/v1/tasks/my")

    assert alert.status_code == 201
    assert mine.status_code == 200
    assert [row["task_type"] for row in mine.json()] == ["review_course"]
    assert mine.json()[0]["source_alert_id"] == alert.json()["id"]


async def test_alert_evidence_decimal_is_json_encoded(db_session: AsyncSession) -> None:
    alert = await create_alert_if_new(
        db_session,
        AlertCreate(
            alert_type="student_risk",
            severity="high",
            scope_type="student",
            scope_id="42",
            title="Decimal evidence",
            message="Evidence from SQL aggregates can contain Decimal values.",
            source="test",
            evidence_json={"gpa": Decimal("1.75"), "nested": {"rate": Decimal("0.70")}},
            dedupe_key="decimal-evidence",
        ),
    )

    assert alert is not None
    assert alert.evidence_json == {"gpa": 1.75, "nested": {"rate": 0.7}}

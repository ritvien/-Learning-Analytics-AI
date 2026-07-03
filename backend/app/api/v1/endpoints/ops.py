"""Operational alerts, tasks, and notification endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, DBSession
from app.models.ops import OpsAlert, OpsNotification, OpsTask
from app.models.people import User, UserRole
from app.schemas.ops import (
    AlertCreate,
    AlertResponse,
    NotificationResponse,
    TaskAssign,
    TaskClose,
    TaskCommentCreate,
    TaskCreate,
    TaskFollowUp,
    TaskResponse,
    TaskUpdate,
)
from app.services.alert_rules import (
    create_alert_if_new,
    generate_course_risk_alerts,
    generate_data_quality_alerts,
    generate_outcome_alerts,
    generate_section_risk_alerts,
    generate_student_risk_alerts,
    generate_system_alerts,
)
from app.services.notification_service import add_task_event, mark_read, notify_task_assignee, notify_user
from app.services.role_observer import observe_user_work_queue
from app.services.task_service import (
    OPEN_TASK_STATUSES,
    add_comment,
    assign_task,
    can_access_task_scope,
    can_view_task,
    close_task,
    create_task,
    require_task,
)

router = APIRouter()


def _task_type_for_alert(alert: OpsAlert) -> str:
    return {
        "student_risk": "contact_student",
        "section_risk": "review_section",
        "course_bottleneck": "review_course",
        "outcome_gap": "review_clo_plo",
        "data_quality": "fix_data",
        "system": "investigate_system",
    }.get(alert.alert_type, "review_alert")


def _priority_for_alert(alert: OpsAlert) -> str:
    return {"critical": "critical", "high": "high", "medium": "medium", "low": "low"}.get(alert.severity, "medium")


async def _can_view_alert(db: DBSession, user: CurrentUser, alert: OpsAlert) -> bool:
    if user.role in {UserRole.superadmin, UserRole.admin}:
        return True
    if user.role == UserRole.viewer:
        return False
    if alert.alert_type == "system":
        return user.role == UserRole.superadmin
    if alert.alert_type == "data_quality":
        return False
    if alert.alert_type == "student_risk":
        return user.role == UserRole.lecturer and await can_access_task_scope(db, user, alert.scope_type, alert.scope_id)
    if alert.alert_type == "section_risk":
        return user.role == UserRole.lecturer and await can_access_task_scope(db, user, alert.scope_type, alert.scope_id)
    if alert.alert_type in {"course_bottleneck", "outcome_gap"}:
        return user.role == UserRole.manager and await can_access_task_scope(db, user, alert.scope_type, alert.scope_id)
    return await can_access_task_scope(db, user, alert.scope_type, alert.scope_id)


async def _require_alert(db: DBSession, user: CurrentUser, alert_id: int, *, mutate: bool = False) -> OpsAlert:
    alert = await db.get(OpsAlert, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    allowed = await _can_view_alert(db, user, alert)
    if mutate and user.role == UserRole.lecturer:
        allowed = False
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Alert is outside your scope")
    return alert


async def _visible_tasks(db: DBSession, user: CurrentUser, rows: list[OpsTask]) -> list[OpsTask]:
    visible = []
    for row in rows:
        if await can_view_task(db, user, row):
            visible.append(row)
    return visible


async def _task_for_response(db: DBSession, task_id: int) -> OpsTask:
    return (
        await db.execute(
            select(OpsTask)
            .options(selectinload(OpsTask.events), selectinload(OpsTask.comments))
            .where(OpsTask.id == task_id)
        )
    ).scalar_one()


@router.get("/alerts", response_model=list[AlertResponse])
async def list_alerts(
    db: DBSession,
    current_user: CurrentUser,
    alert_status: str | None = Query(default=None, alias="status"),
    severity: str | None = None,
    scope_type: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[OpsAlert]:
    query = select(OpsAlert).order_by(desc(OpsAlert.created_at)).limit(limit)
    if alert_status:
        query = query.where(OpsAlert.status == alert_status)
    if severity:
        query = query.where(OpsAlert.severity == severity)
    if scope_type:
        query = query.where(OpsAlert.scope_type == scope_type)
    rows = list((await db.execute(query)).scalars().all())
    visible = []
    for row in rows:
        if await _can_view_alert(db, current_user, row):
            visible.append(row)
    return visible


@router.get("/alerts/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: int, db: DBSession, current_user: CurrentUser) -> OpsAlert:
    return await _require_alert(db, current_user, alert_id)


@router.post("/alerts", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_alert(payload: AlertCreate, db: DBSession, current_user: CurrentUser) -> OpsAlert:
    if current_user.role == UserRole.viewer:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot create alerts")
    if not await can_access_task_scope(db, current_user, payload.scope_type, payload.scope_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Alert scope is outside your permissions")
    alert = await create_alert_if_new(db, payload)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An active alert already exists")
    return alert


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(alert_id: int, db: DBSession, current_user: CurrentUser) -> OpsAlert:
    alert = await _require_alert(db, current_user, alert_id, mutate=True)
    alert.status = "acknowledged"
    await db.flush()
    return alert


@router.post("/alerts/{alert_id}/dismiss", response_model=AlertResponse)
async def dismiss_alert(alert_id: int, db: DBSession, current_user: CurrentUser) -> OpsAlert:
    alert = await _require_alert(db, current_user, alert_id, mutate=True)
    alert.status = "dismissed"
    await db.flush()
    return alert


@router.post("/alerts/{alert_id}/convert-to-task", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def convert_alert_to_task(alert_id: int, db: DBSession, current_user: CurrentUser) -> OpsTask:
    alert = await _require_alert(db, current_user, alert_id, mutate=True)
    existing = await db.scalar(
        select(OpsTask).where(OpsTask.source_alert_id == alert.id, OpsTask.status.in_(OPEN_TASK_STATUSES))
    )
    if existing is not None:
        return await _task_for_response(db, existing.id)
    task = await create_task(
        db,
        TaskCreate(
            task_type=_task_type_for_alert(alert),
            priority=_priority_for_alert(alert),
            title=alert.title,
            description=alert.message,
            scope_type=alert.scope_type,  # type: ignore[arg-type]
            scope_id=alert.scope_id,
            source_alert_id=alert.id,
            metadata_json={"alert": alert.evidence_json, "source": alert.source},
        ),
        current_user,
    )
    alert.status = "converted"
    if task.assignee_user_id is not None or task.assignee_role is not None:
        await notify_user(
            db,
            user_id=task.assignee_user_id,
            role=None if task.assignee_user_id is not None else task.assignee_role,
            task_id=task.id,
            alert_id=alert.id,
            notification_type="alert_converted",
            title=task.title,
            message="Một cảnh báo đã được chuyển thành việc cần xử lý.",
            priority=task.priority,
            link_url=f"/manager/tasks?task_id={task.id}",
        )
    await db.flush()
    return await _task_for_response(db, task.id)


@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks(
    db: DBSession,
    current_user: CurrentUser,
    task_status: str | None = Query(default=None, alias="status"),
    priority: str | None = None,
    scope_type: str | None = None,
    assignee: str | None = None,
    overdue: bool | None = None,
    limit: int = Query(default=200, ge=1, le=500),
) -> list[OpsTask]:
    query = (
        select(OpsTask)
        .options(selectinload(OpsTask.events), selectinload(OpsTask.comments))
        .order_by(desc(OpsTask.updated_at), desc(OpsTask.created_at))
        .limit(limit)
    )
    if task_status:
        query = query.where(OpsTask.status == task_status)
    if priority:
        query = query.where(OpsTask.priority == priority)
    if scope_type:
        query = query.where(OpsTask.scope_type == scope_type)
    if assignee == "me":
        await observe_user_work_queue(db, current_user)
        query = query.where(OpsTask.assignee_user_id == current_user.id)
    elif assignee:
        query = query.where(OpsTask.assignee_user_id == assignee)
    if overdue is True:
        query = query.where(OpsTask.due_at < func.now(), OpsTask.status.in_(OPEN_TASK_STATUSES))
    rows = list((await db.execute(query)).scalars().all())
    return await _visible_tasks(db, current_user, rows)


@router.get("/tasks/my", response_model=list[TaskResponse])
async def list_my_tasks(db: DBSession, current_user: CurrentUser) -> list[OpsTask]:
    await observe_user_work_queue(db, current_user)
    rows = list(
        (
            await db.execute(
                select(OpsTask)
                .options(selectinload(OpsTask.events), selectinload(OpsTask.comments))
                .where(OpsTask.assignee_user_id == current_user.id)
                .order_by(desc(OpsTask.updated_at), desc(OpsTask.created_at))
                .limit(200)
            )
        )
        .scalars()
        .all()
    )
    return await _visible_tasks(db, current_user, rows)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: DBSession, current_user: CurrentUser) -> OpsTask:
    task = await require_task(db, current_user, task_id)
    await db.refresh(task, attribute_names=["events", "comments"])
    return task


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_ops_task(payload: TaskCreate, db: DBSession, current_user: CurrentUser) -> OpsTask:
    task = await create_task(db, payload, current_user)
    return await _task_for_response(db, task.id)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, payload: TaskUpdate, db: DBSession, current_user: CurrentUser) -> OpsTask:
    task = await require_task(db, current_user, task_id, mutate=True)
    data = payload.model_dump(exclude_unset=True)
    if "assignee_user_id" in data and data["assignee_user_id"] is not None:
        assignee = await db.get(User, data["assignee_user_id"])
        if assignee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found")
        task = await assign_task(db, task=task, actor=current_user, assignee=assignee, due_at=data.get("due_at"))
        data.pop("assignee_user_id", None)
        data.pop("due_at", None)
    for key, value in data.items():
        setattr(task, key, value)
    await add_task_event(db, task_id=task.id, actor_user_id=current_user.id, event_type="updated", payload=data)
    await notify_task_assignee(db, task, current_user, notification_type="task_updated")
    await db.flush()
    return await _task_for_response(db, task.id)


@router.post("/tasks/{task_id}/assign", response_model=TaskResponse)
async def assign_ops_task(task_id: int, payload: TaskAssign, db: DBSession, current_user: CurrentUser) -> OpsTask:
    task = await require_task(db, current_user, task_id, mutate=True)
    assignee = await db.get(User, payload.assignee_user_id)
    if assignee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found")
    task = await assign_task(db, task=task, actor=current_user, assignee=assignee, due_at=payload.due_at)
    return await _task_for_response(db, task.id)


@router.post("/tasks/{task_id}/comments", response_model=TaskResponse)
async def add_task_comment(task_id: int, payload: TaskCommentCreate, db: DBSession, current_user: CurrentUser) -> OpsTask:
    task = await require_task(db, current_user, task_id, mutate=True)
    await add_comment(db, task=task, actor=current_user, comment=payload.comment)
    return await _task_for_response(db, task.id)


@router.post("/tasks/{task_id}/follow-up", response_model=TaskResponse)
async def set_task_followup(task_id: int, payload: TaskFollowUp, db: DBSession, current_user: CurrentUser) -> OpsTask:
    task = await require_task(db, current_user, task_id, mutate=True)
    task.follow_up_at = payload.follow_up_at
    task.status = "waiting_followup"
    await add_task_event(
        db,
        task_id=task.id,
        actor_user_id=current_user.id,
        event_type="followup_set",
        payload={"follow_up_at": payload.follow_up_at.isoformat(), "note": payload.note},
    )
    if task.assignee_user_id:
        await notify_user(
            db,
            user_id=task.assignee_user_id,
            task_id=task.id,
            notification_type="followup_due",
            title=task.title,
            message="Việc cần xử lý đã được đặt lịch follow-up.",
            priority=task.priority,
            link_url=f"/manager/tasks?task_id={task.id}",
        )
    await db.flush()
    return await _task_for_response(db, task.id)


@router.post("/tasks/{task_id}/close", response_model=TaskResponse)
async def close_ops_task(task_id: int, payload: TaskClose, db: DBSession, current_user: CurrentUser) -> OpsTask:
    task = await require_task(db, current_user, task_id, mutate=True)
    task = await close_task(
        db,
        task=task,
        actor=current_user,
        resolution_note=payload.resolution_note,
        outcome=payload.outcome,
        status_value=payload.status,
    )
    notifications = (
        await db.scalars(
            select(OpsNotification).where(
                OpsNotification.task_id == task.id,
                OpsNotification.read_at.is_(None),
            )
        )
    ).all()
    for notification in notifications:
        mark_read(notification)
    await db.flush()
    return await _task_for_response(db, task.id)


async def _ensure_current_user_task_notifications(db: DBSession, current_user: CurrentUser) -> None:
    """Backfill inbox rows for open tasks that predate notification wiring."""
    if current_user.role == UserRole.viewer:
        return
    existing_task_ids = set(
        (
            await db.execute(
                select(OpsNotification.task_id).where(
                    OpsNotification.task_id.is_not(None),
                    (OpsNotification.recipient_user_id == current_user.id)
                    | (OpsNotification.recipient_role == current_user.role.value),
                )
            )
        )
        .scalars()
        .all()
    )
    rows = list(
        (
            await db.execute(
                select(OpsTask)
                .where(
                    OpsTask.status.in_(OPEN_TASK_STATUSES),
                    (OpsTask.assignee_user_id == current_user.id)
                    | (
                        OpsTask.assignee_user_id.is_(None)
                        & (OpsTask.assignee_role == current_user.role.value)
                    ),
                )
                .order_by(desc(OpsTask.updated_at), desc(OpsTask.created_at))
                .limit(100)
            )
        )
        .scalars()
        .all()
    )
    for task in rows:
        if task.id in existing_task_ids:
            continue
        await notify_user(
            db,
            user_id=current_user.id if task.assignee_user_id == current_user.id else None,
            role=None if task.assignee_user_id == current_user.id else current_user.role.value,
            task_id=task.id,
            notification_type="task_inbox_backfill",
            title=task.title,
            message="Việc cần xử lý đang mở trong phạm vi của bạn.",
            priority=task.priority,
            link_url=f"/manager/tasks?task_id={task.id}",
        )
    await db.flush()


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    db: DBSession,
    current_user: CurrentUser,
    unread_only: bool = False,
    limit: int = Query(default=50, ge=1, le=100),
) -> list[OpsNotification]:
    await observe_user_work_queue(db, current_user)
    await _ensure_current_user_task_notifications(db, current_user)
    query = (
        select(OpsNotification)
        .where(
            (OpsNotification.recipient_user_id == current_user.id)
            | (OpsNotification.recipient_role == current_user.role.value)
        )
        .order_by(desc(OpsNotification.created_at))
        .limit(limit)
    )
    if unread_only:
        query = query.where(OpsNotification.read_at.is_(None))
    return list((await db.execute(query)).scalars().all())


@router.get("/notifications/unread-count")
async def unread_count(db: DBSession, current_user: CurrentUser) -> dict[str, int]:
    await observe_user_work_queue(db, current_user)
    await _ensure_current_user_task_notifications(db, current_user)
    count = await db.scalar(
        select(func.count(OpsNotification.id)).where(
            OpsNotification.read_at.is_(None),
            (OpsNotification.recipient_user_id == current_user.id)
            | (OpsNotification.recipient_role == current_user.role.value),
        )
    )
    return {"unread": int(count or 0)}


@router.post("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def read_notification(notification_id: int, db: DBSession, current_user: CurrentUser) -> OpsNotification:
    notification = await db.get(OpsNotification, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notification.recipient_user_id not in {None, current_user.id} and notification.recipient_role != current_user.role.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Notification is outside your scope")
    mark_read(notification)
    await db.flush()
    return notification


@router.post("/notifications/read-all")
async def read_all_notifications(db: DBSession, current_user: CurrentUser) -> dict[str, int]:
    items = await list_notifications(db, current_user, unread_only=True, limit=100)
    for item in items:
        mark_read(item)
    await db.flush()
    return {"read": len(items)}


async def _generate(db: DBSession, current_user: CurrentUser, kind: str) -> dict[str, int | str]:
    if current_user.role not in {UserRole.superadmin, UserRole.admin}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can generate alerts")
    created = 0
    if kind in {"all", "student-risk"}:
        created += await generate_student_risk_alerts(db, actor=current_user)
    if kind in {"all", "section-risk"}:
        created += await generate_section_risk_alerts(db, actor=current_user)
    if kind in {"all", "course-risk"}:
        created += await generate_course_risk_alerts(db)
    if kind in {"all", "outcome-risk"}:
        created += await generate_outcome_alerts(db)
    if kind in {"all", "data-quality"}:
        created += await generate_data_quality_alerts(db)
    if kind in {"all", "system"}:
        created += await generate_system_alerts(db)
    return {"status": "completed", "kind": kind, "created": created}


@router.post("/admin/alerts/generate")
async def generate_all_alerts(db: DBSession, current_user: CurrentUser) -> dict[str, int | str]:
    return await _generate(db, current_user, "all")


@router.post("/admin/alerts/generate/student-risk")
async def generate_student_alerts(db: DBSession, current_user: CurrentUser) -> dict[str, int | str]:
    return await _generate(db, current_user, "student-risk")


@router.post("/admin/alerts/generate/section-risk")
async def generate_section_alerts(db: DBSession, current_user: CurrentUser) -> dict[str, int | str]:
    return await _generate(db, current_user, "section-risk")


@router.post("/admin/alerts/generate/course-risk")
async def generate_course_alerts(db: DBSession, current_user: CurrentUser) -> dict[str, int | str]:
    return await _generate(db, current_user, "course-risk")


@router.post("/admin/alerts/generate/outcome-risk")
async def generate_outcome_gap_alerts(db: DBSession, current_user: CurrentUser) -> dict[str, int | str]:
    return await _generate(db, current_user, "outcome-risk")


@router.post("/admin/alerts/generate/data-quality")
async def generate_dq_alerts(db: DBSession, current_user: CurrentUser) -> dict[str, int | str]:
    return await _generate(db, current_user, "data-quality")


@router.post("/admin/alerts/generate/system")
async def generate_system_ops_alerts(db: DBSession, current_user: CurrentUser) -> dict[str, int | str]:
    return await _generate(db, current_user, "system")

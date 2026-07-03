"""Role-aware observer that materializes actionable alerts into personal tasks."""

from __future__ import annotations

from fastapi.encoders import jsonable_encoder
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_teacher_for_user
from app.models.ops import OpsAlert, OpsTask
from app.models.people import HomeroomAssignment, Student, User, UserRole
from app.models.teaching import Enrollment, Section
from app.services.notification_service import add_task_event, notify_task_assignee
from app.services.task_service import OPEN_TASK_STATUSES, can_access_task_scope

ACTIVE_ALERT_STATUSES = {"new", "acknowledged"}


def _task_type_for_alert(alert_type: str) -> str:
    return {
        "student_risk": "contact_student",
        "section_risk": "review_section",
        "course_bottleneck": "review_course",
        "outcome_gap": "review_clo_plo",
        "data_quality": "fix_data",
        "system": "investigate_system",
    }.get(alert_type, "review_alert")


def _priority_for_alert(severity: str) -> str:
    return {"critical": "critical", "high": "high", "medium": "medium", "low": "low"}.get(severity, "medium")


async def _open_task_exists(db: AsyncSession, alert_id: int) -> bool:
    return (
        await db.scalar(
            select(OpsTask.id).where(OpsTask.source_alert_id == alert_id, OpsTask.status.in_(OPEN_TASK_STATUSES))
        )
    ) is not None


async def _is_actual_student_responsibility(db: AsyncSession, user: User, student_id: int) -> bool:
    teacher = await get_teacher_for_user(db, user)
    if teacher is None:
        return False
    section_result = await db.scalar(
        select(
            exists()
            .where(Enrollment.student_id == student_id)
            .where(Enrollment.section_id == Section.id)
            .where(Section.teacher_id == teacher.id)
        )
    )
    if bool(section_result):
        return True
    return bool(
        await db.scalar(
            select(
                exists()
                .where(Student.id == student_id)
                .where(Student.class_code == HomeroomAssignment.class_code)
                .where(HomeroomAssignment.teacher_id == teacher.id)
                .where(HomeroomAssignment.is_active == True)  # noqa: E712
            )
        )
    )


async def _is_actual_section_responsibility(db: AsyncSession, user: User, section_id: int) -> bool:
    teacher = await get_teacher_for_user(db, user)
    if teacher is None:
        return False
    return bool(await db.scalar(select(exists().where(Section.id == section_id, Section.teacher_id == teacher.id))))


async def _should_materialize_for_user(db: AsyncSession, user: User, alert: OpsAlert) -> bool:
    parsed_scope_id: int | None
    try:
        parsed_scope_id = int(alert.scope_id) if alert.scope_id is not None else None
    except ValueError:
        parsed_scope_id = None

    if alert.alert_type == "student_risk":
        return parsed_scope_id is not None and await _is_actual_student_responsibility(db, user, parsed_scope_id)
    if alert.alert_type == "section_risk":
        return parsed_scope_id is not None and await _is_actual_section_responsibility(db, user, parsed_scope_id)
    if alert.alert_type in {"course_bottleneck", "outcome_gap"}:
        return user.role == UserRole.manager and await can_access_task_scope(db, user, alert.scope_type, alert.scope_id)
    if alert.alert_type == "data_quality":
        return user.role == UserRole.admin
    if alert.alert_type == "system":
        return user.role == UserRole.superadmin
    return False


async def _materialize_alert(db: AsyncSession, user: User, alert: OpsAlert) -> bool:
    if await _open_task_exists(db, alert.id):
        return False
    task = OpsTask(
        task_type=_task_type_for_alert(alert.alert_type),
        priority=_priority_for_alert(alert.severity),
        status="assigned",
        title=alert.title,
        description=alert.message,
        scope_type=alert.scope_type,
        scope_id=alert.scope_id,
        source_alert_id=alert.id,
        assignee_user_id=user.id,
        assignee_role=user.role.value,
        created_by_user_id=user.id,
        metadata_json=jsonable_encoder({"alert": alert.evidence_json, "source": alert.source, "observer": "role"}),
    )
    db.add(task)
    await db.flush()
    alert.status = "converted"
    await add_task_event(
        db,
        task_id=task.id,
        actor_user_id=user.id,
        event_type="role_observer_materialized",
        payload={"alert_id": alert.id, "role": user.role.value},
    )
    await notify_task_assignee(db, task, user)
    return True


async def observe_user_work_queue(db: AsyncSession, user: User, *, limit: int = 100) -> int:
    """Create personal tasks from active alerts that belong directly to the actor."""
    if user.role == UserRole.viewer:
        return 0
    alerts = list(
        (
            await db.execute(
                select(OpsAlert)
                .where(OpsAlert.status.in_(ACTIVE_ALERT_STATUSES))
                .order_by(OpsAlert.created_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    created = 0
    for alert in alerts:
        if await _should_materialize_for_user(db, user, alert):
            created += 1 if await _materialize_alert(db, user, alert) else 0
    if created:
        await db.flush()
    return created

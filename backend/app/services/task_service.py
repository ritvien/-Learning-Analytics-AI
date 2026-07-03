"""RBAC and persistence helpers for operational tasks."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import (
    can_access_course,
    can_access_department,
    can_access_program,
    can_access_section,
    can_access_student,
    get_teacher_for_user,
    is_admin,
)
from app.models.academic import Program
from app.models.ops import OpsTask, OpsTaskComment
from app.models.people import HomeroomAssignment, Student, User, UserRole
from app.schemas.ops import TaskCreate
from app.services.notification_service import add_task_event, notify_task_assignee

OPEN_TASK_STATUSES = {"open", "assigned", "in_progress", "waiting_followup"}
MANAGEMENT_ROLES = {UserRole.superadmin, UserRole.admin, UserRole.manager}
ROLE_RANK = {
    UserRole.viewer: 0,
    UserRole.lecturer: 1,
    UserRole.manager: 2,
    UserRole.admin: 3,
    UserRole.superadmin: 4,
}


def _parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


async def can_access_homeroom(db: AsyncSession, user: User, class_code: str | None) -> bool:
    if not class_code:
        return False
    if is_admin(user):
        return True
    teacher = await get_teacher_for_user(db, user)
    if user.role == UserRole.lecturer:
        if teacher is None:
            return False
        result = await db.execute(
            select(exists().where(HomeroomAssignment.class_code == class_code, HomeroomAssignment.teacher_id == teacher.id, HomeroomAssignment.is_active == True))  # noqa: E712
        )
        return bool(result.scalar())
    if user.role == UserRole.manager:
        department_id = user.department_id
        if department_id is None:
            return False
        result = await db.execute(
            select(
                exists().where(
                    Student.class_code == class_code,
                    Student.program_id == Program.id,
                    Program.department_id == department_id,
                )
            )
        )
        return bool(result.scalar())
    return False


async def can_access_task_scope(db: AsyncSession, user: User, scope_type: str, scope_id: str | None) -> bool:
    if is_admin(user):
        return True
    if user.role == UserRole.viewer:
        return False
    parsed_id = _parse_int(scope_id)
    if scope_type == "student" and parsed_id is not None:
        return await can_access_student(db, user, parsed_id)
    if scope_type == "section" and parsed_id is not None:
        return await can_access_section(db, user, parsed_id)
    if scope_type == "homeroom":
        return await can_access_homeroom(db, user, scope_id)
    if scope_type == "course" and parsed_id is not None:
        return await can_access_course(db, user, parsed_id)
    if scope_type == "program" and parsed_id is not None:
        return user.role == UserRole.manager and await can_access_program(db, user, parsed_id)
    if scope_type == "department" and parsed_id is not None:
        return user.role == UserRole.manager and await can_access_department(db, user, parsed_id)
    if scope_type == "data_quality":
        return user.role in {UserRole.admin, UserRole.superadmin}
    if scope_type == "system":
        return user.role == UserRole.superadmin
    return False


async def can_view_task(db: AsyncSession, user: User, task: OpsTask) -> bool:
    if is_admin(user):
        return True
    if task.assignee_user_id == user.id:
        return True
    if user.role == UserRole.manager and task.scope_type in {"student", "section", "homeroom"}:
        return False
    return await can_access_task_scope(db, user, task.scope_type, task.scope_id)


async def can_mutate_task(db: AsyncSession, user: User, task: OpsTask) -> bool:
    if is_admin(user):
        return True
    if task.assignee_user_id == user.id:
        return True
    if user.role == UserRole.manager:
        if task.scope_type in {"student", "section", "homeroom"}:
            return False
        return await can_access_task_scope(db, user, task.scope_type, task.scope_id)
    if user.role == UserRole.lecturer:
        return task.assignee_user_id == user.id
    return False


async def require_task(db: AsyncSession, user: User, task_id: int, *, mutate: bool = False) -> OpsTask:
    task = await db.get(OpsTask, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    allowed = await can_mutate_task(db, user, task) if mutate else await can_view_task(db, user, task)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Task is outside your scope")
    return task


async def can_assign_to_user(db: AsyncSession, actor: User, assignee: User, task: OpsTask) -> bool:
    if assignee.role == UserRole.viewer:
        return False
    if ROLE_RANK.get(assignee.role, 0) >= ROLE_RANK.get(actor.role, 0):
        return False
    if actor.role == UserRole.superadmin:
        return True
    if actor.role == UserRole.admin:
        return assignee.role in {UserRole.manager, UserRole.lecturer}
    if actor.role != UserRole.manager:
        return False
    if assignee.role != UserRole.lecturer:
        return False
    if actor.department_id is None:
        return False
    teacher = await get_teacher_for_user(db, assignee)
    if teacher is None or teacher.department_id != actor.department_id:
        return False
    return await can_access_task_scope(db, actor, task.scope_type, task.scope_id)


async def create_task(db: AsyncSession, payload: TaskCreate, actor: User) -> OpsTask:
    if actor.role == UserRole.viewer:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot create tasks")
    if not await can_access_task_scope(db, actor, payload.scope_type, payload.scope_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Task scope is outside your permissions")
    assignee_id = payload.assignee_user_id
    status_value = payload.status or "open"
    task = OpsTask(
        task_type=payload.task_type,
        priority=payload.priority,
        status=status_value,
        title=payload.title,
        description=payload.description,
        scope_type=payload.scope_type,
        scope_id=payload.scope_id,
        source_alert_id=payload.source_alert_id,
        assignee_user_id=None,
        assignee_role=payload.assignee_role if assignee_id is None else None,
        created_by_user_id=actor.id,
        due_at=payload.due_at,
        follow_up_at=payload.follow_up_at,
        metadata_json=jsonable_encoder(payload.metadata_json),
    )
    db.add(task)
    await db.flush()
    await add_task_event(db, task_id=task.id, actor_user_id=actor.id, event_type="created", payload=payload.model_dump(mode="json"))
    if assignee_id is not None:
        assignee = await db.get(User, assignee_id)
        if assignee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found")
        await assign_task(db, task=task, actor=actor, assignee=assignee, due_at=payload.due_at)
    elif task.assignee_role is not None:
        await notify_task_assignee(db, task, actor)
    return task


async def assign_task(db: AsyncSession, *, task: OpsTask, actor: User, assignee: User, due_at=None) -> OpsTask:
    if not await can_assign_to_user(db, actor, assignee, task):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Assignee is outside your scope")
    previous = task.assignee_user_id
    task.assignee_user_id = assignee.id
    task.assignee_role = assignee.role.value
    if due_at is not None:
        task.due_at = due_at
    if task.status == "open":
        task.status = "assigned"
    await add_task_event(
        db,
        task_id=task.id,
        actor_user_id=actor.id,
        event_type="assigned",
        payload={"from": previous, "to": assignee.id, "due_at": due_at.isoformat() if due_at else None},
    )
    await notify_task_assignee(db, task, actor)
    await db.flush()
    return task


async def add_comment(db: AsyncSession, *, task: OpsTask, actor: User, comment: str) -> OpsTaskComment:
    item = OpsTaskComment(task_id=task.id, actor_user_id=actor.id, comment=comment)
    db.add(item)
    await db.flush()
    await add_task_event(db, task_id=task.id, actor_user_id=actor.id, event_type="comment_added", payload={"comment_id": item.id})
    return item


async def close_task(db: AsyncSession, *, task: OpsTask, actor: User, resolution_note: str, outcome: str | None, status_value: str) -> OpsTask:
    task.status = status_value
    task.resolution_note = resolution_note
    task.outcome = outcome
    task.closed_at = datetime.now(UTC)
    await add_task_event(
        db,
        task_id=task.id,
        actor_user_id=actor.id,
        event_type="closed",
        payload={"status": status_value, "outcome": outcome, "resolution_note": resolution_note},
    )
    await db.flush()
    return task

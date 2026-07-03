"""Notification helpers for operational work queues."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ops import OpsNotification, OpsTask, OpsTaskEvent
from app.models.people import User


async def add_task_event(
    db: AsyncSession,
    *,
    task_id: int,
    actor_user_id: str,
    event_type: str,
    payload: dict | None = None,
) -> OpsTaskEvent:
    event = OpsTaskEvent(
        task_id=task_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        payload_json=jsonable_encoder(payload or {}),
    )
    db.add(event)
    await db.flush()
    return event


async def notify_user(
    db: AsyncSession,
    *,
    user_id: str | None = None,
    role: str | None = None,
    task_id: int | None = None,
    alert_id: int | None = None,
    notification_type: str,
    title: str,
    message: str,
    priority: str = "medium",
    link_url: str | None = None,
) -> OpsNotification:
    notification = OpsNotification(
        recipient_user_id=user_id,
        recipient_role=role,
        task_id=task_id,
        alert_id=alert_id,
        notification_type=notification_type,
        title=title,
        message=message,
        priority=priority,
        link_url=link_url,
    )
    db.add(notification)
    await db.flush()
    return notification


async def notify_task_assignee(db: AsyncSession, task: OpsTask, actor: User, notification_type: str = "new_task") -> None:
    if task.assignee_user_id is None and task.assignee_role is None:
        return
    await notify_user(
        db,
        user_id=task.assignee_user_id,
        role=None if task.assignee_user_id is not None else task.assignee_role,
        task_id=task.id,
        notification_type=notification_type,
        title=task.title,
        message=f"{actor.full_name} đã giao/cập nhật việc cần xử lý cho bạn.",
        priority=task.priority,
        link_url=f"/manager/tasks?task_id={task.id}",
    )


def mark_read(notification: OpsNotification) -> None:
    notification.read_at = datetime.now(UTC)

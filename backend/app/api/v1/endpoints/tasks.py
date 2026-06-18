"""Analytics task workflow and student intervention endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, update

from app.dependencies import DBSession, get_current_user
from app.models.people import User
from app.models.task import AnalyticsTask, StudentIntervention, TaskComment

router = APIRouter()
interventions_router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    task_type: str
    priority: str = "medium"
    scope_type: str
    scope_id: int | None = None
    source_metric: str | None = None
    source_value: float | None = None
    reason: str
    assignee_id: str | None = None
    deadline: datetime | None = None


class TaskUpdate(BaseModel):
    status: str | None = None
    assignee_id: str | None = None
    deadline: datetime | None = None
    resolution_note: str | None = None


class TaskSubmit(BaseModel):
    resolution_note: str


class CommentCreate(BaseModel):
    comment: str


class InterventionCreate(BaseModel):
    student_id: int
    action_type: str
    note: str
    follow_up_date: datetime | None = None


# ---------------------------------------------------------------------------
# Task endpoints
# ---------------------------------------------------------------------------

def _task_to_dict(task: AnalyticsTask) -> dict:
    return {
        "id": task.id,
        "task_type": task.task_type,
        "priority": task.priority,
        "scope_type": task.scope_type,
        "scope_id": task.scope_id,
        "source_metric": task.source_metric,
        "source_value": task.source_value,
        "reason": task.reason,
        "assignee_id": task.assignee_id,
        "created_by": task.created_by,
        "deadline": task.deadline.isoformat() if task.deadline else None,
        "status": task.status,
        "resolution_note": task.resolution_note,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
        "closed_at": task.closed_at.isoformat() if task.closed_at else None,
    }


@router.get("")
async def list_tasks(
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    assignee_id: str | None = None,
    scope_type: str | None = None,
    limit: int = Query(100, ge=1, le=500),
) -> list[dict]:
    """List tasks with optional filters."""
    stmt = select(AnalyticsTask)
    if status_filter:
        stmt = stmt.where(AnalyticsTask.status == status_filter)
    if assignee_id:
        stmt = stmt.where(AnalyticsTask.assignee_id == assignee_id)
    if scope_type:
        stmt = stmt.where(AnalyticsTask.scope_type == scope_type)
    stmt = stmt.order_by(AnalyticsTask.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return [_task_to_dict(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    db: DBSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Create a new analytics task."""
    task = AnalyticsTask(
        task_type=body.task_type,
        priority=body.priority,
        scope_type=body.scope_type,
        scope_id=body.scope_id,
        source_metric=body.source_metric,
        source_value=body.source_value,
        reason=body.reason,
        assignee_id=body.assignee_id,
        created_by=current_user.id,
        deadline=body.deadline,
        status="open" if body.assignee_id is None else "assigned",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return _task_to_dict(task)


@router.patch("/{task_id}")
async def update_task(task_id: int, body: TaskUpdate, db: DBSession) -> dict:
    """Update task fields (status, assignee, deadline, resolution note)."""
    task = (await db.get(AnalyticsTask, task_id))
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if body.status is not None:
        task.status = body.status
    if body.assignee_id is not None:
        task.assignee_id = body.assignee_id
        if task.status == "open":
            task.status = "assigned"
    if body.deadline is not None:
        task.deadline = body.deadline
    if body.resolution_note is not None:
        task.resolution_note = body.resolution_note
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _task_to_dict(task)


@router.post("/{task_id}/submit")
async def submit_task(task_id: int, body: TaskSubmit, db: DBSession) -> dict:
    """Mark task as submitted with a resolution note."""
    task = await db.get(AnalyticsTask, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    task.status = "submitted"
    task.resolution_note = body.resolution_note
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _task_to_dict(task)


@router.post("/{task_id}/review")
async def review_task(task_id: int, db: DBSession) -> dict:
    """Mark task as reviewed."""
    task = await db.get(AnalyticsTask, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    task.status = "reviewed"
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _task_to_dict(task)


@router.post("/{task_id}/close")
async def close_task(task_id: int, body: TaskSubmit, db: DBSession) -> dict:
    """Close a task. Requires a resolution note."""
    task = await db.get(AnalyticsTask, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if not body.resolution_note.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="resolution_note is required to close a task")
    task.status = "closed"
    task.resolution_note = body.resolution_note
    task.closed_at = datetime.now(timezone.utc)
    task.updated_at = task.closed_at
    await db.commit()
    await db.refresh(task)
    return _task_to_dict(task)


@router.post("/{task_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_task_comment(
    task_id: int,
    body: CommentCreate,
    db: DBSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Add a comment to a task."""
    task = await db.get(AnalyticsTask, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    comment = TaskComment(task_id=task_id, user_id=current_user.id, comment=body.comment)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return {
        "id": comment.id,
        "task_id": comment.task_id,
        "user_id": comment.user_id,
        "comment": comment.comment,
        "created_at": comment.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Intervention endpoints
# ---------------------------------------------------------------------------

def _intervention_to_dict(i: StudentIntervention) -> dict:
    return {
        "id": i.id,
        "student_id": i.student_id,
        "created_by": i.created_by,
        "action_type": i.action_type,
        "note": i.note,
        "status": i.status,
        "follow_up_date": i.follow_up_date.isoformat() if i.follow_up_date else None,
        "created_at": i.created_at.isoformat(),
        "updated_at": i.updated_at.isoformat(),
    }


@interventions_router.get("")
async def list_interventions(
    db: DBSession,
    student_id: int | None = None,
    limit: int = Query(100, ge=1, le=500),
) -> list[dict]:
    """List interventions, optionally filtered by student."""
    stmt = select(StudentIntervention)
    if student_id:
        stmt = stmt.where(StudentIntervention.student_id == student_id)
    stmt = stmt.order_by(StudentIntervention.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return [_intervention_to_dict(r) for r in rows]


@interventions_router.post("", status_code=status.HTTP_201_CREATED)
async def create_intervention(
    body: InterventionCreate,
    db: DBSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Record a new student intervention."""
    intervention = StudentIntervention(
        student_id=body.student_id,
        created_by=current_user.id,
        action_type=body.action_type,
        note=body.note,
        follow_up_date=body.follow_up_date,
    )
    db.add(intervention)
    await db.commit()
    await db.refresh(intervention)
    return _intervention_to_dict(intervention)

"""Schemas for operational alerts, tasks, and notifications."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase

AlertStatus = Literal["new", "acknowledged", "converted", "dismissed", "resolved"]
AlertSeverity = Literal["critical", "high", "medium", "low"]
TaskPriority = Literal["urgent", "critical", "high", "medium", "low"]
TaskStatus = Literal["open", "assigned", "in_progress", "waiting_followup", "resolved", "closed", "cancelled"]
ScopeType = Literal["student", "section", "homeroom", "course", "program", "department", "data_quality", "system"]


class AlertCreate(BaseModel):
    alert_type: str = Field(max_length=50)
    severity: AlertSeverity = "medium"
    scope_type: ScopeType
    scope_id: str | None = Field(default=None, max_length=80)
    title: str = Field(max_length=255)
    message: str
    source: str = Field(default="manual", max_length=50)
    evidence_json: dict = Field(default_factory=dict)
    dedupe_key: str | None = Field(default=None, max_length=255)
    expires_at: datetime | None = None


class AlertResponse(OrmBase):
    id: int
    alert_type: str
    severity: str
    scope_type: str
    scope_id: str | None
    title: str
    message: str
    source: str
    evidence_json: dict
    status: str
    dedupe_key: str
    created_at: datetime
    expires_at: datetime | None


class TaskCreate(BaseModel):
    task_type: str = Field(max_length=50)
    priority: TaskPriority = "medium"
    status: TaskStatus | None = None
    title: str = Field(max_length=255)
    description: str | None = None
    scope_type: ScopeType
    scope_id: str | None = Field(default=None, max_length=80)
    source_alert_id: int | None = None
    assignee_user_id: str | None = None
    assignee_role: str | None = Field(default=None, max_length=30)
    due_at: datetime | None = None
    follow_up_at: datetime | None = None
    metadata_json: dict = Field(default_factory=dict)


class TaskUpdate(BaseModel):
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    due_at: datetime | None = None
    follow_up_at: datetime | None = None
    assignee_user_id: str | None = None
    assignee_role: str | None = Field(default=None, max_length=30)
    metadata_json: dict | None = None


class TaskAssign(BaseModel):
    assignee_user_id: str
    due_at: datetime | None = None


class TaskCommentCreate(BaseModel):
    comment: str = Field(min_length=1)


class TaskFollowUp(BaseModel):
    follow_up_at: datetime
    note: str | None = None


class TaskClose(BaseModel):
    resolution_note: str = Field(min_length=1)
    outcome: str | None = Field(default=None, max_length=50)
    status: Literal["resolved", "closed"] = "resolved"


class TaskCommentResponse(OrmBase):
    id: int
    task_id: int
    actor_user_id: str
    comment: str
    created_at: datetime


class TaskEventResponse(OrmBase):
    id: int
    task_id: int
    actor_user_id: str
    event_type: str
    payload_json: dict
    created_at: datetime


class TaskResponse(OrmBase):
    id: int
    task_type: str
    priority: str
    status: str
    title: str
    description: str | None
    scope_type: str
    scope_id: str | None
    source_alert_id: int | None
    assignee_user_id: str | None
    assignee_role: str | None
    created_by_user_id: str
    due_at: datetime | None
    follow_up_at: datetime | None
    resolution_note: str | None
    outcome: str | None
    metadata_json: dict
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    events: list[TaskEventResponse] = Field(default_factory=list)
    comments: list[TaskCommentResponse] = Field(default_factory=list)


class NotificationResponse(OrmBase):
    id: int
    recipient_user_id: str | None
    recipient_role: str | None
    task_id: int | None
    alert_id: int | None
    notification_type: str
    title: str
    message: str
    link_url: str | None
    priority: str
    read_at: datetime | None
    created_at: datetime

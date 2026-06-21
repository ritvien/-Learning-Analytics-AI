"""Pydantic schemas for generated reports and feedback."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase

ReportType = Literal["school_overview", "department_health", "program_health", "course_health", "section_intervention"]
ReportScheduleFrequency = Literal["weekly", "monthly", "midterm", "end_semester", "after_grade_update"]
ReportScheduleTrigger = Literal["manual", "scheduled", "grade_update", "midterm_grade", "final_grade"]


class ReportGenerateRequest(BaseModel):
    """Request to generate a deterministic report."""

    report_type: ReportType
    actor_role: str = "manager"
    scope_type: str | None = None
    scope_id: str | None = None
    semester_id: int | None = None
    period_start: datetime | None = None
    period_end: datetime | None = None


class ReportFeedbackCreate(BaseModel):
    """Feedback payload for a generated report."""

    rating: int | None = Field(default=None, ge=1, le=5)
    is_helpful: bool | None = None
    comment: str | None = None


class ReportFeedbackResponse(OrmBase):
    """Feedback response."""

    id: int
    report_id: str
    user_id: str | None
    rating: int | None
    is_helpful: bool | None
    comment: str | None
    created_at: datetime


class ReportResponse(OrmBase):
    """Generated report response."""

    id: str
    report_type: str
    actor_role: str
    scope_type: str | None
    scope_id: str | None
    title: str
    summary: str
    status: str
    metrics_json: dict
    content_markdown: str
    generated_by: str | None
    period_start: datetime | None = None
    period_end: datetime | None = None
    created_at: datetime
    feedback_items: list[ReportFeedbackResponse] = Field(default_factory=list)


class ReportScheduleCreate(BaseModel):
    """Create a recurring report schedule."""

    name: str = Field(..., min_length=1, max_length=255)
    report_type: ReportType
    actor_role: str = "manager"
    scope_type: str | None = None
    scope_id: str | None = None
    frequency: ReportScheduleFrequency
    trigger_event: str | None = None
    recipients_json: list[str] = Field(default_factory=list)
    formats_json: list[str] = Field(default_factory=lambda: ["web", "pdf"])
    detail_level: str = "standard"
    include_ai_narrative: bool = True
    include_appendix: bool = True
    is_active: bool = True
    next_run_at: datetime | None = None


class ReportScheduleUpdate(BaseModel):
    """Patch a recurring report schedule."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    actor_role: str | None = None
    scope_type: str | None = None
    scope_id: str | None = None
    frequency: ReportScheduleFrequency | None = None
    trigger_event: str | None = None
    recipients_json: list[str] | None = None
    formats_json: list[str] | None = None
    detail_level: str | None = None
    include_ai_narrative: bool | None = None
    include_appendix: bool | None = None
    is_active: bool | None = None
    next_run_at: datetime | None = None


class ReportScheduleResponse(OrmBase):
    """Recurring report schedule response."""

    id: int
    name: str
    report_type: str
    actor_role: str
    scope_type: str | None
    scope_id: str | None
    frequency: str
    trigger_event: str | None
    recipients_json: list[str]
    formats_json: list[str]
    detail_level: str
    include_ai_narrative: bool
    include_appendix: bool
    is_active: bool
    next_run_at: datetime | None
    last_run_at: datetime | None
    created_by: str | None
    last_report_id: str | None
    created_at: datetime
    updated_at: datetime


class ReportScheduleRunRequest(BaseModel):
    """Run a schedule manually, from cron, or after grade updates."""

    trigger: ReportScheduleTrigger = "manual"


class ReportScheduleRunResponse(OrmBase):
    """Execution log for a scheduled report."""

    id: int
    schedule_id: int
    report_id: str | None
    trigger: str
    status: str
    message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime

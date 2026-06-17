"""Pydantic schemas for generated reports and feedback."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase

ReportType = Literal["school_overview", "program_health", "section_intervention"]


class ReportGenerateRequest(BaseModel):
    """Request to generate a deterministic report."""

    report_type: ReportType
    actor_role: str = "manager"
    scope_type: str | None = None
    scope_id: str | None = None


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
    created_at: datetime
    feedback_items: list[ReportFeedbackResponse] = Field(default_factory=list)

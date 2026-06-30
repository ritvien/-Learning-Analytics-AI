"""Schemas for learning-support interventions."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase

InterventionChannel = Literal["email", "phone", "meeting", "in_person", "other"]
InterventionStatus = Literal["drafted", "logged", "emailed", "failed"]
InterventionScopeType = Literal["student", "section", "homeroom"]
CampaignStatus = Literal["draft", "reviewing", "approved", "sending", "completed", "cancelled"]
CampaignObjective = Literal["early_support", "course_recovery", "advisor_checkin"]
MessageStatus = Literal["drafted", "approved", "queued", "sent", "failed", "cancelled"]


class InterventionContactCreate(BaseModel):
    """Payload for logging or drafting a student support contact."""

    student_id: int
    section_id: int | None = None
    class_code: str | None = Field(default=None, max_length=30)
    channel: InterventionChannel = "email"
    status: InterventionStatus = "logged"
    subject: str | None = Field(default=None, max_length=255)
    message: str | None = None
    note: str | None = None
    metadata: dict = Field(default_factory=dict)


class InterventionContactResponse(OrmBase):
    """One support-contact history item."""

    id: int
    actor_user_id: str
    actor_name: str | None = None
    student_id: int
    section_id: int | None
    class_code: str | None
    channel: str
    status: str
    subject: str | None
    message: str | None
    note: str | None
    metadata_json: dict
    created_at: datetime
    updated_at: datetime


class InterventionDraftRequest(BaseModel):
    """Request an AI-style support message draft from existing risk signals."""

    student_id: int
    section_id: int | None = None
    class_code: str | None = Field(default=None, max_length=30)
    channel: InterventionChannel = "email"
    tone: Literal["supportive", "formal", "brief"] = "supportive"


class InterventionScopeSummaryRequest(BaseModel):
    """Request a support summary for one section or homeroom class."""

    scope_type: Literal["section", "homeroom"]
    scope_id: int | None = None
    class_code: str | None = Field(default=None, max_length=30)


class InterventionBulkNotifyRequest(BaseModel):
    """Create lecturer-confirmed support notifications for a whole scope."""

    scope_type: Literal["section", "homeroom"]
    scope_id: int | None = None
    class_code: str | None = Field(default=None, max_length=30)
    student_ids: list[int] | None = None
    channel: InterventionChannel = "email"
    status: InterventionStatus = "drafted"
    subject: str = Field(default="Trao đổi về kế hoạch hỗ trợ học tập", max_length=255)
    message_template: str | None = None
    max_students: int = Field(default=20, ge=1, le=100)


class InterventionCampaignCreate(BaseModel):
    """Create a learning-support campaign for one section or homeroom scope."""

    scope_type: Literal["section", "homeroom"]
    scope_id: int | None = None
    class_code: str | None = Field(default=None, max_length=30)
    title: str | None = Field(default=None, max_length=255)
    objective: CampaignObjective = "early_support"
    student_ids: list[int] | None = None
    max_students: int = Field(default=20, ge=1, le=100)


class InterventionCampaignGenerateDrafts(BaseModel):
    """Generate personalized message drafts for a campaign."""

    student_ids: list[int] | None = None
    channel: InterventionChannel = "email"
    subject: str = Field(default="Trao đổi về kế hoạch hỗ trợ học tập", max_length=255)
    message_template: str | None = None
    max_students: int = Field(default=20, ge=1, le=100)
    replace_existing: bool = False


class InterventionMessageUpdate(BaseModel):
    """Lecturer edits one drafted intervention message before approval."""

    channel: InterventionChannel | None = None
    recipient_email: str | None = Field(default=None, max_length=255)
    subject: str | None = Field(default=None, max_length=255)
    body: str | None = None
    status: MessageStatus | None = None


class InterventionMessageEventCreate(BaseModel):
    """Log an educational follow-up event for a message."""

    event_type: Literal["reply_logged", "meeting_scheduled", "note_logged"]
    payload: dict = Field(default_factory=dict)


class InterventionMessageResponse(OrmBase):
    """One campaign message draft/action."""

    id: int
    campaign_id: int
    student_id: int
    student_code: str | None = None
    full_name: str | None = None
    contact_id: int | None
    channel: str
    recipient_email: str | None
    subject: str | None
    body: str | None
    template_key: str | None
    template_version: str | None
    status: str
    approved_by_user_id: str | None
    approved_at: datetime | None
    sent_at: datetime | None
    provider_message_id: str | None
    error_code: str | None
    error_message: str | None
    metadata_json: dict
    created_at: datetime
    updated_at: datetime


class InterventionCampaignResponse(OrmBase):
    """A learning-support campaign with message drafts."""

    id: int
    actor_user_id: str
    actor_name: str | None = None
    scope_type: str
    section_id: int | None
    class_code: str | None
    title: str
    objective: str
    status: str
    source: str
    summary_json: dict
    created_at: datetime
    updated_at: datetime
    messages: list[InterventionMessageResponse] = Field(default_factory=list)

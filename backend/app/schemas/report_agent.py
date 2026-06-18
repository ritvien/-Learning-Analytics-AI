"""Schemas for the report-agent API."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase

ReportAgentMode = Literal["explain", "root_cause", "narrative", "action_planning", "workflow", "compare"]


class ReportAgentSessionCreate(BaseModel):
    """Create a report-agent session."""

    report_id: str | None = None
    mode: ReportAgentMode = "explain"
    title: str | None = Field(default=None, max_length=255)
    scope: dict[str, Any] = Field(default_factory=dict)


class ReportAgentAskRequest(BaseModel):
    """Ask the report agent a question."""

    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = None
    report_id: str | None = None
    mode: ReportAgentMode = "explain"
    context: dict[str, Any] = Field(default_factory=dict)


class ReportAgentToolInfo(BaseModel):
    """Tool metadata exposed to the frontend."""

    name: str
    description: str
    mode: list[str]
    requires_confirmation: bool = False
    write_action: bool = False


class ReportAgentToolCallResponse(BaseModel):
    """One executed tool call."""

    tool_name: str
    tool_input: dict[str, Any]
    tool_output: dict[str, Any]
    status: str = "success"
    latency_ms: int = 0


class ReportAgentPendingActionResponse(OrmBase):
    """Pending write action proposed by the agent."""

    id: str
    session_id: str
    action_type: str
    payload_json: dict[str, Any]
    status: str
    created_at: datetime


class ReportAgentMessageResponse(OrmBase):
    """Message in a report-agent session."""

    id: int
    role: str
    content: str
    context_json: dict[str, Any]
    created_at: datetime


class ReportAgentSessionResponse(OrmBase):
    """Report-agent session details."""

    id: str
    report_id: str | None
    title: str
    mode: str
    status: str
    scope_json: dict[str, Any]
    short_summary: str | None
    created_at: datetime
    updated_at: datetime
    messages: list[ReportAgentMessageResponse] = Field(default_factory=list)


class ReportAgentAskResponse(BaseModel):
    """Answer returned by the report agent."""

    response: str
    session_id: str
    mode: str
    prompt_version: str
    memory_summary: str | None = None
    tool_calls: list[ReportAgentToolCallResponse] = Field(default_factory=list)
    pending_actions: list[ReportAgentPendingActionResponse] = Field(default_factory=list)
    latency_ms: int = 0


class ReportAgentConfirmRequest(BaseModel):
    """Confirm or cancel a pending action."""

    action: Literal["confirm", "cancel"]


class ReportAgentConfirmResponse(BaseModel):
    """Result of confirming or cancelling a pending action."""

    id: str
    status: str
    result: dict[str, Any] = Field(default_factory=dict)

"""Agent memory, prompt, and report-agent audit models."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


def _uuid_str() -> str:
    return str(uuid4())


class AgentMemory(TimestampMixin, Base):
    """Long-term memory scoped to a user and agent namespace."""

    __tablename__ = "agent_memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    namespace: Mapped[str] = mapped_column(String(50), default="report_agent", nullable=False, index=True)
    memory_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    value_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False)
    source: Mapped[str | None] = mapped_column(String(120))
    confidence: Mapped[int] = mapped_column(Integer, default=80, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AgentPromptVersion(TimestampMixin, Base):
    """Versioned prompt contract for audit and safe rollout."""

    __tablename__ = "agent_prompt_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(30), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(64))


class ReportAgentSession(TimestampMixin, Base):
    """A report-agent conversation with short-term summary and UI scope."""

    __tablename__ = "report_agent_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    report_id: Mapped[str | None] = mapped_column(ForeignKey("reports.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    mode: Mapped[str] = mapped_column(String(40), default="explain", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="active", nullable=False)
    scope_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False)
    short_summary: Mapped[str | None] = mapped_column(Text)

    messages: Mapped[list[ReportAgentMessage]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )


class ReportAgentMessage(TimestampMixin, Base):
    """One message in a report-agent conversation."""

    __tablename__ = "report_agent_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("report_agent_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    context_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False)

    session: Mapped[ReportAgentSession] = relationship(back_populates="messages")


class ReportAgentToolCall(TimestampMixin, Base):
    """Auditable record of every tool used by the report agent."""

    __tablename__ = "report_agent_tool_calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("report_agent_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("report_agent_messages.id", ondelete="SET NULL"),
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    tool_name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    tool_input_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False)
    tool_output_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="success", nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_text: Mapped[str | None] = mapped_column(Text)


class ReportAgentPendingAction(TimestampMixin, Base):
    """Write action proposed by the agent and awaiting user confirmation."""

    __tablename__ = "report_agent_pending_actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("report_agent_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    payload_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False, index=True)
    result_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

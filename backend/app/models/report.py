"""Report history and feedback ORM models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


class Report(TimestampMixin, Base):
    """Generated deterministic report stored for review and agent reuse."""

    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    report_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(30), nullable=False)
    scope_type: Mapped[str | None] = mapped_column(String(30))
    scope_id: Mapped[str | None] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="generated", nullable=False)
    metrics_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    generated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    feedback_items: Mapped[list["ReportFeedback"]] = relationship(back_populates="report", cascade="all, delete-orphan")
    schedule_runs: Mapped[list["ReportScheduleRun"]] = relationship(back_populates="report")


class ReportFeedback(TimestampMixin, Base):
    """User feedback on whether a report was useful and accurate."""

    __tablename__ = "report_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    rating: Mapped[int | None] = mapped_column(Integer)
    is_helpful: Mapped[bool | None] = mapped_column(Boolean)
    comment: Mapped[str | None] = mapped_column(Text)

    report: Mapped[Report] = relationship(back_populates="feedback_items")


class ReportSchedule(TimestampMixin, Base):
    """Recurring report definition for weekly/monthly/semester/grade-update runs."""

    __tablename__ = "report_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(30), nullable=False)
    scope_type: Mapped[str | None] = mapped_column(String(30))
    scope_id: Mapped[str | None] = mapped_column(String(50))
    frequency: Mapped[str] = mapped_column(String(30), nullable=False)
    trigger_event: Mapped[str | None] = mapped_column(String(80))
    recipients_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    formats_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    detail_level: Mapped[str] = mapped_column(String(30), default="standard", nullable=False)
    include_ai_narrative: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    include_appendix: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    last_report_id: Mapped[str | None] = mapped_column(ForeignKey("reports.id", ondelete="SET NULL"))

    runs: Mapped[list["ReportScheduleRun"]] = relationship(back_populates="schedule", cascade="all, delete-orphan")


class ReportScheduleRun(TimestampMixin, Base):
    """Execution log for a scheduled report."""

    __tablename__ = "report_schedule_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("report_schedules.id", ondelete="CASCADE"), nullable=False)
    report_id: Mapped[str | None] = mapped_column(ForeignKey("reports.id", ondelete="SET NULL"))
    trigger: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="running", nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    schedule: Mapped[ReportSchedule] = relationship(back_populates="runs")
    report: Mapped[Report | None] = relationship(back_populates="schedule_runs")

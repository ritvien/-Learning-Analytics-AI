"""Operational alerts, tasks, and notifications."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


class OpsAlert(Base):
    """A raw system-generated or user-created signal that may become a task."""

    __tablename__ = "ops_alerts"
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uq_ops_alert_dedupe_key"),
        Index("idx_ops_alert_status_severity", "status", "severity"),
        Index("idx_ops_alert_scope", "scope_type", "scope_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    scope_type: Mapped[str] = mapped_column(String(30), nullable=False)
    scope_id: Mapped[str | None] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    evidence_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="new", nullable=False)
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tasks = relationship("OpsTask", back_populates="source_alert")
    notifications = relationship("OpsNotification", back_populates="alert")


class OpsTask(TimestampMixin, Base):
    """Generic actor-owned work item for academic operations."""

    __tablename__ = "ops_tasks"
    __table_args__ = (
        Index("idx_ops_task_queue", "status", "priority", "due_at"),
        Index("idx_ops_task_assignee", "assignee_user_id", "status"),
        Index("idx_ops_task_scope", "scope_type", "scope_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="open", nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    scope_type: Mapped[str] = mapped_column(String(30), nullable=False)
    scope_id: Mapped[str | None] = mapped_column(String(80))
    source_alert_id: Mapped[int | None] = mapped_column(ForeignKey("ops_alerts.id", ondelete="SET NULL"))
    assignee_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    assignee_role: Mapped[str | None] = mapped_column(String(30))
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_note: Mapped[str | None] = mapped_column(Text)
    outcome: Mapped[str | None] = mapped_column(String(50))
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    source_alert = relationship("OpsAlert", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_user_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    events = relationship("OpsTaskEvent", back_populates="task", cascade="all, delete-orphan", order_by="OpsTaskEvent.id")
    comments = relationship("OpsTaskComment", back_populates="task", cascade="all, delete-orphan", order_by="OpsTaskComment.id")
    notifications = relationship("OpsNotification", back_populates="task")


class OpsTaskEvent(Base):
    """Append-only task event timeline."""

    __tablename__ = "ops_task_events"
    __table_args__ = (Index("idx_ops_task_event_task", "task_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("ops_tasks.id", ondelete="CASCADE"), nullable=False)
    actor_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    task = relationship("OpsTask", back_populates="events")
    actor = relationship("User")


class OpsTaskComment(Base):
    """User-visible note on an operational task."""

    __tablename__ = "ops_task_comments"
    __table_args__ = (Index("idx_ops_task_comment_task", "task_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("ops_tasks.id", ondelete="CASCADE"), nullable=False)
    actor_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    task = relationship("OpsTask", back_populates="comments")
    actor = relationship("User")


class OpsNotification(Base):
    """Inbox notification for one user."""

    __tablename__ = "ops_notifications"
    __table_args__ = (
        Index("idx_ops_notification_recipient", "recipient_user_id", "read_at", "created_at"),
        Index("idx_ops_notification_role", "recipient_role", "read_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipient_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    recipient_role: Mapped[str | None] = mapped_column(String(30))
    task_id: Mapped[int | None] = mapped_column(ForeignKey("ops_tasks.id", ondelete="CASCADE"))
    alert_id: Mapped[int | None] = mapped_column(ForeignKey("ops_alerts.id", ondelete="CASCADE"))
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    link_url: Mapped[str | None] = mapped_column(String(255))
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    recipient = relationship("User")
    task = relationship("OpsTask", back_populates="notifications")
    alert = relationship("OpsAlert", back_populates="notifications")

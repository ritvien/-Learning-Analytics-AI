"""Learning-support intervention models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


class StudentInterventionContact(TimestampMixin, Base):
    """Append-only log of lecturer/advisor support actions for a student."""

    __tablename__ = "student_intervention_contacts"
    __table_args__ = (
        Index("idx_intervention_student_created", "student_id", "created_at"),
        Index("idx_intervention_section_created", "section_id", "created_at"),
        Index("idx_intervention_class_created", "class_code", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False)
    section_id: Mapped[int | None] = mapped_column(ForeignKey("sections.id", ondelete="SET NULL"))
    class_code: Mapped[str | None] = mapped_column(String(30))
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="logged", nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255))
    message: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    actor = relationship("User")
    student = relationship("Student")
    section = relationship("Section")


class InterventionCampaign(TimestampMixin, Base):
    """A lecturer/advisor-reviewed learning-support outreach campaign."""

    __tablename__ = "intervention_campaigns"
    __table_args__ = (
        Index("idx_intervention_campaign_scope", "scope_type", "section_id", "class_code"),
        Index("idx_intervention_campaign_actor_created", "actor_user_id", "created_at"),
        Index("idx_intervention_campaign_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    scope_type: Mapped[str] = mapped_column(String(20), nullable=False)
    section_id: Mapped[int | None] = mapped_column(ForeignKey("sections.id", ondelete="SET NULL"))
    class_code: Mapped[str | None] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    objective: Mapped[str] = mapped_column(String(50), default="early_support", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft", nullable=False)
    source: Mapped[str] = mapped_column(String(30), default="agent", nullable=False)
    summary_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    actor = relationship("User")
    section = relationship("Section")
    messages = relationship(
        "InterventionMessage",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="InterventionMessage.id",
    )


class InterventionMessage(TimestampMixin, Base):
    """One reviewed draft/action in a learning-support campaign."""

    __tablename__ = "intervention_messages"
    __table_args__ = (
        Index("idx_intervention_message_campaign", "campaign_id"),
        Index("idx_intervention_message_student", "student_id"),
        Index("idx_intervention_message_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("intervention_campaigns.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("student_intervention_contacts.id", ondelete="SET NULL"))
    channel: Mapped[str] = mapped_column(String(30), default="email", nullable=False)
    recipient_email: Mapped[str | None] = mapped_column(String(255))
    subject: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text)
    template_key: Mapped[str | None] = mapped_column(String(100))
    template_version: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="drafted", nullable=False)
    approved_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    campaign = relationship("InterventionCampaign", back_populates="messages")
    student = relationship("Student")
    contact = relationship("StudentInterventionContact")
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])
    events = relationship(
        "InterventionMessageEvent",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="InterventionMessageEvent.id",
    )


class InterventionMessageEvent(Base):
    """Append-only event trail for one intervention message."""

    __tablename__ = "intervention_message_events"
    __table_args__ = (Index("idx_intervention_message_event_message", "message_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("intervention_messages.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    message = relationship("InterventionMessage", back_populates="events")

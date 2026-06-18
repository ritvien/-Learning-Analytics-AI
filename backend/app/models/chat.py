"""Chat Session model for storing history of conversations with the Agent."""

import uuid

from sqlalchemy import JSON, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.people import User


class ChatSession(Base, TimestampMixin):
    """Stores a single chat thread and its complete history as JSON."""

    __tablename__ = "chat_sessions"

    # Generic Uuid → UUID on PostgreSQL, CHAR(32) on SQLite (matches the migration's sa.UUID()).
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # users.id is String(36); keep the FK column type aligned with it (the migration uses String(36)).
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    # Store the entire LangGraph state/messages as a JSON array of dicts.
    # JSONB on PostgreSQL for indexing/perf; portable JSON elsewhere (e.g. SQLite in tests).
    messages: Mapped[list[dict]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=False, server_default="[]"
    )

    # Relationships
    user: Mapped["User"] = relationship()

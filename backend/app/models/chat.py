"""Chat Session model for storing history of conversations with the Agent."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.people import User


class ChatSession(Base, TimestampMixin):
    """Stores a single chat thread and its complete history as JSONB."""

    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Store the entire LangGraph state/messages as a JSON array of dicts
    messages: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, server_default="[]")

    # Relationships
    user: Mapped["User"] = relationship()

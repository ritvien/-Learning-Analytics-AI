"""Lineage records for reversible synthetic/demo data imports."""

from sqlalchemy import JSON, Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class SyntheticDataLineage(TimestampMixin, Base):
    """Identify synthetic entities without polluting academic domain tables."""

    __tablename__ = "synthetic_data_lineage"
    __table_args__ = (UniqueConstraint("source", "entity_type", "entity_id", name="uq_synthetic_lineage_entity"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    official: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    derivation: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

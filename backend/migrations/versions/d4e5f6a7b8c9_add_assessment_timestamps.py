"""Add enrollment credit snapshots and assessment timestamps.

Revision ID: d4e5f6a7b8c9
Revises: b5c6d7e8f901
Create Date: 2026-06-19 23:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "b5c6d7e8f901"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add fields required by database modernization."""
    with op.batch_alter_table("enrollments") as batch_op:
        batch_op.add_column(sa.Column("registered_credits", sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table("grade_components") as batch_op:
        batch_op.add_column(sa.Column("assessed_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Remove modernization timestamp/snapshot fields."""
    with op.batch_alter_table("grade_components") as batch_op:
        batch_op.drop_column("recorded_at")
        batch_op.drop_column("assessed_at")

    with op.batch_alter_table("enrollments") as batch_op:
        batch_op.drop_column("completed_at")
        batch_op.drop_column("registered_credits")

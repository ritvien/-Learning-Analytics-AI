"""add source to student CLO achievements

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-06-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c5d6e7f8a9b0"
down_revision: str | Sequence[str] | None = "b4c5d6e7f8a9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "student_clo_achievements",
        sa.Column(
            "source",
            sa.String(length=50),
            nullable=False,
            server_default="synthetic_from_grade",
        ),
    )
    op.create_index(
        "idx_clo_achievements_source",
        "student_clo_achievements",
        ["source"],
    )


def downgrade() -> None:
    op.drop_index("idx_clo_achievements_source", table_name="student_clo_achievements")
    op.drop_column("student_clo_achievements", "source")

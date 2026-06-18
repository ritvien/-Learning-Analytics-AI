"""Add student PLO achievement cache table.

Revision ID: c6e3a9d4f120
Revises: b8c2f4a1d907
Create Date: 2026-06-17 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c6e3a9d4f120"
down_revision: str | None = "b8c2f4a1d907"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create the aggregated PLO achievement table."""
    op.create_table(
        "student_plo_achievements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("program_id", sa.Integer(), nullable=False),
        sa.Column("plo_id", sa.Integer(), nullable=False),
        sa.Column("achievement_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("evidence_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_achieved", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plo_id"], ["plos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "plo_id"),
    )
    op.create_index("idx_student_plo_student", "student_plo_achievements", ["student_id"])
    op.create_index("idx_student_plo_program", "student_plo_achievements", ["program_id"])
    op.create_index("idx_student_plo_plo", "student_plo_achievements", ["plo_id"])


def downgrade() -> None:
    """Drop the aggregated PLO achievement table."""
    op.drop_index("idx_student_plo_plo", table_name="student_plo_achievements")
    op.drop_index("idx_student_plo_program", table_name="student_plo_achievements")
    op.drop_index("idx_student_plo_student", table_name="student_plo_achievements")
    op.drop_table("student_plo_achievements")

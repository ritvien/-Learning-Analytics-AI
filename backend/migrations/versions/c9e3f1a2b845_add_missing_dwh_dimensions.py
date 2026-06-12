"""Add missing DWH dimension tables: dim_section, dim_program, dim_cohort.

Revision ID: c9e3f1a2b845
Revises: 8b2d4c7e91af
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c9e3f1a2b845"
down_revision: str | None = "8b2d4c7e91af"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add dim_section, dim_program, dim_cohort to the dwh schema."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.create_table(
        "dim_section",
        sa.Column("section_id", sa.Integer(), primary_key=True),
        sa.Column("section_code", sa.String(20), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("semester_id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="dwh",
    )

    op.create_table(
        "dim_program",
        sa.Column("program_id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(30), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="dwh",
    )

    op.create_table(
        "dim_cohort",
        sa.Column("cohort_id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("year_start", sa.SmallInteger(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="dwh",
    )


def downgrade() -> None:
    """Drop the three added dimension tables."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.drop_table("dim_cohort", schema="dwh")
    op.drop_table("dim_program", schema="dwh")
    op.drop_table("dim_section", schema="dwh")

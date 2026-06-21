"""Add DWH assessment fact tables.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-19 23:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create grade-component and CLO-achievement facts."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.create_table(
        "fact_grade_component",
        sa.Column("component_id", sa.Integer(), primary_key=True),
        sa.Column("enrollment_id", sa.Integer(), nullable=False),
        sa.Column("component_type_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("semester_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(5, 2), nullable=True),
        sa.Column("max_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("is_absent", sa.Boolean(), nullable=False),
        sa.Column("assessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="dwh",
    )
    op.create_index(
        "idx_fact_grade_component_course_semester",
        "fact_grade_component",
        ["course_id", "semester_id"],
        schema="dwh",
    )

    op.create_table(
        "fact_clo_achievement",
        sa.Column("enrollment_id", sa.Integer(), nullable=False),
        sa.Column("clo_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("semester_id", sa.Integer(), nullable=False),
        sa.Column("achievement_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("is_achieved", sa.Boolean(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("enrollment_id", "clo_id"),
        schema="dwh",
    )
    op.create_index(
        "idx_fact_clo_achievement_course_semester",
        "fact_clo_achievement",
        ["course_id", "semester_id"],
        schema="dwh",
    )


def downgrade() -> None:
    """Drop DWH assessment fact tables."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.drop_index("idx_fact_clo_achievement_course_semester", table_name="fact_clo_achievement", schema="dwh")
    op.drop_table("fact_clo_achievement", schema="dwh")
    op.drop_index("idx_fact_grade_component_course_semester", table_name="fact_grade_component", schema="dwh")
    op.drop_table("fact_grade_component", schema="dwh")

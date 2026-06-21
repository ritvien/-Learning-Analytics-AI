"""Add specialization hierarchy and student specialization mapping.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-21 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create specializations, course mappings, and optional student scope."""
    op.create_table(
        "specializations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("program_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("name_en", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_placeholder", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("program_id", "code", name="uq_specializations_program_code"),
    )
    op.create_index("idx_specializations_program", "specializations", ["program_id"])

    op.create_table(
        "specialization_courses",
        sa.Column("specialization_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["specialization_id"], ["specializations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("specialization_id", "course_id"),
    )

    with op.batch_alter_table("students") as batch_op:
        batch_op.add_column(sa.Column("specialization_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_students_specialization_id_specializations",
            "specializations",
            ["specialization_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("idx_students_specialization", ["specialization_id"])

    placeholder_name = (
        "U&'Ch\\01B0a ph\\00E2n lo\\1EA1i'"
        if op.get_bind().dialect.name == "postgresql"
        else "'Unassigned'"
    )
    op.execute(
        f"""
        INSERT INTO specializations (program_id, code, name, is_placeholder, is_active)
        SELECT p.id, 'UNASSIGNED', {placeholder_name}, TRUE, TRUE
        FROM programs p
        WHERE NOT EXISTS (
            SELECT 1
            FROM specializations s
            WHERE s.program_id = p.id AND s.code = 'UNASSIGNED'
        )
        """
    )
    op.execute(
        """
        INSERT INTO specialization_courses (specialization_id, course_id)
        SELECT s.id, pc.course_id
        FROM specializations s
        JOIN program_courses pc ON pc.program_id = s.program_id
        WHERE s.code = 'UNASSIGNED'
          AND NOT EXISTS (
              SELECT 1
              FROM specialization_courses sc
              WHERE sc.specialization_id = s.id AND sc.course_id = pc.course_id
          )
        """
    )


def downgrade() -> None:
    """Remove specialization hierarchy without changing legacy Program/Course data."""
    with op.batch_alter_table("students") as batch_op:
        batch_op.drop_index("idx_students_specialization")
        batch_op.drop_constraint("fk_students_specialization_id_specializations", type_="foreignkey")
        batch_op.drop_column("specialization_id")

    op.drop_table("specialization_courses")
    op.drop_index("idx_specializations_program", table_name="specializations")
    op.drop_table("specializations")

"""Add learning-support intervention contact log.

Revision ID: d1e2f3a4b5c6
Revises: c5d6e7f8a9b0
Create Date: 2026-06-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: str | Sequence[str] | None = "c5d6e7f8a9b0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "student_intervention_contacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.String(length=36), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=True),
        sa.Column("class_code", sa.String(length=30), nullable=True),
        sa.Column("channel", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="logged"),
        sa.Column("subject", sa.String(length=255), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_intervention_student_created",
        "student_intervention_contacts",
        ["student_id", "created_at"],
    )
    op.create_index(
        "idx_intervention_section_created",
        "student_intervention_contacts",
        ["section_id", "created_at"],
    )
    op.create_index(
        "idx_intervention_class_created",
        "student_intervention_contacts",
        ["class_code", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_intervention_class_created", table_name="student_intervention_contacts")
    op.drop_index("idx_intervention_section_created", table_name="student_intervention_contacts")
    op.drop_index("idx_intervention_student_created", table_name="student_intervention_contacts")
    op.drop_table("student_intervention_contacts")

"""Add intervention case workflow.

Revision ID: bc4d5e6f7a81
Revises: ab3c4d5e6f70
Create Date: 2026-07-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "bc4d5e6f7a81"
down_revision: str | Sequence[str] | None = "ab3c4d5e6f70"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intervention_cases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("scope_type", sa.String(20), nullable=False),
        sa.Column("scope_key", sa.String(64), nullable=False),
        sa.Column("section_id", sa.Integer()),
        sa.Column("class_code", sa.String(30)),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(30), nullable=False, server_default="new"),
        sa.Column("active_key", sa.String(10), server_default="active"),
        sa.Column("assignee_user_id", sa.String(36)),
        sa.Column("created_by_user_id", sa.String(36), nullable=False),
        sa.Column("follow_up_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("resolution", sa.Text()),
        sa.Column("signal_snapshot", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assignee_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("student_id", "scope_key", "active_key", name="uq_intervention_case_active_scope"),
    )
    op.create_index("idx_intervention_case_queue", "intervention_cases", ["status", "priority", "follow_up_at"])
    op.create_index("idx_intervention_case_assignee", "intervention_cases", ["assignee_user_id", "status"])
    op.create_index("idx_intervention_case_scope", "intervention_cases", ["scope_type", "section_id", "class_code"])
    op.create_table(
        "intervention_case_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.String(36), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["case_id"], ["intervention_cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_intervention_case_event_case", "intervention_case_events", ["case_id", "created_at"])
    op.add_column("student_intervention_contacts", sa.Column("case_id", sa.Integer()))
    op.create_foreign_key(
        "fk_intervention_contact_case",
        "student_intervention_contacts",
        "intervention_cases",
        ["case_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_intervention_contact_case", "student_intervention_contacts", type_="foreignkey")
    op.drop_column("student_intervention_contacts", "case_id")
    op.drop_index("idx_intervention_case_event_case", table_name="intervention_case_events")
    op.drop_table("intervention_case_events")
    op.drop_index("idx_intervention_case_scope", table_name="intervention_cases")
    op.drop_index("idx_intervention_case_assignee", table_name="intervention_cases")
    op.drop_index("idx_intervention_case_queue", table_name="intervention_cases")
    op.drop_table("intervention_cases")

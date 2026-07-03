"""Add advisor assessments and intervention appointments.

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-07-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: str | Sequence[str] | None = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("intervention_cases") as batch_op:
        batch_op.add_column(sa.Column("follow_up_snapshot", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))
        batch_op.add_column(sa.Column("advisor_assessment", sa.Text()))
        batch_op.add_column(sa.Column("advisor_conclusion", sa.String(50)))
        batch_op.add_column(sa.Column("advisor_action_plan", sa.Text()))
        batch_op.add_column(sa.Column("assessment_confirmed_by_user_id", sa.String(36)))
        batch_op.add_column(sa.Column("assessment_confirmed_at", sa.DateTime(timezone=True)))
        batch_op.add_column(sa.Column("improvement_outcome", sa.String(30)))
        batch_op.create_foreign_key(
            "fk_intervention_case_assessment_confirmer",
            "users",
            ["assessment_confirmed_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_table(
        "intervention_appointments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer()),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.String(36), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("meeting_mode", sa.String(20), nullable=False, server_default="in_person"),
        sa.Column("location", sa.String(255)),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("result", sa.Text()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["case_id"], ["intervention_cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["ops_tasks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_intervention_appointment_case", "intervention_appointments", ["case_id", "scheduled_at"])
    op.create_index("idx_intervention_appointment_task", "intervention_appointments", ["task_id", "scheduled_at"])
    op.create_index("idx_intervention_appointment_student", "intervention_appointments", ["student_id", "scheduled_at"])
    op.create_index("idx_intervention_appointment_status", "intervention_appointments", ["status", "scheduled_at"])


def downgrade() -> None:
    op.drop_index("idx_intervention_appointment_status", table_name="intervention_appointments")
    op.drop_index("idx_intervention_appointment_student", table_name="intervention_appointments")
    op.drop_index("idx_intervention_appointment_task", table_name="intervention_appointments")
    op.drop_index("idx_intervention_appointment_case", table_name="intervention_appointments")
    op.drop_table("intervention_appointments")
    with op.batch_alter_table("intervention_cases") as batch_op:
        batch_op.drop_constraint("fk_intervention_case_assessment_confirmer", type_="foreignkey")
        batch_op.drop_column("improvement_outcome")
        batch_op.drop_column("assessment_confirmed_at")
        batch_op.drop_column("assessment_confirmed_by_user_id")
        batch_op.drop_column("advisor_action_plan")
        batch_op.drop_column("advisor_conclusion")
        batch_op.drop_column("advisor_assessment")
        batch_op.drop_column("follow_up_snapshot")

"""Add report schedules.

Revision ID: b5c6d7e8f901
Revises: 7c4d8e9f0a12
Create Date: 2026-06-18 22:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "b5c6d7e8f901"
down_revision: str | None = "7c4d8e9f0a12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create recurring report schedule and execution log tables."""
    op.create_table(
        "report_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("report_type", sa.String(length=50), nullable=False),
        sa.Column("actor_role", sa.String(length=30), nullable=False),
        sa.Column("scope_type", sa.String(length=30), nullable=True),
        sa.Column("scope_id", sa.String(length=50), nullable=True),
        sa.Column("frequency", sa.String(length=30), nullable=False),
        sa.Column("trigger_event", sa.String(length=80), nullable=True),
        sa.Column("recipients_json", sa.JSON(), nullable=False),
        sa.Column("formats_json", sa.JSON(), nullable=False),
        sa.Column("detail_level", sa.String(length=30), nullable=False),
        sa.Column("include_ai_narrative", sa.Boolean(), nullable=False),
        sa.Column("include_appendix", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("last_report_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["last_report_id"], ["reports.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_schedules_actor_role", "report_schedules", ["actor_role"])
    op.create_index("ix_report_schedules_frequency", "report_schedules", ["frequency"])
    op.create_index("ix_report_schedules_is_active", "report_schedules", ["is_active"])

    op.create_table(
        "report_schedule_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("schedule_id", sa.Integer(), nullable=False),
        sa.Column("report_id", sa.String(length=36), nullable=True),
        sa.Column("trigger", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["schedule_id"], ["report_schedules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_schedule_runs_report_id", "report_schedule_runs", ["report_id"])
    op.create_index("ix_report_schedule_runs_schedule_id", "report_schedule_runs", ["schedule_id"])
    op.create_index("ix_report_schedule_runs_status", "report_schedule_runs", ["status"])


def downgrade() -> None:
    """Drop recurring report schedule and execution log tables."""
    op.drop_index("ix_report_schedule_runs_status", table_name="report_schedule_runs")
    op.drop_index("ix_report_schedule_runs_schedule_id", table_name="report_schedule_runs")
    op.drop_index("ix_report_schedule_runs_report_id", table_name="report_schedule_runs")
    op.drop_table("report_schedule_runs")
    op.drop_index("ix_report_schedules_is_active", table_name="report_schedules")
    op.drop_index("ix_report_schedules_frequency", table_name="report_schedules")
    op.drop_index("ix_report_schedules_actor_role", table_name="report_schedules")
    op.drop_table("report_schedules")

"""Add operational alerts, tasks, and notifications.

Revision ID: d6e7f8a9b0c1
Revises: cd5e6f7a8b90
Create Date: 2026-07-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d6e7f8a9b0c1"
down_revision: str | Sequence[str] | None = "cd5e6f7a8b90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ops_alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_type", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("scope_type", sa.String(30), nullable=False),
        sa.Column("scope_id", sa.String(80)),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("evidence_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("dedupe_key", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("dedupe_key", name="uq_ops_alert_dedupe_key"),
    )
    op.create_index("idx_ops_alert_status_severity", "ops_alerts", ["status", "severity"])
    op.create_index("idx_ops_alert_scope", "ops_alerts", ["scope_type", "scope_id"])

    op.create_table(
        "ops_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_type", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("scope_type", sa.String(30), nullable=False),
        sa.Column("scope_id", sa.String(80)),
        sa.Column("source_alert_id", sa.Integer()),
        sa.Column("assignee_user_id", sa.String(36)),
        sa.Column("assignee_role", sa.String(30)),
        sa.Column("created_by_user_id", sa.String(36), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("follow_up_at", sa.DateTime(timezone=True)),
        sa.Column("resolution_note", sa.Text()),
        sa.Column("outcome", sa.String(50)),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["source_alert_id"], ["ops_alerts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assignee_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_ops_task_queue", "ops_tasks", ["status", "priority", "due_at"])
    op.create_index("idx_ops_task_assignee", "ops_tasks", ["assignee_user_id", "status"])
    op.create_index("idx_ops_task_scope", "ops_tasks", ["scope_type", "scope_id"])

    op.create_table(
        "ops_task_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.String(36), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["task_id"], ["ops_tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_ops_task_event_task", "ops_task_events", ["task_id", "created_at"])

    op.create_table(
        "ops_task_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.String(36), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["task_id"], ["ops_tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_ops_task_comment_task", "ops_task_comments", ["task_id", "created_at"])

    op.create_table(
        "ops_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recipient_user_id", sa.String(36)),
        sa.Column("recipient_role", sa.String(30)),
        sa.Column("task_id", sa.Integer()),
        sa.Column("alert_id", sa.Integer()),
        sa.Column("notification_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("link_url", sa.String(255)),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["ops_tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["alert_id"], ["ops_alerts.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_ops_notification_recipient", "ops_notifications", ["recipient_user_id", "read_at", "created_at"])
    op.create_index("idx_ops_notification_role", "ops_notifications", ["recipient_role", "read_at", "created_at"])

    with op.batch_alter_table("intervention_cases") as batch_op:
        batch_op.add_column(sa.Column("task_id", sa.Integer()))
        batch_op.create_foreign_key("fk_intervention_case_task", "ops_tasks", ["task_id"], ["id"], ondelete="SET NULL")
    with op.batch_alter_table("student_intervention_contacts") as batch_op:
        batch_op.add_column(sa.Column("task_id", sa.Integer()))
        batch_op.create_foreign_key("fk_intervention_contact_task", "ops_tasks", ["task_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    with op.batch_alter_table("student_intervention_contacts") as batch_op:
        batch_op.drop_constraint("fk_intervention_contact_task", type_="foreignkey")
        batch_op.drop_column("task_id")
    with op.batch_alter_table("intervention_cases") as batch_op:
        batch_op.drop_constraint("fk_intervention_case_task", type_="foreignkey")
        batch_op.drop_column("task_id")
    op.drop_index("idx_ops_notification_role", table_name="ops_notifications")
    op.drop_index("idx_ops_notification_recipient", table_name="ops_notifications")
    op.drop_table("ops_notifications")
    op.drop_index("idx_ops_task_comment_task", table_name="ops_task_comments")
    op.drop_table("ops_task_comments")
    op.drop_index("idx_ops_task_event_task", table_name="ops_task_events")
    op.drop_table("ops_task_events")
    op.drop_index("idx_ops_task_scope", table_name="ops_tasks")
    op.drop_index("idx_ops_task_assignee", table_name="ops_tasks")
    op.drop_index("idx_ops_task_queue", table_name="ops_tasks")
    op.drop_table("ops_tasks")
    op.drop_index("idx_ops_alert_scope", table_name="ops_alerts")
    op.drop_index("idx_ops_alert_status_severity", table_name="ops_alerts")
    op.drop_table("ops_alerts")

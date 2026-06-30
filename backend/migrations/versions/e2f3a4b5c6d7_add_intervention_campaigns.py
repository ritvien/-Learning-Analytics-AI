"""Add learning-support intervention campaigns.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-06-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e2f3a4b5c6d7"
down_revision: str | Sequence[str] | None = "d1e2f3a4b5c6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "intervention_campaigns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.String(length=36), nullable=False),
        sa.Column("scope_type", sa.String(length=20), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=True),
        sa.Column("class_code", sa.String(length=30), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("objective", sa.String(length=50), nullable=False, server_default="early_support"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("source", sa.String(length=30), nullable=False, server_default="agent"),
        sa.Column("summary_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_intervention_campaign_actor_created",
        "intervention_campaigns",
        ["actor_user_id", "created_at"],
    )
    op.create_index("idx_intervention_campaign_scope", "intervention_campaigns", ["scope_type", "section_id", "class_code"])
    op.create_index("idx_intervention_campaign_status", "intervention_campaigns", ["status"])

    op.create_table(
        "intervention_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("contact_id", sa.Integer(), nullable=True),
        sa.Column("channel", sa.String(length=30), nullable=False, server_default="email"),
        sa.Column("recipient_email", sa.String(length=255), nullable=True),
        sa.Column("subject", sa.String(length=255), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("template_key", sa.String(length=100), nullable=True),
        sa.Column("template_version", sa.String(length=30), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="drafted"),
        sa.Column("approved_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["campaign_id"], ["intervention_campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_id"], ["student_intervention_contacts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_intervention_message_campaign", "intervention_messages", ["campaign_id"])
    op.create_index("idx_intervention_message_status", "intervention_messages", ["status"])
    op.create_index("idx_intervention_message_student", "intervention_messages", ["student_id"])

    op.create_table(
        "intervention_message_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["message_id"], ["intervention_messages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_intervention_message_event_message",
        "intervention_message_events",
        ["message_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_intervention_message_event_message", table_name="intervention_message_events")
    op.drop_table("intervention_message_events")
    op.drop_index("idx_intervention_message_student", table_name="intervention_messages")
    op.drop_index("idx_intervention_message_status", table_name="intervention_messages")
    op.drop_index("idx_intervention_message_campaign", table_name="intervention_messages")
    op.drop_table("intervention_messages")
    op.drop_index("idx_intervention_campaign_status", table_name="intervention_campaigns")
    op.drop_index("idx_intervention_campaign_scope", table_name="intervention_campaigns")
    op.drop_index("idx_intervention_campaign_actor_created", table_name="intervention_campaigns")
    op.drop_table("intervention_campaigns")

"""Add report agent storage.

Revision ID: 7c4d8e9f0a12
Revises: e102aae0a074
Create Date: 2026-06-18 16:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "7c4d8e9f0a12"
down_revision: str | None = "e102aae0a074"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create memory, prompt, session, tool-call, and pending-action tables."""
    op.create_table(
        "agent_memories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("namespace", sa.String(length=50), nullable=False),
        sa.Column("memory_type", sa.String(length=50), nullable=False),
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("value_json", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=True),
        sa.Column("confidence", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_memories_user_id", "agent_memories", ["user_id"])
    op.create_index("ix_agent_memories_namespace", "agent_memories", ["namespace"])
    op.create_index("ix_agent_memories_memory_type", "agent_memories", ["memory_type"])

    op.create_table(
        "agent_prompt_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("version", sa.String(length=30), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_prompt_versions_name", "agent_prompt_versions", ["name"])

    op.create_table(
        "report_agent_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("report_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("mode", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("scope_json", sa.JSON(), nullable=False),
        sa.Column("short_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_agent_sessions_user_id", "report_agent_sessions", ["user_id"])
    op.create_index("ix_report_agent_sessions_report_id", "report_agent_sessions", ["report_id"])

    op.create_table(
        "report_agent_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("context_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["report_agent_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_agent_messages_session_id", "report_agent_messages", ["session_id"])
    op.create_index("ix_report_agent_messages_user_id", "report_agent_messages", ["user_id"])

    op.create_table(
        "report_agent_tool_calls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("tool_name", sa.String(length=80), nullable=False),
        sa.Column("tool_input_json", sa.JSON(), nullable=False),
        sa.Column("tool_output_json", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("error_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["message_id"], ["report_agent_messages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["session_id"], ["report_agent_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_agent_tool_calls_session_id", "report_agent_tool_calls", ["session_id"])
    op.create_index("ix_report_agent_tool_calls_message_id", "report_agent_tool_calls", ["message_id"])
    op.create_index("ix_report_agent_tool_calls_user_id", "report_agent_tool_calls", ["user_id"])
    op.create_index("ix_report_agent_tool_calls_tool_name", "report_agent_tool_calls", ["tool_name"])

    op.create_table(
        "report_agent_pending_actions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("action_type", sa.String(length=80), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("result_json", sa.JSON(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["report_agent_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_agent_pending_actions_session_id", "report_agent_pending_actions", ["session_id"])
    op.create_index("ix_report_agent_pending_actions_user_id", "report_agent_pending_actions", ["user_id"])
    op.create_index("ix_report_agent_pending_actions_action_type", "report_agent_pending_actions", ["action_type"])
    op.create_index("ix_report_agent_pending_actions_status", "report_agent_pending_actions", ["status"])


def downgrade() -> None:
    """Drop report agent storage tables."""
    op.drop_index("ix_report_agent_pending_actions_status", table_name="report_agent_pending_actions")
    op.drop_index("ix_report_agent_pending_actions_action_type", table_name="report_agent_pending_actions")
    op.drop_index("ix_report_agent_pending_actions_user_id", table_name="report_agent_pending_actions")
    op.drop_index("ix_report_agent_pending_actions_session_id", table_name="report_agent_pending_actions")
    op.drop_table("report_agent_pending_actions")
    op.drop_index("ix_report_agent_tool_calls_tool_name", table_name="report_agent_tool_calls")
    op.drop_index("ix_report_agent_tool_calls_user_id", table_name="report_agent_tool_calls")
    op.drop_index("ix_report_agent_tool_calls_message_id", table_name="report_agent_tool_calls")
    op.drop_index("ix_report_agent_tool_calls_session_id", table_name="report_agent_tool_calls")
    op.drop_table("report_agent_tool_calls")
    op.drop_index("ix_report_agent_messages_user_id", table_name="report_agent_messages")
    op.drop_index("ix_report_agent_messages_session_id", table_name="report_agent_messages")
    op.drop_table("report_agent_messages")
    op.drop_index("ix_report_agent_sessions_report_id", table_name="report_agent_sessions")
    op.drop_index("ix_report_agent_sessions_user_id", table_name="report_agent_sessions")
    op.drop_table("report_agent_sessions")
    op.drop_index("ix_agent_prompt_versions_name", table_name="agent_prompt_versions")
    op.drop_table("agent_prompt_versions")
    op.drop_index("ix_agent_memories_memory_type", table_name="agent_memories")
    op.drop_index("ix_agent_memories_namespace", table_name="agent_memories")
    op.drop_index("ix_agent_memories_user_id", table_name="agent_memories")
    op.drop_table("agent_memories")

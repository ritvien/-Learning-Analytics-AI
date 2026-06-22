"""Add user behavior observability event log.

Revision ID: 2a3b4c5d6e7f
Revises: 1c2d3e4f5a6b
Create Date: 2026-06-22 17:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "2a3b4c5d6e7f"
down_revision: str | None = "1c2d3e4f5a6b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create append-only structured observability log."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute("CREATE SCHEMA IF NOT EXISTS obs")
    op.create_table(
        "event_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("event_name", sa.Text(), nullable=False),
        sa.Column("event_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("user_role", sa.Text(), nullable=True),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("request_id", sa.String(length=36), nullable=True),
        sa.Column("trace_id", sa.String(length=36), nullable=True),
        sa.Column("conversation_id", sa.String(length=36), nullable=True),
        sa.Column("agent_run_id", sa.String(length=36), nullable=True),
        sa.Column("tool_call_id", sa.String(length=36), nullable=True),
        sa.Column("retrieval_id", sa.String(length=36), nullable=True),
        sa.Column("route", sa.Text(), nullable=True),
        sa.Column("module", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.Text(), nullable=True),
        sa.Column("entity_id", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        schema="obs",
    )
    op.create_index("idx_obs_event_occurred", "event_log", ["occurred_at"], schema="obs")
    op.create_index("idx_obs_event_trace", "event_log", ["trace_id"], schema="obs")
    op.create_index("idx_obs_event_session", "event_log", ["session_id", "occurred_at"], schema="obs")
    op.create_index("idx_obs_event_name", "event_log", ["event_name", "occurred_at"], schema="obs")
    op.create_index("idx_obs_event_user", "event_log", ["user_id", "occurred_at"], schema="obs")


def downgrade() -> None:
    """Drop observability event log."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.drop_index("idx_obs_event_user", table_name="event_log", schema="obs")
    op.drop_index("idx_obs_event_name", table_name="event_log", schema="obs")
    op.drop_index("idx_obs_event_session", table_name="event_log", schema="obs")
    op.drop_index("idx_obs_event_trace", table_name="event_log", schema="obs")
    op.drop_index("idx_obs_event_occurred", table_name="event_log", schema="obs")
    op.drop_table("event_log", schema="obs")
    op.execute("DROP SCHEMA IF EXISTS obs")

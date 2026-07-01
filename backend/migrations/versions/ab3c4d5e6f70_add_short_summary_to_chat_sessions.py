"""H64: add short_summary to chat_sessions

Revision ID: ab3c4d5e6f70
Revises: 9f2b7c6d4a10
Create Date: 2026-07-01 00:49:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "ab3c4d5e6f70"
down_revision: str | Sequence[str] | None = "9f2b7c6d4a10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("chat_sessions", "short_summary"):
        op.add_column(
            "chat_sessions",
            sa.Column("short_summary", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("chat_sessions", "short_summary"):
        op.drop_column("chat_sessions", "short_summary")

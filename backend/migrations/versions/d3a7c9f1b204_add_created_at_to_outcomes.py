"""Add created_at timestamps to PLO and CLO tables.

Revision ID: d3a7c9f1b204
Revises: b7c9d0e1f2a3
Create Date: 2026-06-17 00:00:00.000000
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d3a7c9f1b204"
down_revision: str | None = "b7c9d0e1f2a3"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Align Alembic-created outcome tables with schema.sql and seed data."""
    op.execute(
        "ALTER TABLE public.plos "
        "ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    )
    op.execute(
        "ALTER TABLE public.clos "
        "ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    )


def downgrade() -> None:
    """Remove outcome timestamps."""
    op.execute("ALTER TABLE public.clos DROP COLUMN IF EXISTS created_at")
    op.execute("ALTER TABLE public.plos DROP COLUMN IF EXISTS created_at")

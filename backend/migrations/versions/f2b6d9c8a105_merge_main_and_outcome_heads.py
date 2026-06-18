"""Merge main metric views with outcome seed migrations.

Revision ID: f2b6d9c8a105
Revises: a9a181de6ed9, e4f8a6b2c901
Create Date: 2026-06-17 00:00:00.000000
"""

from __future__ import annotations


# revision identifiers, used by Alembic.
revision: str = "f2b6d9c8a105"
down_revision: tuple[str, str] = ("a9a181de6ed9", "e4f8a6b2c901")
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Merge-only migration."""


def downgrade() -> None:
    """Merge-only migration."""

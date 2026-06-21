"""Merge dashboard index and specialization hierarchy heads.

Revision ID: 1c2d3e4f5a6b
Revises: f0a1b2c3d4e5, f6a7b8c9d0e1
Create Date: 2026-06-21 16:40:00.000000
"""

from collections.abc import Sequence


revision: str = "1c2d3e4f5a6b"
down_revision: tuple[str, str] = ("f0a1b2c3d4e5", "f6a7b8c9d0e1")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Merge two independent migration branches."""


def downgrade() -> None:
    """Split merged branches."""

"""Add user position for department-scoped managers.

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-06-30 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f3a4b5c6d7e8"
down_revision: str | Sequence[str] | None = "e2f3a4b5c6d7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("position", sa.String(length=50), nullable=True))
    op.execute("UPDATE users SET position = 'department_manager' WHERE role = 'manager' AND position IS NULL")


def downgrade() -> None:
    op.drop_column("users", "position")

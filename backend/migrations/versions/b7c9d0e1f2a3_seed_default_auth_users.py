"""Seed default auth users for local/dev environments.

Revision ID: b7c9d0e1f2a3
Revises: a1f2d3e4c5b6
Create Date: 2026-06-17 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7c9d0e1f2a3"
down_revision: str | None = "a1f2d3e4c5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_PASSWORD_HASH = "$2b$12$tmit1Kg8mD/tevfYZobwIe9NpAnal/q0BvYtSBVgj790cKOFktaNS"

DEFAULT_USERS = [
    ("00000000-0000-0000-0000-000000000001", "superadmin@example.com", "Super Admin", "superadmin"),
    ("00000000-0000-0000-0000-000000000002", "admin@example.com", "Admin", "admin"),
    ("00000000-0000-0000-0000-000000000003", "manager@example.com", "Academic Manager", "manager"),
    ("00000000-0000-0000-0000-000000000004", "lecturer@example.com", "Lecturer", "lecturer"),
    ("00000000-0000-0000-0000-000000000005", "viewer@example.com", "Viewer", "viewer"),
]


def upgrade() -> None:
    """Insert or refresh default users for local login testing."""
    for user_id, email, full_name, role in DEFAULT_USERS:
        op.execute(
            f"""
            INSERT INTO users (id, email, hashed_password, full_name, role, department_id, is_active)
            VALUES (
                '{user_id}',
                '{email}',
                '{DEFAULT_PASSWORD_HASH}',
                '{full_name}',
                '{role}',
                NULL,
                TRUE
            )
            ON CONFLICT (email) DO UPDATE SET
                hashed_password = EXCLUDED.hashed_password,
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role,
                department_id = EXCLUDED.department_id,
                is_active = TRUE,
                updated_at = CURRENT_TIMESTAMP
            """
        )


def downgrade() -> None:
    """Remove only the default seeded auth users."""
    emails = "', '".join(email for _, email, _, _ in DEFAULT_USERS)
    op.execute(f"DELETE FROM users WHERE email IN ('{emails}')")

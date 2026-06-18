"""Correct electrical power courses to the Electrical Engineering department.

Revision ID: b8c2f4a1d907
Revises: a5d4e7c9b812
Create Date: 2026-06-17 00:00:00.000000
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b8c2f4a1d907"
down_revision: str | None = "a5d4e7c9b812"
branch_labels: str | None = None
depends_on: str | None = None


ELECTRICAL_POWER_COURSE_IDS = (
    168,
    170,
    203,
    223,
    287,
    288,
    289,
    290,
    292,
    293,
    295,
    297,
    298,
    299,
    301,
    302,
    303,
    304,
    305,
    318,
    320,
    401,
    405,
    406,
    407,
    409,
    411,
    413,
    414,
    415,
    416,
    419,
    424,
    427,
    430,
    431,
    432,
    434,
    435,
    436,
    438,
    440,
)


def upgrade() -> None:
    """Move electrical power/system courses from electronics-telecom to electrical engineering."""
    ids = ", ".join(str(course_id) for course_id in ELECTRICAL_POWER_COURSE_IDS)
    op.execute(f"UPDATE courses SET department_id = 12 WHERE id IN ({ids})")


def downgrade() -> None:
    """Restore previous generated mapping."""
    ids = ", ".join(str(course_id) for course_id in ELECTRICAL_POWER_COURSE_IDS)
    op.execute(f"UPDATE courses SET department_id = 7 WHERE id IN ({ids})")

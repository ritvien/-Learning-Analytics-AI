"""Add DWH dashboard performance indexes.

Revision ID: f0a1b2c3d4e5
Revises: e5f6a7b8c9d0
Create Date: 2026-06-21 09:30:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "f0a1b2c3d4e5"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create indexes used by DWH aggregate dashboard queries."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_dwh_fact_enrollment_student "
        "ON dwh.fact_enrollment_outcome (student_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_dwh_fact_enrollment_student_semester "
        "ON dwh.fact_enrollment_outcome (student_id, semester_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_dwh_fact_enrollment_updated_at "
        "ON dwh.fact_enrollment_outcome (updated_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_dwh_fact_enrollment_section "
        "ON dwh.fact_enrollment_outcome (section_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_dwh_dim_student_program "
        "ON dwh.dim_student (program_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_dwh_dim_student_cohort "
        "ON dwh.dim_student (cohort_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_dwh_dim_program_department "
        "ON dwh.dim_program (department_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_dwh_dim_semester_code "
        "ON dwh.dim_semester (code)"
    )


def downgrade() -> None:
    """Drop DWH dashboard indexes."""
    if op.get_bind().dialect.name != "postgresql":
        return

    for index_name in (
        "idx_dwh_dim_semester_code",
        "idx_dwh_dim_program_department",
        "idx_dwh_dim_student_cohort",
        "idx_dwh_dim_student_program",
        "idx_dwh_fact_enrollment_section",
        "idx_dwh_fact_enrollment_updated_at",
        "idx_dwh_fact_enrollment_student_semester",
        "idx_dwh_fact_enrollment_student",
    ):
        op.execute(f"DROP INDEX IF EXISTS dwh.{index_name}")

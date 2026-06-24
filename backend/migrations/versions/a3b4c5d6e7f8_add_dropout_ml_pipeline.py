"""Add dropout ML feature view and student_dropout_prediction table.

Revision ID: a3b4c5d6e7f8
Revises: 2a3b4c5d6e7f
Create Date: 2026-06-24 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a3b4c5d6e7f8"
down_revision: str | None = "2a3b4c5d6e7f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DROPOUT_FEATURE_VIEW_SQL = """
CREATE OR REPLACE VIEW dwh.v_student_dropout_features AS
SELECT
    ds.student_id,
    ds.student_code,
    dc.year_start AS cohort_year,
    ds.program_id,
    ds.status,
    COALESCE(agg.total_registered_credits, 0) AS total_registered_credits,
    COALESCE(agg.total_failed_credits, 0) AS total_failed_credits,
    CASE
        WHEN COALESCE(agg.total_registered_credits, 0) = 0 THEN 0
        ELSE ROUND(agg.total_failed_credits::numeric / agg.total_registered_credits, 4)
    END AS fail_rate,
    agg.cumulative_gpa,
    COALESCE(agg.semesters_enrolled, 0) AS semesters_enrolled,
    agg.latest_semester_id,
    agg.avg_semester_gpa
FROM dwh.dim_student ds
JOIN dwh.dim_cohort dc ON dc.cohort_id = ds.cohort_id
LEFT JOIN (
    SELECT
        fss.student_id,
        SUM(fss.registered_credits) AS total_registered_credits,
        SUM(fss.failed_credits) AS total_failed_credits,
        COUNT(*) AS semesters_enrolled,
        ROUND(
            SUM(fss.gpa_semester * fss.attempted_course_count)
            / NULLIF(SUM(fss.attempted_course_count), 0),
            2
        ) AS cumulative_gpa,
        ROUND(AVG(fss.gpa_semester), 2) AS avg_semester_gpa,
        (
            SELECT fss2.semester_id
            FROM dwh.fact_student_semester fss2
            WHERE fss2.student_id = fss.student_id
            ORDER BY fss2.semester_id DESC
            LIMIT 1
        ) AS latest_semester_id
    FROM dwh.fact_student_semester fss
    GROUP BY fss.student_id
) agg ON agg.student_id = ds.student_id
"""


def upgrade() -> None:
    """Create dropout feature view and prediction storage."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute(DROPOUT_FEATURE_VIEW_SQL)

    op.create_table(
        "student_dropout_prediction",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("model_run_id", sa.BigInteger(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("dropout_probability", sa.Numeric(6, 5), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("top_factors", sa.JSON()),
        sa.Column("scored_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["model_run_id"], ["ml.model_run.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("model_run_id", "student_id", name="uq_student_dropout_prediction"),
        schema="ml",
    )


def downgrade() -> None:
    """Drop dropout ML objects."""
    if op.get_bind().dialect.name != "postgresql":
        return
    op.drop_table("student_dropout_prediction", schema="ml")
    op.execute("DROP VIEW IF EXISTS dwh.v_student_dropout_features")

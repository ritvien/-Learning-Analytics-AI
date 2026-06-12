"""Add DWH and ML schemas.

Revision ID: 8b2d4c7e91af
Revises: 54025928d213
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8b2d4c7e91af"
down_revision: str | None = "54025928d213"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create PostgreSQL analytics and prediction schemas."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute("CREATE SCHEMA IF NOT EXISTS dwh")
    op.execute("CREATE SCHEMA IF NOT EXISTS ml")

    op.create_table(
        "etl_run",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("rows_processed", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text()),
        schema="dwh",
    )
    op.create_table(
        "data_quality_result",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("etl_run_id", sa.BigInteger(), nullable=False),
        sa.Column("check_name", sa.String(100), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("expected_value", sa.String(100)),
        sa.Column("actual_value", sa.String(100)),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["etl_run_id"], ["dwh.etl_run.id"], ondelete="CASCADE"),
        schema="dwh",
    )
    op.create_table(
        "dim_student",
        sa.Column("student_id", sa.Integer(), primary_key=True),
        sa.Column("student_code", sa.String(20), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("program_id", sa.Integer(), nullable=False),
        sa.Column("cohort_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="dwh",
    )
    op.create_table(
        "dim_course",
        sa.Column("course_id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(30), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("credits", sa.SmallInteger(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="dwh",
    )
    op.create_table(
        "dim_semester",
        sa.Column("semester_id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("term", sa.SmallInteger(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="dwh",
    )
    op.create_table(
        "fact_enrollment_outcome",
        sa.Column("enrollment_id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("semester_id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("credits", sa.SmallInteger(), nullable=False),
        sa.Column("final_grade", sa.Numeric(4, 2)),
        sa.Column("grade_4", sa.Numeric(3, 2)),
        sa.Column("is_passed", sa.Boolean()),
        sa.Column("attempt_number", sa.SmallInteger(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="dwh",
    )
    op.create_index(
        "idx_fact_enrollment_semester_course",
        "fact_enrollment_outcome",
        ["semester_id", "course_id"],
        schema="dwh",
    )
    op.create_table(
        "fact_student_semester",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("semester_id", sa.Integer(), nullable=False),
        sa.Column("registered_credits", sa.Integer(), nullable=False),
        sa.Column("passed_credits", sa.Integer(), nullable=False),
        sa.Column("failed_credits", sa.Integer(), nullable=False),
        sa.Column("attempted_course_count", sa.Integer(), nullable=False),
        sa.Column("passed_course_count", sa.Integer(), nullable=False),
        sa.Column("failed_course_count", sa.Integer(), nullable=False),
        sa.Column("gpa_semester", sa.Numeric(4, 2)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("student_id", "semester_id", name="uq_fact_student_semester"),
        schema="dwh",
    )

    op.create_table(
        "model_run",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("model_version", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("feature_set", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON()),
        sa.Column("artifact_uri", sa.String(500)),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("model_name", "model_version", name="uq_model_name_version"),
        schema="ml",
    )
    op.create_table(
        "enrollment_prediction",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("model_run_id", sa.BigInteger(), nullable=False),
        sa.Column("enrollment_id", sa.Integer(), nullable=False),
        sa.Column("prediction_cutoff", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pass_probability", sa.Numeric(6, 5), nullable=False),
        sa.Column("fail_probability", sa.Numeric(6, 5), nullable=False),
        sa.Column("predicted_status", sa.String(20), nullable=False),
        sa.Column("explanation", sa.JSON()),
        sa.Column("scored_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["model_run_id"], ["ml.model_run.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "model_run_id",
            "enrollment_id",
            "prediction_cutoff",
            name="uq_enrollment_prediction_cutoff",
        ),
        schema="ml",
    )
    op.create_table(
        "student_semester_prediction",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("model_run_id", sa.BigInteger(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("semester_id", sa.Integer(), nullable=False),
        sa.Column("registered_credits", sa.Integer(), nullable=False),
        sa.Column("expected_passed_credits", sa.Numeric(8, 2), nullable=False),
        sa.Column("expected_failed_credits", sa.Numeric(8, 2), nullable=False),
        sa.Column("high_risk_failed_credits", sa.Integer(), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("scored_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["model_run_id"], ["ml.model_run.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "model_run_id",
            "student_id",
            "semester_id",
            name="uq_student_semester_prediction",
        ),
        schema="ml",
    )


def downgrade() -> None:
    """Drop PostgreSQL analytics and prediction schemas."""
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("DROP SCHEMA IF EXISTS ml CASCADE")
    op.execute("DROP SCHEMA IF EXISTS dwh CASCADE")

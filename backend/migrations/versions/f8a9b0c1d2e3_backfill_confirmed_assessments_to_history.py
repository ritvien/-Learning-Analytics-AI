"""Backfill confirmed advisor assessments into student support history.

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
"""

from alembic import op

revision = "f8a9b0c1d2e3"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    metadata_value = (
        "jsonb_build_object('source', 'advisor_assessment', 'conclusion', c.advisor_conclusion, 'confirmed', true, 'backfilled', true)"
        if bind.dialect.name == "postgresql"
        else "json_object('source', 'advisor_assessment', 'conclusion', c.advisor_conclusion, 'confirmed', 1, 'backfilled', 1)"
    )
    source_check = (
        "h.metadata_json ->> 'source' = 'advisor_assessment'"
        if bind.dialect.name == "postgresql"
        else "json_extract(h.metadata_json, '$.source') = 'advisor_assessment'"
    )
    op.execute(
        f"""
        INSERT INTO student_intervention_contacts (
            case_id, task_id, actor_user_id, student_id, section_id, class_code,
            channel, status, subject, message, note, metadata_json, created_at, updated_at
        )
        SELECT
            c.id, c.task_id, c.assessment_confirmed_by_user_id, c.student_id, c.section_id, c.class_code,
            'other', 'logged', 'Nhận định hỗ trợ học tập đã xác nhận',
            c.advisor_assessment, c.advisor_action_plan, {metadata_value},
            c.assessment_confirmed_at, c.assessment_confirmed_at
        FROM intervention_cases c
        WHERE c.assessment_confirmed_at IS NOT NULL
          AND c.assessment_confirmed_by_user_id IS NOT NULL
          AND c.advisor_assessment IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM student_intervention_contacts h
              WHERE h.case_id = c.id AND {source_check}
          )
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    backfill_check = (
        "metadata_json ->> 'source' = 'advisor_assessment' AND metadata_json ->> 'backfilled' = 'true'"
        if bind.dialect.name == "postgresql"
        else "json_extract(metadata_json, '$.source') = 'advisor_assessment' AND json_extract(metadata_json, '$.backfilled') = 1"
    )
    op.execute(f"DELETE FROM student_intervention_contacts WHERE {backfill_check}")

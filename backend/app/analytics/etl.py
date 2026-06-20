"""Idempotent PostgreSQL ETL from OLTP tables into the analytics warehouse."""

import asyncio

from sqlalchemy import text

from app.analytics.clo import refresh_student_clo_achievements
from app.database import engine

DIMENSION_SQL = [
    """
    INSERT INTO dwh.dim_student (student_id, student_code, full_name, program_id, cohort_id, status, updated_at)
    SELECT id, student_code, full_name, program_id, cohort_id, status, NOW()
    FROM public.students
    ON CONFLICT (student_id) DO UPDATE SET
        student_code = EXCLUDED.student_code,
        full_name = EXCLUDED.full_name,
        program_id = EXCLUDED.program_id,
        cohort_id = EXCLUDED.cohort_id,
        status = EXCLUDED.status,
        updated_at = NOW()
    """,
    """
    INSERT INTO dwh.dim_course (course_id, code, name, credits, updated_at)
    SELECT id, code, name, credits, NOW()
    FROM public.courses
    ON CONFLICT (course_id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        credits = EXCLUDED.credits,
        updated_at = NOW()
    """,
    """
    INSERT INTO dwh.dim_semester (semester_id, code, name, year, term, updated_at)
    SELECT id, code, name, year, term, NOW()
    FROM public.semesters
    ON CONFLICT (semester_id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        year = EXCLUDED.year,
        term = EXCLUDED.term,
        updated_at = NOW()
    """,
    """
    INSERT INTO dwh.dim_section (section_id, section_code, course_id, semester_id, teacher_id, updated_at)
    SELECT id, section_code, course_id, semester_id, teacher_id, NOW()
    FROM public.sections
    ON CONFLICT (section_id) DO UPDATE SET
        section_code = EXCLUDED.section_code,
        course_id = EXCLUDED.course_id,
        semester_id = EXCLUDED.semester_id,
        teacher_id = EXCLUDED.teacher_id,
        updated_at = NOW()
    """,
    """
    INSERT INTO dwh.dim_program (program_id, code, name, department_id, updated_at)
    SELECT id, code, name, department_id, NOW()
    FROM public.programs
    ON CONFLICT (program_id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        department_id = EXCLUDED.department_id,
        updated_at = NOW()
    """,
    """
    INSERT INTO dwh.dim_cohort (cohort_id, code, year_start, updated_at)
    SELECT id, code, year_start, NOW()
    FROM public.cohorts
    ON CONFLICT (cohort_id) DO UPDATE SET
        code = EXCLUDED.code,
        year_start = EXCLUDED.year_start,
        updated_at = NOW()
    """,
]

FACT_SQL = [
    """
    INSERT INTO dwh.fact_enrollment_outcome (
        enrollment_id, student_id, course_id, semester_id, section_id,
        credits, final_grade, grade_4, is_passed, attempt_number, status, updated_at
    )
    SELECT
        e.id, e.student_id, s.course_id, s.semester_id, e.section_id,
        c.credits, e.final_grade, e.grade_4, e.is_passed, e.attempt_number, e.status, NOW()
    FROM public.enrollments e
    JOIN public.sections s ON s.id = e.section_id
    JOIN public.courses c ON c.id = s.course_id
    ON CONFLICT (enrollment_id) DO UPDATE SET
        student_id = EXCLUDED.student_id,
        course_id = EXCLUDED.course_id,
        semester_id = EXCLUDED.semester_id,
        section_id = EXCLUDED.section_id,
        credits = EXCLUDED.credits,
        final_grade = EXCLUDED.final_grade,
        grade_4 = EXCLUDED.grade_4,
        is_passed = EXCLUDED.is_passed,
        attempt_number = EXCLUDED.attempt_number,
        status = EXCLUDED.status,
        updated_at = NOW()
    """,
    """
    INSERT INTO dwh.fact_grade_component (
        component_id, enrollment_id, component_type_id, student_id, course_id, section_id, semester_id,
        score, max_score, is_absent, assessed_at, recorded_at, updated_at
    )
    SELECT
        gc.id, gc.enrollment_id, gc.component_type_id, e.student_id, s.course_id, e.section_id, s.semester_id,
        gc.score, gc.max_score, gc.is_absent, gc.assessed_at, gc.recorded_at, NOW()
    FROM public.grade_components gc
    JOIN public.enrollments e ON e.id = gc.enrollment_id
    JOIN public.sections s ON s.id = e.section_id
    ON CONFLICT (component_id) DO UPDATE SET
        enrollment_id = EXCLUDED.enrollment_id,
        component_type_id = EXCLUDED.component_type_id,
        student_id = EXCLUDED.student_id,
        course_id = EXCLUDED.course_id,
        section_id = EXCLUDED.section_id,
        semester_id = EXCLUDED.semester_id,
        score = EXCLUDED.score,
        max_score = EXCLUDED.max_score,
        is_absent = EXCLUDED.is_absent,
        assessed_at = EXCLUDED.assessed_at,
        recorded_at = EXCLUDED.recorded_at,
        updated_at = NOW()
    """,
    """
    INSERT INTO dwh.fact_clo_achievement (
        enrollment_id, clo_id, student_id, course_id, section_id, semester_id,
        achievement_score, is_achieved, updated_at
    )
    SELECT
        e.id AS enrollment_id,
        gccm.clo_id,
        e.student_id,
        s.course_id,
        e.section_id,
        s.semester_id,
        ROUND(
            SUM(gc.score * gccm.weight * gct.weight) / NULLIF(SUM(gccm.weight * gct.weight), 0),
            2
        ) AS achievement_score,
        (
            SUM(gc.score * gccm.weight * gct.weight) / NULLIF(SUM(gccm.weight * gct.weight), 0)
        ) >= 4.0 AS is_achieved,
        NOW()
    FROM public.enrollments e
    JOIN public.sections s ON s.id = e.section_id
    JOIN public.grade_components gc ON gc.enrollment_id = e.id
    JOIN public.grade_component_types gct ON gct.id = gc.component_type_id
    JOIN public.grade_component_clo_mappings gccm ON gccm.component_type_id = gct.id
    WHERE gc.score IS NOT NULL
    GROUP BY e.id, gccm.clo_id, e.student_id, s.course_id, e.section_id, s.semester_id
    ON CONFLICT (enrollment_id, clo_id) DO UPDATE SET
        student_id = EXCLUDED.student_id,
        course_id = EXCLUDED.course_id,
        section_id = EXCLUDED.section_id,
        semester_id = EXCLUDED.semester_id,
        achievement_score = EXCLUDED.achievement_score,
        is_achieved = EXCLUDED.is_achieved,
        updated_at = NOW()
    """,
    """
    INSERT INTO dwh.fact_student_semester (
        student_id, semester_id, registered_credits, passed_credits, failed_credits,
        attempted_course_count, passed_course_count, failed_course_count, gpa_semester, updated_at
    )
    SELECT
        student_id,
        semester_id,
        SUM(credits)::INTEGER,
        COALESCE(SUM(credits) FILTER (WHERE is_passed IS TRUE), 0)::INTEGER,
        COALESCE(SUM(credits) FILTER (WHERE is_passed IS FALSE), 0)::INTEGER,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE is_passed IS TRUE)::INTEGER,
        COUNT(*) FILTER (WHERE is_passed IS FALSE)::INTEGER,
        ROUND(AVG(final_grade), 2),
        NOW()
    FROM dwh.fact_enrollment_outcome
    GROUP BY student_id, semester_id
    ON CONFLICT (student_id, semester_id) DO UPDATE SET
        registered_credits = EXCLUDED.registered_credits,
        passed_credits = EXCLUDED.passed_credits,
        failed_credits = EXCLUDED.failed_credits,
        attempted_course_count = EXCLUDED.attempted_course_count,
        passed_course_count = EXCLUDED.passed_course_count,
        failed_course_count = EXCLUDED.failed_course_count,
        gpa_semester = EXCLUDED.gpa_semester,
        updated_at = NOW()
    """,
]


async def refresh_dwh() -> int:
    """Refresh DWH dimensions and facts, returning the ETL run ID."""
    if engine.dialect.name != "postgresql":
        raise RuntimeError("DWH refresh requires PostgreSQL")

    async with engine.begin() as connection:
        run_id = (
            await connection.execute(
                text("INSERT INTO dwh.etl_run (status, started_at) VALUES ('running', NOW()) RETURNING id")
            )
        ).scalar_one()
        try:
            await refresh_student_clo_achievements(connection)

            for statement in DIMENSION_SQL + FACT_SQL:
                await connection.execute(text(statement))

            oltp_count = (await connection.execute(text("SELECT COUNT(*) FROM public.enrollments"))).scalar_one()
            dwh_count = (
                await connection.execute(text("SELECT COUNT(*) FROM dwh.fact_enrollment_outcome"))
            ).scalar_one()
            component_oltp_count = (
                await connection.execute(text("SELECT COUNT(*) FROM public.grade_components"))
            ).scalar_one()
            component_dwh_count = (
                await connection.execute(text("SELECT COUNT(*) FROM dwh.fact_grade_component"))
            ).scalar_one()
            passed = oltp_count == dwh_count and component_oltp_count == component_dwh_count
            await connection.execute(
                text(
                    """
                    INSERT INTO dwh.data_quality_result
                        (etl_run_id, check_name, passed, expected_value, actual_value, checked_at)
                    VALUES (:run_id, 'enrollment_count_reconciliation', :passed, :expected, :actual, NOW())
                    """
                ),
                {
                    "run_id": run_id,
                    "passed": oltp_count == dwh_count,
                    "expected": str(oltp_count),
                    "actual": str(dwh_count),
                },
            )
            await connection.execute(
                text(
                    """
                    INSERT INTO dwh.data_quality_result
                        (etl_run_id, check_name, passed, expected_value, actual_value, checked_at)
                    VALUES (:run_id, 'grade_component_count_reconciliation', :passed, :expected, :actual, NOW())
                    """
                ),
                {
                    "run_id": run_id,
                    "passed": component_oltp_count == component_dwh_count,
                    "expected": str(component_oltp_count),
                    "actual": str(component_dwh_count),
                },
            )
            await connection.execute(
                text(
                    """
                    UPDATE dwh.etl_run
                    SET status = :status, completed_at = NOW(), rows_processed = :rows
                    WHERE id = :run_id
                    """
                ),
                {"run_id": run_id, "status": "completed" if passed else "failed", "rows": dwh_count},
            )
            if not passed:
                raise RuntimeError(
                    "DWH reconciliation failed: "
                    f"enrollments OLTP={oltp_count}, DWH={dwh_count}; "
                    f"components OLTP={component_oltp_count}, DWH={component_dwh_count}"
                )
        except Exception:
            await connection.execute(
                text("UPDATE dwh.etl_run SET status = 'failed', completed_at = NOW() WHERE id = :run_id"),
                {"run_id": run_id},
            )
            raise
    return run_id


if __name__ == "__main__":
    print(f"Completed DWH ETL run {asyncio.run(refresh_dwh())}")

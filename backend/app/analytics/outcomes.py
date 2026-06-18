"""Outcome attainment engine and read queries for CLO/PLO analytics."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


DEFAULT_THRESHOLD = 50.0


async def recalculate_clo_achievements(db: AsyncSession, threshold: float = DEFAULT_THRESHOLD) -> int:
    """Recompute student CLO achievement from grade components and component-CLO mappings."""
    result = await db.execute(
        text(
            """
            WITH scored AS (
                SELECT
                    e.id AS enrollment_id,
                    gccm.clo_id,
                    SUM(
                        CASE
                            WHEN gc.score IS NULL THEN NULL
                            WHEN gc.max_score <= 0 THEN NULL
                            ELSE (gc.score / gc.max_score) * 100.0 * gccm.weight * gct.weight
                        END
                    ) / NULLIF(
                        SUM(
                            CASE
                                WHEN gc.score IS NULL THEN NULL
                                WHEN gc.max_score <= 0 THEN NULL
                                ELSE gccm.weight * gct.weight
                            END
                        ),
                        0
                    ) AS achievement_score
                FROM enrollments e
                JOIN grade_components gc ON gc.enrollment_id = e.id
                JOIN grade_component_types gct ON gct.id = gc.component_type_id
                JOIN grade_component_clo_mappings gccm ON gccm.component_type_id = gct.id
                GROUP BY e.id, gccm.clo_id
            ),
            upserted AS (
                INSERT INTO student_clo_achievements (enrollment_id, clo_id, achievement_score, is_achieved)
                SELECT
                    enrollment_id,
                    clo_id,
                    ROUND(achievement_score, 2),
                    achievement_score >= :threshold
                FROM scored
                WHERE achievement_score IS NOT NULL
                ON CONFLICT (enrollment_id, clo_id) DO UPDATE SET
                    achievement_score = EXCLUDED.achievement_score,
                    is_achieved = EXCLUDED.is_achieved
                RETURNING id
            )
            SELECT COUNT(*) FROM upserted
            """
        ),
        {"threshold": threshold},
    )
    return int(result.scalar_one())


async def recalculate_plo_achievements(db: AsyncSession, threshold: float = DEFAULT_THRESHOLD) -> int:
    """Recompute student PLO achievement from cached CLO scores and CLO-PLO mappings."""
    result = await db.execute(
        text(
            """
            WITH scored AS (
                SELECT
                    e.student_id,
                    st.program_id,
                    p.id AS plo_id,
                    SUM(sca.achievement_score * cpm.contribution) / NULLIF(SUM(cpm.contribution), 0)
                        AS achievement_score,
                    COUNT(DISTINCT sca.clo_id) AS evidence_count
                FROM student_clo_achievements sca
                JOIN enrollments e ON e.id = sca.enrollment_id
                JOIN students st ON st.id = e.student_id
                JOIN clo_plo_mappings cpm ON cpm.clo_id = sca.clo_id
                JOIN plos p ON p.id = cpm.plo_id AND p.program_id = st.program_id
                WHERE sca.achievement_score IS NOT NULL
                GROUP BY e.student_id, st.program_id, p.id
            ),
            upserted AS (
                INSERT INTO student_plo_achievements
                    (student_id, program_id, plo_id, achievement_score, evidence_count, is_achieved, updated_at)
                SELECT
                    student_id,
                    program_id,
                    plo_id,
                    ROUND(achievement_score, 2),
                    evidence_count,
                    achievement_score >= :threshold,
                    NOW()
                FROM scored
                ON CONFLICT (student_id, plo_id) DO UPDATE SET
                    program_id = EXCLUDED.program_id,
                    achievement_score = EXCLUDED.achievement_score,
                    evidence_count = EXCLUDED.evidence_count,
                    is_achieved = EXCLUDED.is_achieved,
                    updated_at = NOW()
                RETURNING id
            )
            SELECT COUNT(*) FROM upserted
            """
        ),
        {"threshold": threshold},
    )
    return int(result.scalar_one())


async def recalculate_outcomes(db: AsyncSession, threshold: float = DEFAULT_THRESHOLD) -> dict[str, int | float]:
    """Recalculate both CLO and PLO achievement caches."""
    clo_rows = await recalculate_clo_achievements(db, threshold)
    plo_rows = await recalculate_plo_achievements(db, threshold)
    return {"threshold": threshold, "clo_rows": clo_rows, "plo_rows": plo_rows}


async def get_program_plo_attainment(db: AsyncSession, program_id: int) -> list[dict[str, Any]]:
    """Return aggregated PLO attainment for a program."""
    result = await db.execute(
        text(
            """
            SELECT
                p.id AS plo_id,
                p.code,
                p.name,
                p.description,
                COUNT(spa.id)::INTEGER AS assessed_students,
                ROUND(AVG(spa.achievement_score), 2)::FLOAT AS avg_score,
                COUNT(spa.id) FILTER (WHERE spa.is_achieved IS TRUE)::INTEGER AS achieved_students,
                ROUND(
                    COUNT(spa.id) FILTER (WHERE spa.is_achieved IS TRUE)::NUMERIC
                    / NULLIF(COUNT(spa.id), 0) * 100,
                    2
                )::FLOAT AS attainment_rate,
                COALESCE(SUM(spa.evidence_count), 0)::INTEGER AS evidence_count
            FROM plos p
            LEFT JOIN student_plo_achievements spa ON spa.plo_id = p.id
            WHERE p.program_id = :program_id
            GROUP BY p.id, p.code, p.name, p.description, p.sort_order
            ORDER BY p.sort_order, p.id
            """
        ),
        {"program_id": program_id},
    )
    return [dict(row) for row in result.mappings().all()]


async def get_course_clo_attainment(
    db: AsyncSession,
    course_id: int,
    section_id: int | None = None,
) -> list[dict[str, Any]]:
    """Return aggregated CLO attainment for a course, optionally scoped to one section."""
    section_filter = "AND sec.id = :section_id" if section_id is not None else ""
    result = await db.execute(
        text(
            f"""
            SELECT
                c.id AS clo_id,
                c.code,
                c.name,
                c.description,
                COUNT(sca.id)::INTEGER AS assessed_enrollments,
                ROUND(AVG(sca.achievement_score), 2)::FLOAT AS avg_score,
                COUNT(sca.id) FILTER (WHERE sca.is_achieved IS TRUE)::INTEGER AS achieved_enrollments,
                ROUND(
                    COUNT(sca.id) FILTER (WHERE sca.is_achieved IS TRUE)::NUMERIC
                    / NULLIF(COUNT(sca.id), 0) * 100,
                    2
                )::FLOAT AS attainment_rate
            FROM clos c
            LEFT JOIN student_clo_achievements sca ON sca.clo_id = c.id
            LEFT JOIN enrollments e ON e.id = sca.enrollment_id
            LEFT JOIN sections sec ON sec.id = e.section_id
            WHERE c.course_id = :course_id
            {section_filter}
            GROUP BY c.id, c.code, c.name, c.description, c.sort_order
            ORDER BY c.sort_order, c.id
            """
        ),
        {"course_id": course_id, "section_id": section_id},
    )
    return [dict(row) for row in result.mappings().all()]


async def get_student_outcome_profile(db: AsyncSession, student_id: int) -> dict[str, Any]:
    """Return one student's PLO and CLO outcome profile."""
    student = (
        await db.execute(
            text(
                """
                SELECT st.id, st.student_code, st.full_name, st.program_id, p.name AS program_name
                FROM students st
                JOIN programs p ON p.id = st.program_id
                WHERE st.id = :student_id
                """
            ),
            {"student_id": student_id},
        )
    ).mappings().one_or_none()
    if student is None:
        return {"student": None, "plos": [], "weak_clos": []}

    plos = (
        await db.execute(
            text(
                """
                SELECT
                    p.id AS plo_id,
                    p.code,
                    p.name,
                    spa.achievement_score::FLOAT AS achievement_score,
                    spa.evidence_count,
                    spa.is_achieved
                FROM plos p
                LEFT JOIN student_plo_achievements spa
                    ON spa.plo_id = p.id AND spa.student_id = :student_id
                WHERE p.program_id = :program_id
                ORDER BY p.sort_order, p.id
                """
            ),
            {"student_id": student_id, "program_id": student["program_id"]},
        )
    ).mappings().all()

    weak_clos = (
        await db.execute(
            text(
                """
                SELECT
                    sca.clo_id,
                    cl.code AS clo_code,
                    cl.name AS clo_name,
                    co.id AS course_id,
                    co.code AS course_code,
                    co.name AS course_name,
                    MIN(sca.achievement_score)::FLOAT AS weakest_score,
                    BOOL_OR(sca.is_achieved IS FALSE) AS has_unachieved
                FROM student_clo_achievements sca
                JOIN enrollments e ON e.id = sca.enrollment_id
                JOIN sections sec ON sec.id = e.section_id
                JOIN courses co ON co.id = sec.course_id
                JOIN clos cl ON cl.id = sca.clo_id
                WHERE e.student_id = :student_id
                GROUP BY sca.clo_id, cl.code, cl.name, co.id, co.code, co.name
                HAVING BOOL_OR(sca.is_achieved IS FALSE)
                ORDER BY weakest_score ASC NULLS LAST, co.id, cl.code
                LIMIT 20
                """
            ),
            {"student_id": student_id},
        )
    ).mappings().all()

    return {
        "student": dict(student),
        "plos": [dict(row) for row in plos],
        "weak_clos": [dict(row) for row in weak_clos],
    }


async def get_outcome_gaps(db: AsyncSession, program_id: int | None = None, limit: int = 10) -> dict[str, Any]:
    """Return weakest PLO and CLO aggregates, optionally scoped to a program."""
    program_filter = "WHERE p.program_id = :program_id" if program_id is not None else ""
    plo_rows = (
        await db.execute(
            text(
                f"""
                SELECT
                    p.program_id,
                    pr.name AS program_name,
                    p.id AS plo_id,
                    p.code,
                    p.name,
                    ROUND(AVG(spa.achievement_score), 2)::FLOAT AS avg_score,
                    ROUND(
                        COUNT(spa.id) FILTER (WHERE spa.is_achieved IS TRUE)::NUMERIC
                        / NULLIF(COUNT(spa.id), 0) * 100,
                        2
                    )::FLOAT AS attainment_rate,
                    COUNT(spa.id)::INTEGER AS assessed_students
                FROM plos p
                JOIN programs pr ON pr.id = p.program_id
                LEFT JOIN student_plo_achievements spa ON spa.plo_id = p.id
                {program_filter}
                GROUP BY p.program_id, pr.name, p.id, p.code, p.name
                HAVING COUNT(spa.id) > 0
                ORDER BY attainment_rate ASC NULLS LAST, avg_score ASC NULLS LAST
                LIMIT :limit
                """
            ),
            {"program_id": program_id, "limit": limit},
        )
    ).mappings().all()

    clo_program_join = """
        JOIN program_courses pc ON pc.course_id = co.id
        JOIN programs pr ON pr.id = pc.program_id
    """
    clo_program_filter = "AND pc.program_id = :program_id" if program_id is not None else ""
    clo_rows = (
        await db.execute(
            text(
                f"""
                SELECT
                    co.id AS course_id,
                    co.name AS course_name,
                    cl.id AS clo_id,
                    cl.code,
                    cl.name,
                    ROUND(AVG(sca.achievement_score), 2)::FLOAT AS avg_score,
                    ROUND(
                        COUNT(sca.id) FILTER (WHERE sca.is_achieved IS TRUE)::NUMERIC
                        / NULLIF(COUNT(sca.id), 0) * 100,
                        2
                    )::FLOAT AS attainment_rate,
                    COUNT(sca.id)::INTEGER AS assessed_enrollments
                FROM clos cl
                JOIN courses co ON co.id = cl.course_id
                {clo_program_join}
                LEFT JOIN student_clo_achievements sca ON sca.clo_id = cl.id
                WHERE TRUE {clo_program_filter}
                GROUP BY co.id, co.name, cl.id, cl.code, cl.name
                HAVING COUNT(sca.id) > 0
                ORDER BY attainment_rate ASC NULLS LAST, avg_score ASC NULLS LAST
                LIMIT :limit
                """
            ),
            {"program_id": program_id, "limit": limit},
        )
    ).mappings().all()

    return {
        "weak_plos": [dict(row) for row in plo_rows],
        "weak_clos": [dict(row) for row in clo_rows],
    }

"""Audit catalog inputs for transcript-first synthetic demo coverage v5."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path

import asyncpg

SOURCE = "synthetic_transcript_coverage_v5"
PROGRAM_LIMIT = 12
SEMESTER_LIMIT = 4
COHORTS_PER_PROGRAM = 2


def _dsn(value: str) -> str:
    return value.replace("postgresql+asyncpg://", "postgresql://", 1)


async def run(database_url: str, program_limit: int = PROGRAM_LIMIT) -> dict:
    conn = await asyncpg.connect(_dsn(database_url))
    try:
        semesters = [
            dict(row)
            for row in await conn.fetch(
                """
                SELECT s.id, s.code, s.name, s.year, s.term, COUNT(f.enrollment_id)::INTEGER AS enrollments
                FROM semesters s
                JOIN dwh.fact_enrollment_outcome f ON f.semester_id = s.id
                WHERE s.term IN (1, 2)
                GROUP BY s.id, s.code, s.name, s.year, s.term
                HAVING COUNT(f.enrollment_id) >= 1000
                ORDER BY s.year DESC, s.term DESC
                LIMIT $1
                """,
                SEMESTER_LIMIT,
            )
        ]
        semesters = list(reversed(semesters))
        cohort_rows = [
            dict(row)
            for row in await conn.fetch(
                """
                SELECT id, code, year_start
                FROM cohorts
                ORDER BY year_start DESC, code DESC
                LIMIT 6
                """
            )
        ]
        programs = [
            dict(row)
            for row in await conn.fetch(
                """
                WITH student_counts AS (
                    SELECT program_id,
                           COUNT(*) FILTER (WHERE is_active IS TRUE)::INTEGER AS students,
                           COUNT(DISTINCT class_code) FILTER (WHERE class_code IS NOT NULL)::INTEGER AS classes
                    FROM students
                    GROUP BY program_id
                ),
                enrollment_counts AS (
                    SELECT s.program_id, COUNT(e.id)::INTEGER AS enrollments
                    FROM students s
                    JOIN enrollments e ON e.student_id = s.id
                    GROUP BY s.program_id
                ),
                course_counts AS (
                    SELECT program_id, COUNT(course_id)::INTEGER AS courses
                    FROM program_courses
                    GROUP BY program_id
                )
                SELECT p.id AS program_id, p.code AS program_code, p.name AS program_name, p.department_id,
                       d.name AS department_name,
                       COALESCE(sc.students, 0) AS students,
                       COALESCE(sc.classes, 0) AS classes,
                       COALESCE(ec.enrollments, 0) AS enrollments,
                       COALESCE(cc.courses, 0) AS courses
                FROM programs p
                JOIN departments d ON d.id = p.department_id
                LEFT JOIN student_counts sc ON sc.program_id = p.id
                LEFT JOIN enrollment_counts ec ON ec.program_id = p.id
                LEFT JOIN course_counts cc ON cc.program_id = p.id
                WHERE p.is_active IS TRUE AND COALESCE(cc.courses, 0) >= 20
                ORDER BY COALESCE(ec.enrollments, 0) DESC, COALESCE(sc.students, 0) DESC, COALESCE(cc.courses, 0) DESC
                LIMIT $1
                """,
                program_limit,
            )
        ]
        payload_programs = []
        for program in programs:
            program_id = program["program_id"]
            department_id = program["department_id"]
            program_cohorts = [
                dict(row)
                for row in await conn.fetch(
                    """
                    SELECT c.id, c.code, c.year_start, COUNT(s.id)::INTEGER AS students
                    FROM cohorts c
                    LEFT JOIN students s ON s.cohort_id = c.id AND s.program_id = $1
                    GROUP BY c.id, c.code, c.year_start
                    ORDER BY COUNT(s.id) DESC, c.year_start DESC, c.code DESC
                    LIMIT $2
                    """,
                    program_id,
                    COHORTS_PER_PROGRAM,
                )
            ]
            if len(program_cohorts) < COHORTS_PER_PROGRAM:
                seen = {row["id"] for row in program_cohorts}
                program_cohorts.extend(row for row in cohort_rows if row["id"] not in seen)
                program_cohorts = program_cohorts[:COHORTS_PER_PROGRAM]
            specializations = [
                dict(row)
                for row in await conn.fetch(
                    """
                    SELECT id, code, name
                    FROM specializations
                    WHERE program_id = $1 AND is_active IS TRUE
                    ORDER BY is_placeholder ASC, id
                    """,
                    program_id,
                )
            ]
            teachers = [
                dict(row)
                for row in await conn.fetch(
                    """
                    SELECT id, full_name
                    FROM teachers
                    WHERE department_id = $1 AND is_active IS TRUE
                    ORDER BY id
                    LIMIT 8
                    """,
                    department_id,
                )
            ]
            if not teachers:
                teachers = [
                    dict(row)
                    for row in await conn.fetch(
                        """
                        SELECT id, full_name
                        FROM teachers
                        WHERE is_active IS TRUE
                        ORDER BY id
                        LIMIT 8
                        """
                    )
                ]
            courses = [
                dict(row)
                for row in await conn.fetch(
                    """
                    WITH course_activity AS (
                        SELECT sec.course_id, COUNT(e.id)::INTEGER AS enrollments
                        FROM sections sec
                        JOIN enrollments e ON e.section_id = sec.id
                        GROUP BY sec.course_id
                    ),
                    clo_stats AS (
                        SELECT c.id AS course_id,
                               COUNT(DISTINCT clo.id)::INTEGER AS clo_count,
                               COUNT(DISTINCT cpm.plo_id)::INTEGER AS course_plo_count,
                               COUNT(DISTINCT clop.plo_id)::INTEGER AS clo_plo_count
                        FROM courses c
                        LEFT JOIN clos clo ON clo.course_id = c.id AND clo.is_active IS TRUE
                        LEFT JOIN course_plos cpm ON cpm.course_id = c.id
                        LEFT JOIN clo_plo_mappings clop ON clop.clo_id = clo.id
                        GROUP BY c.id
                    )
                    SELECT c.id AS course_id, c.code, c.name, c.credits, c.is_elective,
                           COALESCE(ca.enrollments, 0) AS enrollments,
                           COALESCE(cs.clo_count, 0) AS clo_count,
                           COALESCE(cs.course_plo_count, 0) AS course_plo_count,
                           COALESCE(cs.clo_plo_count, 0) AS clo_plo_count
                    FROM program_courses pc
                    JOIN courses c ON c.id = pc.course_id
                    LEFT JOIN course_activity ca ON ca.course_id = c.id
                    LEFT JOIN clo_stats cs ON cs.course_id = c.id
                    WHERE pc.program_id = $1 AND c.is_active IS TRUE
                    ORDER BY
                        CASE WHEN COALESCE(cs.clo_count, 0) >= 3 THEN 0 ELSE 1 END,
                        COALESCE(cs.clo_plo_count, 0) DESC,
                        COALESCE(ca.enrollments, 0) DESC,
                        c.id
                    LIMIT 40
                    """,
                    program_id,
                )
            ]
            if len(courses) < 20:
                continue
            payload_programs.append({
                **program,
                "cohorts": program_cohorts,
                "specializations": specializations,
                "teachers": teachers,
                "courses": courses,
            })
        summary = {
            "source": SOURCE,
            "programs": len(payload_programs),
            "semesters": len(semesters),
            "cohorts_per_program": COHORTS_PER_PROGRAM,
            "candidate_courses": sum(len(program["courses"]) for program in payload_programs),
        }
        return {
            "schema_version": 1,
            "summary": summary,
            "semesters": semesters,
            "programs": payload_programs,
        }
    finally:
        await conn.close()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--program-limit", type=int, default=PROGRAM_LIMIT)
    args = parser.parse_args()
    if not args.database_url:
        raise RuntimeError("DATABASE_URL is required")
    payload = await run(args.database_url, args.program_limit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["summary"], ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())

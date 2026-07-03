"""Export the read-only catalog/coverage snapshot consumed by the v3 generator."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path

import asyncpg


async def run(database_url: str) -> dict:
    conn = await asyncpg.connect(database_url.replace("postgresql+asyncpg://", "postgresql://", 1))
    try:
        rows = await conn.fetch("""
            SELECT p.id AS program_id, p.code AS program_code,
                   COUNT(DISTINCT s.id) FILTER (WHERE s.is_active AND EXISTS (
                       SELECT 1 FROM enrollments e WHERE e.student_id = s.id
                   ))::INTEGER AS active_students_with_enrollments,
                   COALESCE(array_agg(DISTINCT pc.course_id) FILTER (WHERE pc.course_id IS NOT NULL), '{}') AS course_ids,
                   COALESCE(array_agg(DISTINCT s.cohort_id) FILTER (WHERE s.cohort_id IS NOT NULL), '{}') AS cohort_ids
            FROM programs p
            LEFT JOIN students s ON s.program_id = p.id
            LEFT JOIN program_courses pc ON pc.program_id = p.id
            WHERE p.is_active
            GROUP BY p.id, p.code
            ORDER BY p.id
        """)
        semesters = [row["id"] for row in await conn.fetch(
            "SELECT id FROM semesters ORDER BY year, term"
        )]
        cohort_ids = [row["id"] for row in await conn.fetch("SELECT id FROM cohorts ORDER BY year_start")]
        teachers_by_department: dict[int, list[int]] = {}
        for row in await conn.fetch("SELECT id, department_id FROM teachers WHERE is_active"):
            teachers_by_department.setdefault(row["department_id"], []).append(row["id"])
        departments = {row["id"]: row["department_id"] for row in await conn.fetch("SELECT id, department_id FROM programs")}
        catalog_rows = []
        for row in rows:
            payload = dict(row)
            payload["course_ids"] = list(payload["course_ids"])
            payload["cohort_ids"] = list(payload["cohort_ids"])
            if len(payload["course_ids"]) < 5:
                payload["course_ids"] = [row["id"] for row in await conn.fetch(
                    "SELECT id FROM courses WHERE department_id=$1 AND is_active ORDER BY id LIMIT 8",
                    departments[payload["program_id"]],
                )]
            if not payload["cohort_ids"]:
                payload["cohort_ids"] = cohort_ids[-2:]
            payload["semester_ids"] = semesters
            payload["teacher_ids"] = teachers_by_department.get(departments[payload["program_id"]], [])
            catalog_rows.append(payload)
        return {"schema_version": 1, "programs": catalog_rows}
    finally:
        await conn.close()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if not args.database_url:
        raise RuntimeError("DATABASE_URL is required")
    payload = await run(args.database_url)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"programs={len(payload['programs'])} output={args.output}")


if __name__ == "__main__":
    asyncio.run(main())

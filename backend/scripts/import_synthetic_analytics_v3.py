"""Idempotently import or roll back a deterministic synthetic analytics artifact."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path

import asyncpg

ALLOWED_ENVS = {"development", "dev", "staging", "demo"}
SOURCE = "synthetic_analytics_v3"


def require_safe_environment(app_env: str) -> None:
    if app_env.strip().lower() not in ALLOWED_ENVS:
        raise RuntimeError("Synthetic analytics import is blocked outside development/staging/demo")


async def _lineage(conn: asyncpg.Connection, entity_type: str, entity_id: int, artifact: dict) -> None:
    await conn.execute("""
        INSERT INTO synthetic_data_lineage (source, entity_type, entity_id, seed, official, derivation, created_at, updated_at)
        VALUES ($1,$2,$3,$4,false,$5::jsonb,now(),now())
        ON CONFLICT (source, entity_type, entity_id) DO UPDATE
        SET seed=EXCLUDED.seed, derivation=EXCLUDED.derivation, updated_at=now()
    """, SOURCE, entity_type, entity_id, artifact["seed"], json.dumps({"derivation": artifact["derivation"]}))


def _grade_fields(value: float | None) -> tuple[str | None, float | None, bool | None, str]:
    if value is None:
        return None, None, None, "enrolled"
    if value >= 8.5:
        return "A", 4.0, True, "completed"
    if value >= 7:
        return "B", 3.0, True, "completed"
    if value >= 5.5:
        return "C", 2.0, True, "completed"
    if value >= 4:
        return "D", 1.0, True, "completed"
    return "F", 0.0, False, "completed"


async def import_artifact(conn: asyncpg.Connection, artifact: dict) -> dict[str, int]:
    if artifact.get("source") != SOURCE or artifact.get("official") is not False:
        raise ValueError("Invalid synthetic analytics v3 lineage contract")
    counts = {"students": 0, "sections": 0, "enrollments": 0, "grade_components": 0}
    async with conn.transaction():
        for program in artifact["programs"]:
            section_ids: dict[str, int] = {}
            for section in program["sections"]:
                row = await conn.fetchrow("""
                    INSERT INTO sections (course_id, teacher_id, semester_id, section_code, max_students, is_active, created_at, updated_at)
                    VALUES ($1,$2,$3,$4,$5,true,now(),now())
                    ON CONFLICT (course_id, semester_id, section_code) DO UPDATE
                    SET teacher_id=EXCLUDED.teacher_id, max_students=EXCLUDED.max_students, is_active=true, updated_at=now()
                    RETURNING id
                """, section["course_id"], section["teacher_id"], section["semester_id"], section["natural_key"], section["max_students"])
                section_ids[section["natural_key"]] = row["id"]
                await _lineage(conn, "section", row["id"], artifact)
                counts["sections"] += 1
            for student in program["students"]:
                row = await conn.fetchrow("""
                    INSERT INTO students (program_id, cohort_id, student_code, full_name, class_code, status,
                                          gpa_cumulative, is_active, created_at, updated_at)
                    VALUES ($1,$2,$3,$4,$5,'active',$6,true,now(),now())
                    ON CONFLICT (student_code) DO UPDATE SET program_id=EXCLUDED.program_id, cohort_id=EXCLUDED.cohort_id,
                        full_name=EXCLUDED.full_name, class_code=EXCLUDED.class_code, gpa_cumulative=EXCLUDED.gpa_cumulative,
                        is_active=true, updated_at=now()
                    RETURNING id
                """, student["program_id"], student["cohort_id"], student["student_code"], student["full_name"],
                    student["class_code"], student["gpa_cumulative"])
                student_id = row["id"]
                await _lineage(conn, "student", student_id, artifact)
                counts["students"] += 1
                for enrollment in student["enrollments"]:
                    section_id = section_ids[enrollment["section_key"]]
                    letter, grade4, passed, state = _grade_fields(enrollment["final_grade"])
                    credits = await conn.fetchval("SELECT credits FROM courses WHERE id=$1", enrollment["course_id"])
                    erow = await conn.fetchrow("""
                        INSERT INTO enrollments (student_id, section_id, final_grade, grade_letter, grade_4, is_passed,
                                                 registered_credits, completed_at, attempt_number, status, created_at, updated_at)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,CASE WHEN $3::numeric IS NULL THEN NULL ELSE now() END,1,$8,now(),now())
                        ON CONFLICT (student_id, section_id, attempt_number) DO UPDATE SET final_grade=EXCLUDED.final_grade,
                            grade_letter=EXCLUDED.grade_letter, grade_4=EXCLUDED.grade_4, is_passed=EXCLUDED.is_passed,
                            registered_credits=EXCLUDED.registered_credits, completed_at=EXCLUDED.completed_at,
                            status=EXCLUDED.status, updated_at=now()
                        RETURNING id
                    """, student_id, section_id, enrollment["final_grade"], letter, grade4, passed, credits, state)
                    await _lineage(conn, "enrollment", erow["id"], artifact)
                    counts["enrollments"] += 1
                    for order, component in enumerate(enrollment["components"]):
                        component_type_id = await conn.fetchval("""
                            SELECT id FROM grade_component_types WHERE section_id=$1 AND name=$2 LIMIT 1
                        """, section_id, component["name"])
                        if component_type_id is None:
                            component_type_id = await conn.fetchval("""
                                INSERT INTO grade_component_types (section_id,name,weight,max_score,is_required,sort_order)
                                VALUES ($1,$2,$3,10,true,$4) RETURNING id
                            """, section_id, component["name"], component["weight"], order)
                            await _lineage(conn, "grade_component_type", component_type_id, artifact)
                        grow = await conn.fetchrow("""
                            INSERT INTO grade_components (enrollment_id,component_type_id,score,max_score,is_absent,
                                                          assessed_at,recorded_at,created_at,updated_at)
                            VALUES ($1,$2,$3,10,false,now(),now(),now(),now())
                            ON CONFLICT (enrollment_id,component_type_id) DO UPDATE SET score=EXCLUDED.score, updated_at=now()
                            RETURNING id
                        """, erow["id"], component_type_id, component["score"])
                        await _lineage(conn, "grade_component", grow["id"], artifact)
                        counts["grade_components"] += 1
    return counts


async def rollback(conn: asyncpg.Connection) -> None:
    table_map = {"grade_component": "grade_components", "enrollment": "enrollments", "student": "students",
                 "grade_component_type": "grade_component_types", "section": "sections"}
    async with conn.transaction():
        for entity_type in ("grade_component", "enrollment", "student", "grade_component_type", "section"):
            await conn.execute(f"DELETE FROM {table_map[entity_type]} WHERE id IN "
                               "(SELECT entity_id FROM synthetic_data_lineage WHERE source=$1 AND entity_type=$2)",
                               SOURCE, entity_type)
        await conn.execute("DELETE FROM synthetic_data_lineage WHERE source=$1", SOURCE)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    require_safe_environment(os.getenv("APP_ENV", "development"))
    if not args.database_url:
        raise RuntimeError("DATABASE_URL is required")
    if not args.rollback and not args.source:
        raise RuntimeError("--source is required unless --rollback is used")
    conn = await asyncpg.connect(args.database_url.replace("postgresql+asyncpg://", "postgresql://", 1))
    try:
        if args.rollback:
            await rollback(conn)
            print("rolled_back=synthetic_analytics_v3")
        else:
            counts = await import_artifact(conn, json.loads(args.source.read_text(encoding="utf-8")))
            print(json.dumps(counts, sort_keys=True))
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

"""Import or roll back transcript-first synthetic demo coverage v5."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path

import asyncpg

SOURCE = "synthetic_transcript_coverage_v5"
ALLOWED_ENVS = {"development", "dev", "demo", "staging"}
CLO_CODES = ["CLO1", "CLO2", "CLO3"]


def _dsn(value: str) -> str:
    return value.replace("postgresql+asyncpg://", "postgresql://", 1)


def _require_safe_environment(app_env: str) -> None:
    if app_env.strip().lower() not in ALLOWED_ENVS:
        raise RuntimeError("Synthetic transcript import is blocked outside development/staging/demo")


def _grade_fields(value: float) -> tuple[str, float, bool]:
    if value >= 8.5:
        return "A", 4.0, True
    if value >= 7:
        return "B", 3.0, True
    if value >= 5.5:
        return "C", 2.0, True
    if value >= 4:
        return "D", 1.0, True
    return "F", 0.0, False


async def _lineage(conn: asyncpg.Connection, entity_type: str, entity_id: int, artifact: dict, extra: dict | None = None) -> None:
    derivation = {"derivation": artifact["derivation"]}
    if extra:
        derivation.update(extra)
    await conn.execute(
        """
        INSERT INTO synthetic_data_lineage (source, entity_type, entity_id, seed, official, derivation, created_at, updated_at)
        VALUES ($1,$2,$3,$4,false,$5::jsonb,now(),now())
        ON CONFLICT (source, entity_type, entity_id) DO UPDATE
        SET seed=EXCLUDED.seed, derivation=EXCLUDED.derivation, updated_at=now()
        """,
        SOURCE,
        entity_type,
        entity_id,
        artifact["seed"],
        json.dumps(derivation, ensure_ascii=False),
    )


async def _ensure_clos(conn: asyncpg.Connection, artifact: dict, course_id: int, course_name: str, program_id: int) -> dict[str, int]:
    existing = {
        row["code"]: row["id"]
        for row in await conn.fetch("SELECT id, code FROM clos WHERE course_id=$1 AND is_active IS TRUE", course_id)
    }
    created: list[tuple[int, str]] = []
    for index, code in enumerate(CLO_CODES, start=1):
        if code in existing:
            continue
        clo_id = await conn.fetchval(
            """
            INSERT INTO clos (course_id, code, name, description, bloom_level, weight, sort_order, is_active)
            VALUES ($1,$2,$3,$4,$5,1.0,$6,true)
            ON CONFLICT (course_id, code) DO UPDATE
            SET is_active=true, sort_order=EXCLUDED.sort_order
            RETURNING id
            """,
            course_id,
            code,
            f"{code} {course_name}",
            "Synthetic demo CLO generated for transcript coverage v5.",
            index + 1,
            index,
        )
        existing[code] = clo_id
        created.append((clo_id, code))
        await _lineage(conn, "clo", clo_id, artifact, {"course_id": course_id, "code": code})
    plos = await conn.fetch("SELECT id FROM plos WHERE program_id=$1 AND is_active IS TRUE ORDER BY sort_order, id LIMIT 5", program_id)
    for clo_id, code in created:
        if not plos:
            continue
        plo_id = plos[(int(code.replace("CLO", "")) - 1) % len(plos)]["id"]
        await conn.execute(
            """
            INSERT INTO clo_plo_mappings (clo_id, plo_id, contribution)
            VALUES ($1,$2,2)
            ON CONFLICT (clo_id, plo_id) DO UPDATE SET contribution=EXCLUDED.contribution
            """,
            clo_id,
            plo_id,
        )
    return {code: existing[code] for code in CLO_CODES if code in existing}


async def _ensure_component_type(conn: asyncpg.Connection, artifact: dict, section_id: int, component: dict, order: int) -> int:
    component_type_id = await conn.fetchval(
        "SELECT id FROM grade_component_types WHERE section_id=$1 AND name=$2 LIMIT 1",
        section_id,
        component["name"],
    )
    if component_type_id is None:
        component_type_id = await conn.fetchval(
            """
            INSERT INTO grade_component_types (section_id, name, weight, max_score, is_required, sort_order)
            VALUES ($1,$2,$3,10,true,$4)
            RETURNING id
            """,
            section_id,
            component["name"],
            component["weight"],
            order,
        )
    else:
        await conn.execute(
            "UPDATE grade_component_types SET weight=$1, max_score=10, is_required=true, sort_order=$2 WHERE id=$3",
            component["weight"],
            order,
            component_type_id,
        )
    await _lineage(conn, "grade_component_type", component_type_id, artifact, {"section_id": section_id, "component": component["name"]})
    return component_type_id


async def _map_component_to_clo(conn: asyncpg.Connection, component_type_id: int, clo_id: int) -> None:
    await conn.execute(
        """
        INSERT INTO grade_component_clo_mappings (component_type_id, clo_id, weight)
        VALUES ($1,$2,1.0)
        ON CONFLICT (component_type_id, clo_id) DO UPDATE SET weight=EXCLUDED.weight
        """,
        component_type_id,
        clo_id,
    )


async def import_artifact(conn: asyncpg.Connection, artifact: dict) -> dict[str, int]:
    if artifact.get("source") != SOURCE or artifact.get("official") is not False:
        raise ValueError("Invalid v5 transcript artifact")
    counts = {
        "homeroom_assignments": 0,
        "students": 0,
        "sections": 0,
        "enrollments": 0,
        "grade_component_types": 0,
        "grade_components": 0,
        "clos": 0,
    }
    async with conn.transaction():
        for program in artifact["programs"]:
            for class_item in program["classes"]:
                assignment_id = await conn.fetchval(
                    """
                    INSERT INTO homeroom_assignments (teacher_id, class_code, is_active, created_at, updated_at)
                    VALUES ($1,$2,true,now(),now())
                    ON CONFLICT (class_code) DO UPDATE
                    SET teacher_id=EXCLUDED.teacher_id, is_active=true, updated_at=now()
                    RETURNING id
                    """,
                    class_item["teacher_id"],
                    class_item["class_code"],
                )
                await _lineage(conn, "homeroom_assignment", assignment_id, artifact, {"class_code": class_item["class_code"]})
                counts["homeroom_assignments"] += 1

            section_ids: dict[str, int] = {}
            section_components: dict[str, dict[str, int]] = {}
            course_clos: dict[int, dict[str, int]] = {}
            for section in program["sections"]:
                if section["course_id"] not in course_clos:
                    before = await conn.fetchval("SELECT COUNT(*) FROM clos WHERE course_id=$1", section["course_id"])
                    course_clos[section["course_id"]] = await _ensure_clos(
                        conn,
                        artifact,
                        section["course_id"],
                        section["course_name"],
                        program["program_id"],
                    )
                    after = await conn.fetchval("SELECT COUNT(*) FROM clos WHERE course_id=$1", section["course_id"])
                    counts["clos"] += max(0, int(after) - int(before))
                section_id = await conn.fetchval(
                    """
                    INSERT INTO sections (course_id, teacher_id, semester_id, section_code, max_students, is_active, created_at, updated_at)
                    VALUES ($1,$2,$3,$4,$5,true,now(),now())
                    ON CONFLICT (course_id, semester_id, section_code) DO UPDATE
                    SET teacher_id=EXCLUDED.teacher_id, max_students=EXCLUDED.max_students, is_active=true, updated_at=now()
                    RETURNING id
                    """,
                    section["course_id"],
                    section["teacher_id"],
                    section["semester_id"],
                    section["section_code"],
                    section["max_students"],
                )
                section_ids[section["section_key"]] = section_id
                await _lineage(conn, "section", section_id, artifact, section)
                counts["sections"] += 1
                component_ids: dict[str, int] = {}
                for order, component in enumerate(artifact["components"]):
                    component_type_id = await _ensure_component_type(conn, artifact, section_id, component, order)
                    component_ids[component["name"]] = component_type_id
                    counts["grade_component_types"] += 1
                    clo_id = course_clos[section["course_id"]].get(component["clo_code"])
                    if clo_id is not None:
                        await _map_component_to_clo(conn, component_type_id, clo_id)
                section_components[section["section_key"]] = component_ids

            for student in program["students"]:
                student_id = await conn.fetchval(
                    """
                    INSERT INTO students (
                        program_id, specialization_id, cohort_id, student_code, full_name, class_code, status,
                        gpa_cumulative, is_active, created_at, updated_at
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,'active',$7,true,now(),now())
                    ON CONFLICT (student_code) DO UPDATE SET
                        program_id=EXCLUDED.program_id,
                        specialization_id=EXCLUDED.specialization_id,
                        cohort_id=EXCLUDED.cohort_id,
                        full_name=EXCLUDED.full_name,
                        class_code=EXCLUDED.class_code,
                        gpa_cumulative=EXCLUDED.gpa_cumulative,
                        status='active',
                        is_active=true,
                        updated_at=now()
                    RETURNING id
                    """,
                    student["program_id"],
                    student.get("specialization_id"),
                    student["cohort_id"],
                    student["student_code"],
                    student["full_name"],
                    student["class_code"],
                    student["gpa_cumulative"],
                )
                await _lineage(conn, "student", student_id, artifact, {"class_code": student["class_code"], "profile": student["profile"]})
                counts["students"] += 1
                for enrollment in student["enrollments"]:
                    section_id = section_ids[enrollment["section_key"]]
                    letter, grade4, passed = _grade_fields(enrollment["final_grade"])
                    credits = await conn.fetchval("SELECT credits FROM courses WHERE id=$1", enrollment["course_id"])
                    enrollment_id = await conn.fetchval(
                        """
                        INSERT INTO enrollments (
                            student_id, section_id, final_grade, grade_letter, grade_4, is_passed,
                            registered_credits, completed_at, attempt_number, status, created_at, updated_at
                        )
                        VALUES ($1,$2,$3,$4,$5,$6,$7,now(),1,'completed',now(),now())
                        ON CONFLICT (student_id, section_id, attempt_number) DO UPDATE SET
                            final_grade=EXCLUDED.final_grade,
                            grade_letter=EXCLUDED.grade_letter,
                            grade_4=EXCLUDED.grade_4,
                            is_passed=EXCLUDED.is_passed,
                            registered_credits=EXCLUDED.registered_credits,
                            completed_at=EXCLUDED.completed_at,
                            status='completed',
                            updated_at=now()
                        RETURNING id
                        """,
                        student_id,
                        section_id,
                        enrollment["final_grade"],
                        letter,
                        grade4,
                        passed,
                        credits,
                    )
                    await _lineage(conn, "enrollment", enrollment_id, artifact, {"course_id": enrollment["course_id"]})
                    counts["enrollments"] += 1
                    component_ids = section_components[enrollment["section_key"]]
                    for component in enrollment["components"]:
                        grade_component_id = await conn.fetchval(
                            """
                            INSERT INTO grade_components (
                                enrollment_id, component_type_id, score, max_score, is_absent,
                                assessed_at, recorded_at, created_at, updated_at
                            )
                            VALUES ($1,$2,$3,10,false,now(),now(),now(),now())
                            ON CONFLICT (enrollment_id, component_type_id) DO UPDATE
                            SET score=EXCLUDED.score, updated_at=now()
                            RETURNING id
                            """,
                            enrollment_id,
                            component_ids[component["name"]],
                            component["score"],
                        )
                        await _lineage(conn, "grade_component", grade_component_id, artifact, {"enrollment_id": enrollment_id})
                        counts["grade_components"] += 1
    return counts


async def rollback(conn: asyncpg.Connection) -> None:
    table_map = {
        "grade_component": "grade_components",
        "enrollment": "enrollments",
        "student": "students",
        "grade_component_type": "grade_component_types",
        "section": "sections",
        "homeroom_assignment": "homeroom_assignments",
        "clo": "clos",
    }
    async with conn.transaction():
        await conn.execute(
            """
            DELETE FROM grade_component_clo_mappings
            WHERE component_type_id IN (
                SELECT entity_id FROM synthetic_data_lineage
                WHERE source=$1 AND entity_type='grade_component_type'
            )
            """,
            SOURCE,
        )
        for entity_type in ("grade_component", "enrollment", "student", "grade_component_type", "section", "homeroom_assignment", "clo"):
            await conn.execute(
                f"""
                DELETE FROM {table_map[entity_type]}
                WHERE id IN (
                    SELECT entity_id FROM synthetic_data_lineage
                    WHERE source=$1 AND entity_type=$2
                )
                """,
                SOURCE,
                entity_type,
            )
        await conn.execute("DELETE FROM synthetic_data_lineage WHERE source=$1", SOURCE)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    _require_safe_environment(os.getenv("APP_ENV", "development"))
    if not args.database_url:
        raise RuntimeError("DATABASE_URL is required")
    if not args.rollback and not args.source:
        raise RuntimeError("--source is required unless --rollback is used")
    conn = await asyncpg.connect(_dsn(args.database_url))
    try:
        if args.rollback:
            await rollback(conn)
            print(f"rolled_back={SOURCE}")
        else:
            counts = await import_artifact(conn, json.loads(args.source.read_text(encoding="utf-8")))
            print(json.dumps(counts, ensure_ascii=False, sort_keys=True))
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

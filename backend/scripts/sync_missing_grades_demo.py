"""Backfill missing demo enrollment grades and refresh DWH readiness.

The script is intentionally idempotent: it only updates enrollments whose
final grade or pass flag is missing.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import asyncpg

ALLOWED_ENVS = {"development", "dev", "demo", "staging"}
SOURCE = "demo_missing_grade_sync_v1"
DEFAULT_DATABASE_URL = "postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight"
PASS_THRESHOLD = Decimal("5.00")


@dataclass(frozen=True)
class GradeFields:
    final_grade: Decimal
    grade_letter: str
    grade_4: Decimal
    is_passed: bool


def _dsn(value: str) -> str:
    return value.replace("postgresql+asyncpg://", "postgresql://", 1)


def _require_safe_environment(app_env: str) -> None:
    if app_env.strip().lower() not in ALLOWED_ENVS:
        raise RuntimeError("Demo grade sync is blocked outside development/staging/demo")


def _q(value: Decimal | float | str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _clamp(value: Decimal, low: str = "0.00", high: str = "10.00") -> Decimal:
    return min(max(value, Decimal(low)), Decimal(high))


def _grade_letter_and_4(final_grade: Decimal) -> tuple[str, Decimal]:
    if final_grade >= Decimal("8.50"):
        return "A", Decimal("4.00")
    if final_grade >= Decimal("8.00"):
        return "B+", Decimal("3.50")
    if final_grade >= Decimal("7.00"):
        return "B", Decimal("3.00")
    if final_grade >= Decimal("6.50"):
        return "C+", Decimal("2.50")
    if final_grade >= Decimal("5.50"):
        return "C", Decimal("2.00")
    if final_grade >= Decimal("5.00"):
        return "D+", Decimal("1.50")
    if final_grade >= Decimal("4.00"):
        return "D", Decimal("1.00")
    return "F", Decimal("0.00")


def _grade_fields(final_grade: Decimal) -> GradeFields:
    rounded = _q(_clamp(final_grade))
    grade_letter, grade_4 = _grade_letter_and_4(rounded)
    return GradeFields(
        final_grade=rounded,
        grade_letter=grade_letter,
        grade_4=grade_4,
        is_passed=rounded >= PASS_THRESHOLD,
    )


def _hash_fraction(*parts: object) -> Decimal:
    payload = ":".join(str(part) for part in parts).encode("utf-8")
    digest = hashlib.sha256(payload).hexdigest()
    return Decimal(int(digest[:12], 16)) / Decimal(16**12 - 1)


def _fallback_grade(row: asyncpg.Record, seed: int) -> Decimal:
    base = row["section_avg"] or row["course_semester_avg"] or row["course_avg"] or row["global_avg"] or Decimal("6.80")
    spread = Decimal("2.20") if row["section_avg"] is None else Decimal("1.20")
    noise = (_hash_fraction(seed, row["enrollment_id"], row["student_id"], row["section_id"]) - Decimal("0.50")) * spread

    difficulty = Decimal("0.00")
    credits = row["credits"]
    if credits and credits >= 4:
        difficulty -= Decimal("0.15")
    if row["enrollment_count"] and row["enrollment_count"] < 5:
        difficulty += Decimal("0.10")

    value = Decimal(str(base)) + noise + difficulty
    return _q(_clamp(value, "2.00", "9.60"))


async def _component_grade(conn: asyncpg.Connection, enrollment_id: int) -> Decimal | None:
    row = await conn.fetchrow(
        """
        SELECT
            SUM((gc.score / NULLIF(gc.max_score, 0)) * 10 * COALESCE(gct.weight, 1)) AS weighted_score,
            SUM(COALESCE(gct.weight, 1)) AS total_weight
        FROM grade_components gc
        JOIN grade_component_types gct ON gct.id = gc.component_type_id
        WHERE gc.enrollment_id = $1
          AND gc.score IS NOT NULL
          AND COALESCE(gc.max_score, 0) > 0
        """,
        enrollment_id,
    )
    if row is None or row["weighted_score"] is None or row["total_weight"] in (None, 0):
        return None
    return _q(_clamp(Decimal(str(row["weighted_score"])) / Decimal(str(row["total_weight"]))))


async def _upsert_lineage(
    conn: asyncpg.Connection,
    enrollment_id: int,
    seed: int,
    derivation: dict[str, Any],
) -> None:
    await conn.execute(
        """
        INSERT INTO synthetic_data_lineage (source, entity_type, entity_id, seed, official, derivation, created_at, updated_at)
        VALUES ($1, 'enrollment', $2, $3, false, $4::jsonb, now(), now())
        ON CONFLICT (source, entity_type, entity_id) DO UPDATE
        SET seed=EXCLUDED.seed, derivation=EXCLUDED.derivation, updated_at=now()
        """,
        SOURCE,
        enrollment_id,
        seed,
        json.dumps(derivation, ensure_ascii=False, sort_keys=True),
    )


async def _missing_rows(conn: asyncpg.Connection) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        WITH section_stats AS (
            SELECT
                e.section_id,
                AVG(e.final_grade) FILTER (WHERE e.final_grade IS NOT NULL) AS section_avg,
                COUNT(*) AS enrollment_count
            FROM enrollments e
            GROUP BY e.section_id
        ),
        course_semester_stats AS (
            SELECT
                sec.course_id,
                sec.semester_id,
                AVG(e.final_grade) FILTER (WHERE e.final_grade IS NOT NULL) AS course_semester_avg
            FROM enrollments e
            JOIN sections sec ON sec.id = e.section_id
            GROUP BY sec.course_id, sec.semester_id
        ),
        course_stats AS (
            SELECT
                sec.course_id,
                AVG(e.final_grade) FILTER (WHERE e.final_grade IS NOT NULL) AS course_avg
            FROM enrollments e
            JOIN sections sec ON sec.id = e.section_id
            GROUP BY sec.course_id
        ),
        global_stats AS (
            SELECT AVG(final_grade) FILTER (WHERE final_grade IS NOT NULL) AS global_avg
            FROM enrollments
        )
        SELECT
            e.id AS enrollment_id,
            e.student_id,
            e.section_id,
            sec.course_id,
            sec.semester_id,
            sem.code AS semester_code,
            c.credits,
            ss.section_avg,
            ss.enrollment_count,
            css.course_semester_avg,
            cs.course_avg,
            gs.global_avg
        FROM enrollments e
        JOIN sections sec ON sec.id = e.section_id
        JOIN semesters sem ON sem.id = sec.semester_id
        JOIN courses c ON c.id = sec.course_id
        JOIN section_stats ss ON ss.section_id = e.section_id
        LEFT JOIN course_semester_stats css ON css.course_id = sec.course_id AND css.semester_id = sec.semester_id
        LEFT JOIN course_stats cs ON cs.course_id = sec.course_id
        CROSS JOIN global_stats gs
        WHERE sec.is_active IS TRUE
          AND (e.final_grade IS NULL OR e.is_passed IS NULL)
        ORDER BY sem.code, e.id
        """
    )


async def sync_missing_grades(conn: asyncpg.Connection, *, dry_run: bool, seed: int) -> dict[str, int]:
    rows = await _missing_rows(conn)
    summary = {
        "missing_found": len(rows),
        "component_derived": 0,
        "deterministic_backfill": 0,
        "updated": 0,
    }
    if dry_run or not rows:
        for row in rows:
            if await _component_grade(conn, row["enrollment_id"]) is None:
                summary["deterministic_backfill"] += 1
            else:
                summary["component_derived"] += 1
        return summary

    async with conn.transaction():
        for row in rows:
            component_grade = await _component_grade(conn, row["enrollment_id"])
            derivation_source = "grade_components_weighted_average"
            if component_grade is None:
                component_grade = _fallback_grade(row, seed)
                derivation_source = "deterministic_contextual_backfill"
                summary["deterministic_backfill"] += 1
            else:
                summary["component_derived"] += 1

            fields = _grade_fields(component_grade)
            await conn.execute(
                """
                UPDATE enrollments
                SET final_grade = $2,
                    grade_letter = $3,
                    grade_4 = $4,
                    is_passed = $5,
                    completed_at = COALESCE(completed_at, $6),
                    status = 'completed',
                    updated_at = now()
                WHERE id = $1
                  AND (final_grade IS NULL OR is_passed IS NULL)
                """,
                row["enrollment_id"],
                fields.final_grade,
                fields.grade_letter,
                fields.grade_4,
                fields.is_passed,
                datetime.now(UTC),
            )
            await _upsert_lineage(
                conn,
                row["enrollment_id"],
                seed,
                {
                    "source": derivation_source,
                    "semester_code": row["semester_code"],
                    "course_id": row["course_id"],
                    "section_id": row["section_id"],
                    "pass_threshold": float(PASS_THRESHOLD),
                    "final_grade": float(fields.final_grade),
                },
            )
            summary["updated"] += 1
    return summary


async def _amain() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    parser.add_argument("--seed", type=int, default=5602026)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    _require_safe_environment(os.getenv("APP_ENV", "development"))
    conn = await asyncpg.connect(_dsn(args.database_url))
    try:
        summary = await sync_missing_grades(conn, dry_run=not args.apply, seed=args.seed)
        print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(_amain())

"""Import V59 synthetic crawled students into the OLTP students table.

The script is intentionally limited to student/profile rows. It resolves
department, program, cohort, and specialization by natural labels from the
crawl file and upserts by student_code.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

import asyncpg

INFO_NAME = "Họ và tên"
INFO_CODE = "MSSV"
INFO_STATUS = "Trạng thái"
INFO_GENDER = "Giới tính"
INFO_COHORT = "Khóa"
INFO_PROGRAM = "Ngành"
INFO_SPECIALIZATION = "Chuyên ngành"
INFO_CLASS = "Lớp"
GRADE_CREDITS = "TC"
GRADE_FINAL = "Điểm tổng kết"
GRADE_LETTER = "Xếp loại"

GRADE_4_MAP = {
    "A+": 4.0,
    "A": 4.0,
    "B+": 3.5,
    "B": 3.0,
    "C+": 2.5,
    "C": 2.0,
    "D+": 1.5,
    "D": 1.0,
    "F": 0.0,
}
STATUS_MAP = {
    "dang hoc": "active",
    "bao luu": "active",
    "buoc thoi hoc": "expelled",
    "thoi hoc": "withdrawn",
    "rut hoc phi": "withdrawn",
}
GENDER_MAP = {
    "nam": "male",
    "nu": "female",
}


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    return " ".join(unicodedata.normalize("NFC", str(value)).split())


def canonical_key(value: object) -> str:
    text = normalize_text(value).casefold().replace("đ", "d")
    text = "".join(char for char in unicodedata.normalize("NFD", text) if unicodedata.category(char) != "Mn")
    return " ".join(re.findall(r"[a-z0-9]+", text))


def stable_code(prefix: str, *parts: str, length: int = 20) -> str:
    payload = "|".join(normalize_text(part).casefold() for part in parts).encode("utf-8")
    return f"{prefix}{hashlib.sha256(payload).hexdigest()[:length - len(prefix)].upper()}"


def parse_float(value: object) -> float | None:
    text = normalize_text(value).replace(",", ".")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def clean_grade_letter(value: object) -> str | None:
    text = normalize_text(value).replace("[", "").replace("]", "")
    if not text:
        return None
    return text.split("-", 1)[0].strip().upper() or None


def compute_gpa(grades: list[dict[str, Any]]) -> float | None:
    points = 0.0
    credits_total = 0
    for grade in grades:
        letter = clean_grade_letter(grade.get(GRADE_LETTER))
        grade_4 = GRADE_4_MAP.get(letter or "")
        credits = int(parse_float(grade.get(GRADE_CREDITS)) or 0)
        final_grade = parse_float(grade.get(GRADE_FINAL))
        if grade_4 is None or not credits or final_grade is None:
            continue
        points += grade_4 * credits
        credits_total += credits
    return round(points / credits_total, 2) if credits_total else None


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    args = parser.parse_args()

    if not args.database_url:
        raise RuntimeError("DATABASE_URL is required")
    rows = json.loads(args.source.read_text(encoding="utf-8"))
    database_url = args.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = await asyncpg.connect(database_url)
    try:
        departments = await conn.fetch("SELECT id, name FROM departments WHERE is_active = true")
        programs = await conn.fetch("SELECT id, department_id, name FROM programs WHERE is_active = true")
        specializations = await conn.fetch(
            "SELECT id, program_id, name FROM specializations WHERE is_active = true"
        )
        cohorts = await conn.fetch("SELECT id, code, year_start FROM cohorts")

        department_by_key = {canonical_key(row["name"]): row for row in departments}
        program_by_key = {
            (row["department_id"], canonical_key(row["name"])): row
            for row in programs
        }
        specialization_by_key = {
            (row["program_id"], canonical_key(row["name"])): row
            for row in specializations
        }
        cohort_by_year = {str(row["year_start"]): row for row in cohorts}
        existing_codes = {
            row["student_code"]
            for row in await conn.fetch("SELECT student_code FROM students")
        }

        missing_programs: list[str] = []
        created_programs = 0
        created_specializations = 0
        inserted = 0
        updated = 0
        skipped_existing = 0

        async with conn.transaction():
            for raw in rows:
                info = raw.get("student_info") or {}
                student_code = normalize_text(info.get(INFO_CODE))
                if not student_code:
                    continue
                department = department_by_key.get(canonical_key(info.get("Khoa")))
                if department is None:
                    missing_programs.append(f"{info.get('Khoa')} / {info.get(INFO_PROGRAM)}")
                    continue
                program = program_by_key.get((department["id"], canonical_key(info.get(INFO_PROGRAM))))
                if program is None:
                    program_name = normalize_text(info.get(INFO_PROGRAM)) or "Chưa phân ngành"
                    code = stable_code("PG", str(department["id"]), program_name, length=20)
                    program = await conn.fetchrow(
                        """
                        INSERT INTO programs (
                            department_id, code, name, duration_years,
                            total_credits, version, is_active
                        )
                        VALUES ($1, $2, $3, 4, 120, 'V59', true)
                        ON CONFLICT (department_id, code) DO UPDATE
                        SET name = EXCLUDED.name, is_active = true, updated_at = now()
                        RETURNING id, department_id, name
                        """,
                        department["id"],
                        code,
                        program_name,
                    )
                    program_by_key[(department["id"], canonical_key(program_name))] = program
                    created_programs += 1
                cohort = cohort_by_year.get(normalize_text(info.get(INFO_COHORT)))
                if cohort is None:
                    missing_programs.append(f"Khóa {info.get(INFO_COHORT)}")
                    continue

                specialization_name = normalize_text(info.get(INFO_SPECIALIZATION)) or "Chưa phân loại"
                specialization = specialization_by_key.get((program["id"], canonical_key(specialization_name)))
                if specialization is None:
                    code = stable_code("SP", str(program["id"]), specialization_name, length=20)
                    specialization = await conn.fetchrow(
                        """
                        INSERT INTO specializations (program_id, code, name, is_placeholder, is_active)
                        VALUES ($1, $2, $3, false, true)
                        ON CONFLICT (program_id, code) DO UPDATE
                        SET name = EXCLUDED.name, is_active = true, updated_at = now()
                        RETURNING id, program_id, name
                        """,
                        program["id"],
                        code,
                        specialization_name,
                    )
                    specialization_by_key[(program["id"], canonical_key(specialization_name))] = specialization
                    created_specializations += 1

                status = STATUS_MAP.get(canonical_key(info.get(INFO_STATUS)), "active")
                gender = GENDER_MAP.get(canonical_key(info.get(INFO_GENDER)))
                gpa = compute_gpa(raw.get("grades") or [])
                is_new = student_code not in existing_codes
                await conn.execute(
                    """
                    INSERT INTO students (
                        program_id, specialization_id, cohort_id, student_code, full_name,
                        gender, phone, class_code, status, gpa_cumulative, is_active
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    ON CONFLICT (student_code) DO UPDATE SET
                        program_id = EXCLUDED.program_id,
                        specialization_id = EXCLUDED.specialization_id,
                        cohort_id = EXCLUDED.cohort_id,
                        full_name = EXCLUDED.full_name,
                        gender = EXCLUDED.gender,
                        phone = EXCLUDED.phone,
                        class_code = EXCLUDED.class_code,
                        status = EXCLUDED.status,
                        gpa_cumulative = EXCLUDED.gpa_cumulative,
                        is_active = EXCLUDED.is_active,
                        updated_at = now()
                    """,
                    program["id"],
                    specialization["id"],
                    cohort["id"],
                    student_code,
                    normalize_text(info.get(INFO_NAME)),
                    gender,
                    normalize_text(info.get("Số ĐT")) or None,
                    normalize_text(info.get(INFO_CLASS)) or None,
                    status,
                    gpa,
                    status == "active",
                )
                if is_new:
                    existing_codes.add(student_code)
                    inserted += 1
                else:
                    skipped_existing += 1
                    updated += 1

        if missing_programs:
            print("missing_mappings:")
            for item in sorted(set(missing_programs)):
                print(f"- {item}")
        print(f"source_rows={len(rows)}")
        print(f"inserted={inserted}")
        print(f"updated_existing={updated}")
        print(f"created_programs={created_programs}")
        print(f"created_specializations={created_specializations}")
        print(f"skipped_existing={skipped_existing}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

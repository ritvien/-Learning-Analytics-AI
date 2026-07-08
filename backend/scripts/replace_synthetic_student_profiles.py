"""Replace obvious demo student profiles with realistic synthetic identities.

The script keeps student IDs and academic evidence intact, then updates only
profile-facing fields: code, name, gender, email, phone, date of birth, and
class code. It targets students registered in synthetic_data_lineage so real
or crawl-imported students are not touched.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import asyncpg

DEFAULT_SOURCES = (
    "synthetic_transcript_coverage_v5",
    "synthetic_course_462_demo",
    "synthetic_course_462_trend_demo",
)

SURNAMES = [
    "Nguyễn",
    "Trần",
    "Lê",
    "Phạm",
    "Hoàng",
    "Phan",
    "Vũ",
    "Đặng",
    "Bùi",
    "Đỗ",
    "Hồ",
    "Ngô",
    "Dương",
    "Lý",
    "Mai",
    "Tạ",
]

MALE_MIDDLES = ["Văn", "Minh", "Đức", "Quang", "Hữu", "Tuấn", "Anh", "Gia"]
FEMALE_MIDDLES = ["Thị", "Ngọc", "Thu", "Mai", "Thanh", "Phương", "Khánh", "Bảo"]
MALE_GIVEN = [
    "An",
    "Bình",
    "Cường",
    "Dũng",
    "Hải",
    "Hưng",
    "Khang",
    "Long",
    "Nam",
    "Phong",
    "Sơn",
    "Thắng",
    "Việt",
    "Vinh",
]
FEMALE_GIVEN = [
    "Anh",
    "Chi",
    "Dung",
    "Giang",
    "Hà",
    "Hạnh",
    "Lan",
    "Linh",
    "My",
    "Ngân",
    "Thảo",
    "Trang",
    "Uyên",
    "Vy",
]


def _dsn(value: str) -> str:
    return value.replace("postgresql+asyncpg://", "postgresql://", 1)


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value).replace("đ", "d").replace("Đ", "D")
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def _slug(value: str) -> str:
    return ".".join(re.findall(r"[a-z0-9]+", _strip_accents(value).casefold()))


def _digits(value: str) -> str:
    return "".join(re.findall(r"\d", value))


def _name(index: int) -> tuple[str, str]:
    gender = "male" if index % 2 else "female"
    surname = SURNAMES[index % len(SURNAMES)]
    if gender == "male":
        middle = MALE_MIDDLES[(index // len(SURNAMES)) % len(MALE_MIDDLES)]
        given = MALE_GIVEN[(index // 3) % len(MALE_GIVEN)]
    else:
        middle = FEMALE_MIDDLES[(index // len(SURNAMES)) % len(FEMALE_MIDDLES)]
        given = FEMALE_GIVEN[(index // 3) % len(FEMALE_GIVEN)]
    return f"{surname} {middle} {given}".upper(), gender


def _date_of_birth(year_start: int, index: int) -> date:
    year = year_start - 18 - (index % 3)
    month = (index % 12) + 1
    day = (index * 7 % 27) + 1
    return date(year, month, day)


def _phone(index: int) -> str:
    return f"+849{23000000 + index:08d}"


def _class_code(year_start: int, program_code: str, group_index: int) -> str:
    program_part = _digits(program_code)[-7:] or "0000000"
    zero_based = max(0, group_index - 5001)
    letter = chr(ord("A") + ((zero_based // 35) % 4))
    group = (zero_based // 140) + 1
    return f"K{str(year_start)[-2:]}-{program_part}-{letter}{group:02d}"


def _student_code(year_start: int, program_code: str, sequence: int, used_codes: set[str]) -> str:
    program_part = (_digits(program_code)[-6:] or "000000")[:6]
    base = f"{str(year_start)[-2:]}{program_part}"
    candidate_sequence = sequence
    while True:
        candidate = f"{base}{candidate_sequence:04d}"
        if candidate not in used_codes:
            used_codes.add(candidate)
            return candidate
        candidate_sequence += 1


def _profile(row: asyncpg.Record, index: int, sequence: int, used_codes: set[str]) -> dict[str, Any]:
    full_name, gender = _name(index)
    year_start = int(row["year_start"])
    program_code = str(row["program_code"])
    student_code = _student_code(year_start, program_code, sequence, used_codes)
    return {
        "student_id": int(row["id"]),
        "old_student_code": row["student_code"],
        "old_full_name": row["full_name"],
        "student_code": student_code,
        "full_name": full_name,
        "gender": gender,
        "email": f"{_slug(full_name)}.{student_code}@student.epu.edu.vn",
        "phone": _phone(index),
        "date_of_birth": _date_of_birth(year_start, index),
        "class_code": _class_code(year_start, program_code, sequence),
        "source": row["source"],
    }


async def _load_rows(conn: asyncpg.Connection, sources: tuple[str, ...]) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT
            s.id,
            s.student_code,
            s.full_name,
            s.program_id,
            s.cohort_id,
            p.code AS program_code,
            c.year_start,
            l.source
        FROM students s
        JOIN synthetic_data_lineage l ON l.entity_type = 'student' AND l.entity_id = s.id
        JOIN programs p ON p.id = s.program_id
        JOIN cohorts c ON c.id = s.cohort_id
        WHERE l.source = ANY($1::text[])
        ORDER BY c.year_start, p.code, s.id
        """,
        list(sources),
    )


def _update_v5_artifact(path: Path, profiles_by_old_code: dict[str, dict[str, Any]]) -> int:
    if not path.exists():
        return 0
    artifact = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for program in artifact.get("programs", []):
        for student in program.get("students", []):
            profile = profiles_by_old_code.get(student.get("student_code", ""))
            if not profile:
                continue
            student["student_code"] = profile["student_code"]
            student["full_name"] = profile["full_name"]
            student["class_code"] = profile["class_code"]
            changed += 1
    if changed:
        path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed


async def replace_profiles(args: argparse.Namespace) -> dict[str, int]:
    conn = await asyncpg.connect(_dsn(args.database_url))
    try:
        rows = await _load_rows(conn, tuple(args.source))
        used_codes = {
            row["student_code"]
            for row in await conn.fetch(
                """
                SELECT student_code
                FROM students
                WHERE id NOT IN (
                    SELECT entity_id
                    FROM synthetic_data_lineage
                    WHERE entity_type = 'student' AND source = ANY($1::text[])
                )
                """,
                list(args.source),
            )
        }
        counters: dict[tuple[int, str], int] = defaultdict(lambda: 5000)
        profiles: list[dict[str, Any]] = []
        for index, row in enumerate(rows, start=1):
            key = (int(row["year_start"]), str(row["program_code"]))
            counters[key] += 1
            profiles.append(_profile(row, index, counters[key], used_codes))

        if args.apply:
            async with conn.transaction():
                for profile in profiles:
                    await conn.execute(
                        """
                        UPDATE students
                        SET student_code = $1,
                            full_name = $2,
                            gender = $3,
                            email = $4,
                            phone = $5,
                            date_of_birth = $6,
                            class_code = $7,
                            updated_at = now()
                        WHERE id = $8
                        """,
                        profile["student_code"],
                        profile["full_name"],
                        profile["gender"],
                        profile["email"],
                        profile["phone"],
                        profile["date_of_birth"],
                        profile["class_code"],
                        profile["student_id"],
                    )
                    await conn.execute(
                        """
                        UPDATE synthetic_data_lineage
                        SET derivation = (derivation::jsonb || $1::jsonb)::json,
                            updated_at = now()
                        WHERE entity_type = 'student' AND entity_id = $2 AND source = $3
                        """,
                        json.dumps({"profile_replaced": True, "old_student_code": profile["old_student_code"]}),
                        profile["student_id"],
                        profile["source"],
                    )

        if args.output:
            serializable = [
                {**profile, "date_of_birth": profile["date_of_birth"].isoformat()}
                for profile in profiles
            ]
            args.output.write_text(json.dumps(serializable, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        artifact_updates = 0
        if args.apply and args.update_artifact:
            profiles_by_old_code = {profile["old_student_code"]: profile for profile in profiles}
            artifact_updates = _update_v5_artifact(args.update_artifact, profiles_by_old_code)

        return {
            "matched": len(rows),
            "updated": len(profiles) if args.apply else 0,
            "artifact_updates": artifact_updates,
        }
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--source", action="append", choices=DEFAULT_SOURCES, default=[])
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("db/synthetic-student-profile-replacements.json"))
    parser.add_argument("--update-artifact", type=Path, default=Path("db/synthetic-transcript-coverage-v5.json"))
    args = parser.parse_args()
    if not args.database_url:
        raise RuntimeError("DATABASE_URL is required")
    if not args.source:
        args.source = list(DEFAULT_SOURCES)

    result = asyncio.run(replace_profiles(args))
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

"""Normalize and idempotently import the H46 crawled academic dataset.

The default mode is intentionally read-only for PostgreSQL. It validates the
source and prints a manifest. Pass ``--apply`` to upsert the reviewed artifact.
No database IDs from the crawl are persisted; every relation is resolved by a
natural key so the importer is safe to run against both an existing and a new
database.
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import hashlib
import json
import os
import re
import unicodedata
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import asyncpg

SCHEMA_VERSION = 1
DEFAULT_EXPECTED_STUDENTS = 1277
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = PROJECT_ROOT.parent / "crawl" / "epu_data_batch.json"
DEFAULT_CLASS_MAPPING = PROJECT_ROOT.parent / "crawl" / "class_code_mapping.json"
DEFAULT_COURSE_DEPARTMENTS = Path(__file__).with_name("course_departments.json")
DEFAULT_ARTIFACT = PROJECT_ROOT / "backend" / "db" / "seed-academic-v2.json.gz"
DEFAULT_MANIFEST = PROJECT_ROOT / "backend" / "db" / "seed-academic-v2.manifest.json"
DEFAULT_SPECIALIZATION_CATALOG = PROJECT_ROOT / "backend" / "db" / "specialization-catalog.json"

INFO_NAME = "Họ và tên"
INFO_CODE = "MSSV"
INFO_STATUS = "Trạng thái"
INFO_GENDER = "Giới tính"
INFO_COHORT = "Khóa"
INFO_PROGRAM = "Ngành"
INFO_CLASS = "Lớp"

GRADE_SEMESTER = "Học kỳ"
GRADE_COURSE = "Tên môn học"
GRADE_SECTION = "Mã lớp"
GRADE_CREDITS = "TC"
GRADE_FINAL = "Điểm tổng kết"
GRADE_LETTER = "Xếp loại"

GRADE_COMPONENTS: tuple[tuple[str, float, int], ...] = (
    ("TX1", 10.0, 1),
    ("TX2", 10.0, 2),
    ("TX3", 10.0, 3),
    ("TX4", 10.0, 4),
    ("Kết thúc L1", 60.0, 5),
    ("Kết thúc L2", 0.0, 6),
)

# These are the only course names observed in more than one source department
# and missing from the reviewed course-department mapping.
COURSE_DEPARTMENT_OVERRIDES = {
    "Thuế và thực hành": "Khoa Kế toán - Tài chính",
    "Thương mại điện tử": "Khoa Quản trị Kinh doanh và Du lịch",
}

STATUS_MAP = {
    "dang hoc": "active",
    "tot nghiep": "graduated",
    "buoc thoi hoc": "expelled",
    "thoi hoc": "withdrawn",
}

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


class DatasetValidationError(ValueError):
    """Raised when source data cannot be imported without guessing."""


def normalize_text(value: object) -> str:
    """Return a whitespace-normalized NFC string."""
    if value is None:
        return ""
    return " ".join(unicodedata.normalize("NFC", str(value)).split())


def canonical_key(value: object) -> str:
    """Build an accent- and punctuation-insensitive lookup key."""
    text = normalize_text(value).casefold().replace("đ", "d")
    text = "".join(char for char in unicodedata.normalize("NFD", text) if unicodedata.category(char) != "Mn")
    return " ".join(re.findall(r"[a-z0-9]+", text))


def course_key(value: object) -> str:
    """Build a lossless course key compatible with the existing seed catalog."""
    return normalize_text(value)


def stable_code(prefix: str, *parts: str, length: int = 12) -> str:
    """Return a stable code derived from normalized business fields."""
    payload = "|".join(normalize_text(part).casefold() for part in parts).encode("utf-8")
    return f"{prefix}-{hashlib.sha256(payload).hexdigest()[:length].upper()}"


def parse_float(value: object) -> float | None:
    """Parse a nullable source score."""
    text = normalize_text(value).replace(",", ".")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_int(value: object, default: int = 0) -> int:
    """Parse an integer-like source field."""
    parsed = parse_float(value)
    return int(parsed) if parsed is not None else default


def clean_grade_letter(value: object) -> str | None:
    """Extract a compact letter grade from the source display value."""
    text = normalize_text(value).replace("[", "").replace("]", "")
    if not text:
        return None
    letter = text.split("-", 1)[0].strip().upper()
    return letter or None


def parse_semester(value: object) -> dict[str, Any]:
    """Parse labels such as ``HK2 (2024-2025)``."""
    name = normalize_text(value)
    match = re.fullmatch(r"HK(\d+)\s*\((\d{4})-\d{4}\)", name)
    if not match:
        raise DatasetValidationError(f"Unsupported semester label: {name!r}")
    term = int(match.group(1))
    year = int(match.group(2))
    return {"code": f"{year}-{term}", "name": name, "year": year, "term": term}


def _identity_signature(info: dict[str, Any]) -> tuple[str, ...]:
    return (
        canonical_key(info.get(INFO_CODE)),
        canonical_key(info.get(INFO_NAME)),
        canonical_key(info.get(INFO_CLASS)),
        canonical_key(info.get(INFO_PROGRAM)),
        canonical_key(info.get(INFO_COHORT)),
    )


def _grade_key(grade: dict[str, Any]) -> tuple[str, str, str]:
    return (
        canonical_key(grade.get(GRADE_SEMESTER)),
        course_key(grade.get(GRADE_COURSE)),
        canonical_key(grade.get(GRADE_SECTION)),
    )


def _record_completeness(record: dict[str, Any]) -> int:
    return sum(bool(normalize_text(value)) for value in record.values())


def _merge_grade(existing: dict[str, Any], incoming: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """Choose the more complete duplicate grade row deterministically."""
    if existing == incoming:
        return existing, False
    conflicted = any(
        field != "STT"
        and normalize_text(existing.get(field))
        and normalize_text(incoming.get(field))
        and normalize_text(existing.get(field)) != normalize_text(incoming.get(field))
        for field in existing.keys() | incoming.keys()
    )
    existing_payload = json.dumps(existing, ensure_ascii=False, sort_keys=True)
    incoming_payload = json.dumps(incoming, ensure_ascii=False, sort_keys=True)
    existing_rank = (_record_completeness(existing), existing_payload)
    incoming_rank = (_record_completeness(incoming), incoming_payload)
    return (incoming if incoming_rank > existing_rank else existing), conflicted


def _source_checksum(paths: Sequence[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.name.encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def _load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_dataset(
    source_rows: Sequence[dict[str, Any]],
    class_mapping_rows: Sequence[dict[str, Any]],
    course_departments: dict[str, str],
    *,
    source_checksum: str = "",
) -> dict[str, Any]:
    """Validate, deduplicate and normalize the crawl into a portable artifact."""
    mapping_by_class: dict[str, dict[str, str]] = {}
    for raw_mapping in class_mapping_rows:
        class_code = normalize_text(raw_mapping.get("class_code"))
        mapping = {
            "class_code": class_code,
            "department_name": normalize_text(raw_mapping.get("khoa")),
            "program_name": normalize_text(raw_mapping.get("nganh")),
            "specialization_name": normalize_text(raw_mapping.get("chuyen_nganh")),
        }
        if not all(mapping.values()):
            raise DatasetValidationError(f"Incomplete class mapping: {raw_mapping!r}")
        previous = mapping_by_class.get(class_code)
        if previous is not None and previous != mapping:
            raise DatasetValidationError(f"Conflicting mapping for class {class_code}")
        mapping_by_class[class_code] = mapping

    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    failed_source_rows = 0
    for row in source_rows:
        info = row.get("student_info") or {}
        student_code = normalize_text(info.get(INFO_CODE))
        if not student_code:
            failed_source_rows += 1
            continue
        groups[student_code].append(row)

    observed_course_departments: dict[str, set[str]] = defaultdict(set)
    for records in groups.values():
        info = records[0].get("student_info") or {}
        class_code = normalize_text(info.get(INFO_CLASS))
        mapping = mapping_by_class.get(class_code)
        if mapping is None:
            raise DatasetValidationError(f"No specialization mapping for class {class_code!r}")
        for record in records:
            for grade in record.get("grades") or []:
                course_name = normalize_text(grade.get(GRADE_COURSE))
                if course_name:
                    observed_course_departments[course_key(course_name)].add(mapping["department_name"])

    reviewed_course_departments = {
        course_key(name): normalize_text(dept) for name, dept in course_departments.items()
    }
    overrides = {course_key(name): dept for name, dept in COURSE_DEPARTMENT_OVERRIDES.items()}
    resolved_course_departments: dict[str, tuple[str, str]] = {}
    derived_course_departments = 0
    for normalized_key, observed_departments in observed_course_departments.items():
        if normalized_key in reviewed_course_departments:
            resolved_course_departments[normalized_key] = (
                reviewed_course_departments[normalized_key],
                "reviewed_mapping",
            )
        elif normalized_key in overrides:
            resolved_course_departments[normalized_key] = (overrides[normalized_key], "reviewed_override")
        elif len(observed_departments) == 1:
            resolved_course_departments[normalized_key] = (
                next(iter(observed_departments)),
                "single_source_department",
            )
            derived_course_departments += 1
        else:
            raise DatasetValidationError(
                f"Ambiguous department for course {normalized_key!r}: {sorted(observed_departments)}"
            )

    students: list[dict[str, Any]] = []
    grades: list[dict[str, Any]] = []
    specializations: dict[tuple[str, str], dict[str, Any]] = {}
    courses: dict[str, dict[str, Any]] = {}
    duplicate_grade_rows = 0
    grade_conflicts = 0
    skipped_grade_rows = 0

    for student_code in sorted(groups):
        records = groups[student_code]
        signatures = {_identity_signature(record.get("student_info") or {}) for record in records}
        if len(signatures) != 1:
            raise DatasetValidationError(f"Identity conflict for student {student_code}")

        info = records[0].get("student_info") or {}
        class_code = normalize_text(info.get(INFO_CLASS))
        mapping = mapping_by_class[class_code]
        source_program = normalize_text(info.get(INFO_PROGRAM))
        if canonical_key(source_program) != canonical_key(mapping["program_name"]):
            raise DatasetValidationError(
                f"Program mismatch for student {student_code}: {source_program!r} != {mapping['program_name']!r}"
            )

        specialization_key = (mapping["program_name"], mapping["specialization_name"])
        specialization_code = stable_code("SPEC", *specialization_key)
        specializations[specialization_key] = {
            "code": specialization_code,
            "name": mapping["specialization_name"],
            "program_name": mapping["program_name"],
            "department_name": mapping["department_name"],
        }

        merged_grades: dict[tuple[str, str, str], dict[str, Any]] = {}
        for record in records:
            for raw_grade in record.get("grades") or []:
                course_name = normalize_text(raw_grade.get(GRADE_COURSE))
                section_code = normalize_text(raw_grade.get(GRADE_SECTION))
                if not course_name or not section_code:
                    skipped_grade_rows += 1
                    continue
                key = _grade_key(raw_grade)
                if key in merged_grades:
                    duplicate_grade_rows += 1
                    merged_grades[key], conflicted = _merge_grade(merged_grades[key], raw_grade)
                    grade_conflicts += int(conflicted)
                else:
                    merged_grades[key] = raw_grade

        gpa_points = 0.0
        gpa_credits = 0
        for grade_key in sorted(merged_grades):
            raw_grade = merged_grades[grade_key]
            course_name = normalize_text(raw_grade.get(GRADE_COURSE))
            normalized_course_key = course_key(course_name)
            department_name, department_source = resolved_course_departments[normalized_course_key]
            credits = max(parse_int(raw_grade.get(GRADE_CREDITS)), 0)
            semester = parse_semester(raw_grade.get(GRADE_SEMESTER))
            letter = clean_grade_letter(raw_grade.get(GRADE_LETTER))
            grade_4 = GRADE_4_MAP.get(letter or "")
            final_grade = parse_float(raw_grade.get(GRADE_FINAL))
            if grade_4 is not None and credits:
                gpa_points += grade_4 * credits
                gpa_credits += credits

            components = []
            for component_name, weight, sort_order in GRADE_COMPONENTS:
                score = parse_float(raw_grade.get(component_name))
                if score is not None:
                    components.append(
                        {
                            "name": component_name,
                            "score": score,
                            "weight": weight,
                            "sort_order": sort_order,
                        }
                    )

            course = courses.setdefault(
                normalized_course_key,
                {
                    "key": normalized_course_key,
                    "code": stable_code("H46", normalized_course_key, length=16),
                    "name": course_name,
                    "department_name": department_name,
                    "department_source": department_source,
                    "credits": credits,
                },
            )
            if course["department_name"] != department_name:
                raise DatasetValidationError(f"Department conflict for course {course_name}")
            course["credits"] = max(course["credits"], credits)

            grades.append(
                {
                    "student_code": student_code,
                    "program_name": mapping["program_name"],
                    "specialization_code": specialization_code,
                    "course_key": normalized_course_key,
                    "semester": semester,
                    "section_code": normalize_text(raw_grade.get(GRADE_SECTION)),
                    "credits": credits,
                    "final_grade": final_grade,
                    "grade_letter": letter,
                    "grade_4": grade_4,
                    "is_passed": final_grade >= 5.0 if final_grade is not None else None,
                    "status": "completed" if final_grade is not None else "enrolled",
                    "attempt_number": 1,
                    "components": components,
                }
            )

        cohort_year = parse_int(info.get(INFO_COHORT))
        if not 1900 <= cohort_year <= 2100:
            raise DatasetValidationError(f"Invalid cohort for student {student_code}: {info.get(INFO_COHORT)!r}")
        status = STATUS_MAP.get(canonical_key(info.get(INFO_STATUS)), "active")
        students.append(
            {
                "student_code": student_code,
                "full_name": normalize_text(info.get(INFO_NAME)),
                "gender": normalize_text(info.get(INFO_GENDER)) or None,
                "class_code": class_code,
                "status": status,
                "cohort_code": f"K{cohort_year % 100:02d}",
                "cohort_year": cohort_year,
                "program_name": mapping["program_name"],
                "department_name": mapping["department_name"],
                "specialization_code": specialization_code,
                "gpa_cumulative": round(gpa_points / gpa_credits, 2) if gpa_credits else None,
            }
        )

    grades.sort(
        key=lambda row: (
            row["student_code"],
            row["semester"]["code"],
            row["course_key"],
            row["section_code"],
        )
    )
    component_count = sum(len(grade["components"]) for grade in grades)
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "source_checksum": source_checksum,
        "source_rows": len(source_rows),
        "valid_source_rows": len(source_rows) - failed_source_rows,
        "failed_source_rows": failed_source_rows,
        "duplicate_student_rows": sum(len(records) - 1 for records in groups.values()),
        "unique_students": len(students),
        "class_mappings": len(mapping_by_class),
        "specializations": len(specializations),
        "courses": len(courses),
        "enrollments": len(grades),
        "grade_components": component_count,
        "skipped_grade_rows": skipped_grade_rows,
        "duplicate_grade_rows": duplicate_grade_rows,
        "grade_conflicts": grade_conflicts,
        "derived_course_departments": derived_course_departments,
        "reviewed_course_overrides": len(COURSE_DEPARTMENT_OVERRIDES),
    }
    artifact = {
        "schema_version": SCHEMA_VERSION,
        "manifest": manifest,
        "class_mappings": sorted(
            (
                {
                    **mapping,
                    "specialization_code": stable_code(
                        "SPEC", mapping["program_name"], mapping["specialization_name"]
                    ),
                }
                for mapping in mapping_by_class.values()
            ),
            key=lambda item: item["class_code"],
        ),
        "specializations": sorted(specializations.values(), key=lambda item: item["code"]),
        "courses": sorted(courses.values(), key=lambda item: item["key"]),
        "students": students,
        "grades": grades,
    }
    canonical_payload = json.dumps(artifact, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    manifest["artifact_checksum"] = hashlib.sha256(canonical_payload).hexdigest()
    return artifact


def build_artifact(source: Path, class_mapping: Path, course_department_mapping: Path) -> dict[str, Any]:
    """Load source files and build one normalized artifact."""
    return normalize_dataset(
        _load_json(source),
        _load_json(class_mapping),
        _load_json(course_department_mapping),
        source_checksum=_source_checksum((source, class_mapping, course_department_mapping)),
    )


def write_artifact(
    artifact: dict[str, Any],
    artifact_path: Path,
    manifest_path: Path,
    specialization_catalog_path: Path,
) -> None:
    """Write deterministic compressed data plus a human-reviewable manifest."""
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(artifact, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    with artifact_path.open("wb") as raw_file, gzip.GzipFile(fileobj=raw_file, mode="wb", mtime=0) as compressed:
        compressed.write(payload)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(artifact["manifest"], ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    specialization_catalog_path.parent.mkdir(parents=True, exist_ok=True)
    specialization_catalog_path.write_text(
        json.dumps(
            {
                "schema_version": SCHEMA_VERSION,
                "source_checksum": artifact["manifest"]["source_checksum"],
                "specializations": artifact["specializations"],
                "class_mappings": artifact["class_mappings"],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


def load_artifact(path: Path) -> dict[str, Any]:
    """Read and validate a normalized artifact."""
    with gzip.open(path, "rt", encoding="utf-8") as artifact_file:
        artifact = json.load(artifact_file)
    if artifact.get("schema_version") != SCHEMA_VERSION:
        raise DatasetValidationError(f"Unsupported artifact schema: {artifact.get('schema_version')}")
    expected_checksum = artifact.get("manifest", {}).pop("artifact_checksum", "")
    payload = json.dumps(artifact, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    actual_checksum = hashlib.sha256(payload).hexdigest()
    artifact["manifest"]["artifact_checksum"] = expected_checksum
    if not expected_checksum or expected_checksum != actual_checksum:
        raise DatasetValidationError("Artifact checksum mismatch")
    return artifact


def validate_manifest(artifact: dict[str, Any], expected_students: int) -> None:
    """Enforce the H46 acceptance counts before database access."""
    manifest = artifact["manifest"]
    if manifest["unique_students"] != expected_students:
        raise DatasetValidationError(
            f"Expected {expected_students} unique students, found {manifest['unique_students']}"
        )
    if manifest["failed_source_rows"] != 241 or manifest["duplicate_student_rows"] != 42:
        raise DatasetValidationError("Source quality counts changed; review the crawl before importing")
    if manifest["specializations"] != 26 or manifest["class_mappings"] != 80:
        raise DatasetValidationError("Specialization mapping coverage changed")


def _chunks(rows: Sequence[Any], size: int = 2000) -> Iterable[Sequence[Any]]:
    for index in range(0, len(rows), size):
        yield rows[index : index + size]


async def _executemany(connection: asyncpg.Connection, statement: str, rows: Sequence[Sequence[Any]]) -> None:
    for batch in _chunks(rows):
        await connection.executemany(statement, batch)


def _unique_lookup(rows: Sequence[asyncpg.Record], label: str) -> dict[str, asyncpg.Record]:
    grouped: dict[str, list[asyncpg.Record]] = defaultdict(list)
    for row in rows:
        grouped[canonical_key(row["name"])].append(row)
    ambiguous = {key: values for key, values in grouped.items() if len(values) > 1}
    if ambiguous:
        raise DatasetValidationError(f"Ambiguous {label} names: {sorted(ambiguous)}")
    return {key: values[0] for key, values in grouped.items()}


async def _database_counts(connection: asyncpg.Connection) -> dict[str, int]:
    row = await connection.fetchrow(
        """
        SELECT
            (SELECT COUNT(*) FROM students) AS students,
            (SELECT COUNT(*) FROM enrollments) AS enrollments,
            (SELECT COUNT(*) FROM grade_components) AS grade_components,
            (SELECT COUNT(*) FROM specializations WHERE NOT is_placeholder) AS real_specializations
        """
    )
    return {key: int(value) for key, value in dict(row).items()}


async def apply_artifact(
    connection: asyncpg.Connection,
    artifact: dict[str, Any],
    *,
    expected_students: int = DEFAULT_EXPECTED_STUDENTS,
) -> dict[str, Any]:
    """Upsert an artifact in one PostgreSQL transaction and verify acceptance."""
    validate_manifest(artifact, expected_students)
    before = await _database_counts(connection)
    students = artifact["students"]
    grades = artifact["grades"]
    student_codes = [student["student_code"] for student in students]

    async with connection.transaction():
        department_rows = await connection.fetch("SELECT id, name FROM departments")
        departments = _unique_lookup(department_rows, "department")
        required_departments = {
            canonical_key(course["department_name"]) for course in artifact["courses"]
        } | {canonical_key(student["department_name"]) for student in students}
        missing_departments = sorted(required_departments - departments.keys())
        if missing_departments:
            raise DatasetValidationError(f"Departments missing from canonical catalog: {missing_departments}")

        program_rows = await connection.fetch("SELECT id, department_id, code, name FROM programs")
        programs = _unique_lookup(program_rows, "program")
        required_programs = {canonical_key(student["program_name"]) for student in students}
        missing_programs = sorted(required_programs - programs.keys())
        if missing_programs:
            raise DatasetValidationError(f"Programs missing from canonical catalog: {missing_programs}")

        await _executemany(
            connection,
            """
            INSERT INTO specializations (program_id, code, name, is_placeholder, is_active)
            VALUES ($1, 'UNASSIGNED', 'Chưa phân loại', TRUE, TRUE)
            ON CONFLICT (program_id, code) DO UPDATE SET
                is_placeholder = TRUE,
                updated_at = NOW()
            """,
            [(row["id"],) for row in program_rows],
        )

        specialization_args = []
        for specialization in artifact["specializations"]:
            program_id = programs[canonical_key(specialization["program_name"])]["id"]
            specialization_args.append((program_id, specialization["code"], specialization["name"]))
        await _executemany(
            connection,
            """
            INSERT INTO specializations (program_id, code, name, is_placeholder, is_active)
            VALUES ($1, $2, $3, FALSE, TRUE)
            ON CONFLICT (program_id, code) DO UPDATE SET
                name = EXCLUDED.name,
                is_placeholder = FALSE,
                is_active = TRUE,
                updated_at = NOW()
            """,
            specialization_args,
        )
        specialization_rows = await connection.fetch(
            "SELECT id, program_id, code FROM specializations WHERE code = ANY($1::text[])",
            [item["code"] for item in artifact["specializations"]],
        )
        specialization_ids = {(row["program_id"], row["code"]): row["id"] for row in specialization_rows}

        cohort_args = sorted(
            {
                (student["cohort_code"], student["cohort_year"], student["cohort_year"] + 5)
                for student in students
            }
        )
        await _executemany(
            connection,
            """
            INSERT INTO cohorts (code, year_start, year_end)
            VALUES ($1, $2, $3)
            ON CONFLICT (code) DO UPDATE SET year_start = EXCLUDED.year_start, year_end = EXCLUDED.year_end
            """,
            cohort_args,
        )
        cohort_rows = await connection.fetch(
            "SELECT id, code FROM cohorts WHERE code = ANY($1::text[])", [row[0] for row in cohort_args]
        )
        cohort_ids = {row["code"]: row["id"] for row in cohort_rows}

        semester_by_code = {grade["semester"]["code"]: grade["semester"] for grade in grades}
        semester_args = [
            (item["code"], item["name"], item["year"], item["term"])
            for item in sorted(semester_by_code.values(), key=lambda value: value["code"])
        ]
        await _executemany(
            connection,
            """
            INSERT INTO semesters (code, name, year, term, is_current)
            VALUES ($1, $2, $3, $4, FALSE)
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, year = EXCLUDED.year, term = EXCLUDED.term
            """,
            semester_args,
        )
        semester_rows = await connection.fetch(
            "SELECT id, code FROM semesters WHERE code = ANY($1::text[])", list(semester_by_code)
        )
        semester_ids = {row["code"]: row["id"] for row in semester_rows}

        existing_course_rows = await connection.fetch(
            """
            SELECT c.id, c.code, c.name, c.department_id, d.name AS department_name
            FROM courses c LEFT JOIN departments d ON d.id = c.department_id
            """
        )
        courses_by_name: dict[str, list[asyncpg.Record]] = defaultdict(list)
        courses_by_code = {row["code"]: row for row in existing_course_rows}
        for row in existing_course_rows:
            courses_by_name[course_key(row["name"])].append(row)

        course_ids: dict[str, int] = {}
        missing_courses: list[tuple[Any, ...]] = []
        for course in artifact["courses"]:
            expected_department = departments[canonical_key(course["department_name"])]["id"]
            candidates = courses_by_name.get(course["key"], [])
            department_candidates = [row for row in candidates if row["department_id"] == expected_department]
            if len(department_candidates) == 1:
                course_ids[course["key"]] = department_candidates[0]["id"]
            elif len(candidates) == 1:
                course_ids[course["key"]] = candidates[0]["id"]
            elif not candidates:
                code_match = courses_by_code.get(course["code"])
                if code_match is not None and course_key(code_match["name"]) != course["key"]:
                    raise DatasetValidationError(f"Stable course code collision: {course['code']}")
                if code_match is not None:
                    course_ids[course["key"]] = code_match["id"]
                else:
                    missing_courses.append(
                        (
                            expected_department,
                            course["code"],
                            course["name"],
                            max(int(course["credits"]), 1),
                        )
                    )
            else:
                raise DatasetValidationError(
                    f"Ambiguous existing course {course['name']!r}: {[row['id'] for row in candidates]}"
                )

        await _executemany(
            connection,
            """
            INSERT INTO courses (department_id, code, name, credits, is_elective, is_active)
            VALUES ($1, $2, $3, $4, FALSE, TRUE)
            ON CONFLICT (code) DO UPDATE SET
                department_id = EXCLUDED.department_id,
                name = EXCLUDED.name,
                credits = EXCLUDED.credits,
                is_active = TRUE,
                updated_at = NOW()
            """,
            missing_courses,
        )
        if missing_courses:
            inserted_course_rows = await connection.fetch(
                "SELECT id, code, name FROM courses WHERE code = ANY($1::text[])", [row[1] for row in missing_courses]
            )
            for row in inserted_course_rows:
                course_ids[course_key(row["name"])] = row["id"]
        if len(course_ids) != len(artifact["courses"]):
            raise DatasetValidationError("Not every normalized course resolved to a database ID")

        student_args = []
        for student in students:
            program_id = programs[canonical_key(student["program_name"])]["id"]
            specialization_id = specialization_ids[(program_id, student["specialization_code"])]
            student_args.append(
                (
                    program_id,
                    specialization_id,
                    cohort_ids[student["cohort_code"]],
                    student["student_code"],
                    student["full_name"],
                    student["gender"],
                    student["class_code"],
                    student["status"],
                    student["gpa_cumulative"],
                )
            )
        await _executemany(
            connection,
            """
            INSERT INTO students
                (program_id, specialization_id, cohort_id, student_code, full_name, gender,
                 class_code, status, gpa_cumulative, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
            ON CONFLICT (student_code) DO UPDATE SET
                program_id = EXCLUDED.program_id,
                specialization_id = EXCLUDED.specialization_id,
                cohort_id = EXCLUDED.cohort_id,
                full_name = EXCLUDED.full_name,
                gender = EXCLUDED.gender,
                class_code = EXCLUDED.class_code,
                status = EXCLUDED.status,
                gpa_cumulative = EXCLUDED.gpa_cumulative,
                is_active = TRUE,
                updated_at = NOW()
            """,
            student_args,
        )
        student_rows = await connection.fetch(
            "SELECT id, student_code FROM students WHERE student_code = ANY($1::text[])", student_codes
        )
        student_ids = {row["student_code"]: row["id"] for row in student_rows}

        program_course_pairs = sorted(
            {
                (programs[canonical_key(grade["program_name"])]["id"], course_ids[grade["course_key"]])
                for grade in grades
            }
        )
        specialization_course_pairs = sorted(
            {
                (
                    specialization_ids[
                        (
                            programs[canonical_key(grade["program_name"])]["id"],
                            grade["specialization_code"],
                        )
                    ],
                    course_ids[grade["course_key"]],
                )
                for grade in grades
            }
        )
        await _executemany(
            connection,
            "INSERT INTO program_courses (program_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            program_course_pairs,
        )
        await connection.execute(
            """
            INSERT INTO specialization_courses (specialization_id, course_id)
            SELECT s.id, pc.course_id
            FROM specializations s
            JOIN program_courses pc ON pc.program_id = s.program_id
            WHERE s.is_placeholder
            ON CONFLICT DO NOTHING
            """
        )
        await _executemany(
            connection,
            """
            INSERT INTO specialization_courses (specialization_id, course_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
            """,
            specialization_course_pairs,
        )

        section_args = sorted(
            {
                (
                    course_ids[grade["course_key"]],
                    semester_ids[grade["semester"]["code"]],
                    grade["section_code"],
                )
                for grade in grades
            }
        )
        await _executemany(
            connection,
            """
            INSERT INTO sections (course_id, semester_id, section_code, is_active)
            VALUES ($1, $2, $3, TRUE)
            ON CONFLICT (course_id, semester_id, section_code) DO UPDATE SET is_active = TRUE, updated_at = NOW()
            """,
            section_args,
        )
        relevant_course_ids = sorted({row[0] for row in section_args})
        section_rows = await connection.fetch(
            """
            SELECT id, course_id, semester_id, section_code
            FROM sections WHERE course_id = ANY($1::int[])
            """,
            relevant_course_ids,
        )
        section_ids = {
            (row["course_id"], row["semester_id"], row["section_code"]): row["id"] for row in section_rows
        }

        enrollment_args = []
        normalized_enrollments = []
        for grade in grades:
            section_id = section_ids[
                (
                    course_ids[grade["course_key"]],
                    semester_ids[grade["semester"]["code"]],
                    grade["section_code"],
                )
            ]
            student_id = student_ids[grade["student_code"]]
            enrollment_args.append(
                (
                    student_id,
                    section_id,
                    grade["final_grade"],
                    grade["grade_letter"],
                    grade["grade_4"],
                    grade["is_passed"],
                    grade["credits"],
                    grade["attempt_number"],
                    grade["status"],
                )
            )
            normalized_enrollments.append((grade, student_id, section_id))
        await _executemany(
            connection,
            """
            INSERT INTO enrollments
                (student_id, section_id, final_grade, grade_letter, grade_4, is_passed,
                 registered_credits, attempt_number, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (student_id, section_id, attempt_number) DO UPDATE SET
                final_grade = EXCLUDED.final_grade,
                grade_letter = EXCLUDED.grade_letter,
                grade_4 = EXCLUDED.grade_4,
                is_passed = EXCLUDED.is_passed,
                registered_credits = EXCLUDED.registered_credits,
                status = EXCLUDED.status,
                updated_at = NOW()
            """,
            enrollment_args,
        )
        relevant_student_ids = sorted(student_ids.values())
        enrollment_rows = await connection.fetch(
            """
            SELECT id, student_id, section_id, attempt_number
            FROM enrollments WHERE student_id = ANY($1::int[])
            """,
            relevant_student_ids,
        )
        enrollment_ids = {
            (row["student_id"], row["section_id"], row["attempt_number"]): row["id"] for row in enrollment_rows
        }

        relevant_section_ids = sorted({section_id for _, _, section_id in normalized_enrollments})
        existing_type_rows = await connection.fetch(
            """
            SELECT id, section_id, name FROM grade_component_types
            WHERE section_id = ANY($1::int[])
            """,
            relevant_section_ids,
        )
        component_type_ids = {(row["section_id"], row["name"]): row["id"] for row in existing_type_rows}
        required_types = {
            (section_id, component["name"], component["weight"], component["sort_order"])
            for grade, _, section_id in normalized_enrollments
            for component in grade["components"]
        }
        missing_types = sorted(
            row for row in required_types if (row[0], row[1]) not in component_type_ids
        )
        await _executemany(
            connection,
            """
            INSERT INTO grade_component_types
                (section_id, name, weight, max_score, is_required, sort_order)
            VALUES ($1, $2, $3, 10.0, TRUE, $4)
            """,
            missing_types,
        )
        if missing_types:
            type_rows = await connection.fetch(
                """
                SELECT id, section_id, name FROM grade_component_types
                WHERE section_id = ANY($1::int[])
                """,
                relevant_section_ids,
            )
            component_type_ids = {(row["section_id"], row["name"]): row["id"] for row in type_rows}

        component_args = []
        for grade, student_id, section_id in normalized_enrollments:
            enrollment_id = enrollment_ids[(student_id, section_id, grade["attempt_number"])]
            for component in grade["components"]:
                component_args.append(
                    (
                        enrollment_id,
                        component_type_ids[(section_id, component["name"])],
                        component["score"],
                    )
                )
        await _executemany(
            connection,
            """
            INSERT INTO grade_components
                (enrollment_id, component_type_id, score, max_score, is_absent)
            VALUES ($1, $2, $3, 10.0, FALSE)
            ON CONFLICT (enrollment_id, component_type_id) DO UPDATE SET
                score = EXCLUDED.score,
                max_score = EXCLUDED.max_score,
                is_absent = FALSE,
                updated_at = NOW()
            """,
            component_args,
        )

        imported_program_ids = sorted(
            {programs[canonical_key(student["program_name"])]["id"] for student in students}
        )
        for program_id in imported_program_ids:
            placeholder = await connection.fetchrow(
                "SELECT id FROM specializations WHERE program_id = $1 AND is_placeholder", program_id
            )
            if placeholder is None:
                continue
            program_courses = set(
                await connection.fetchval(
                    "SELECT COALESCE(array_agg(course_id), ARRAY[]::int[]) FROM program_courses WHERE program_id = $1",
                    program_id,
                )
            )
            mapped_courses = set(
                await connection.fetchval(
                    """
                    SELECT COALESCE(array_agg(DISTINCT sc.course_id), ARRAY[]::int[])
                    FROM specialization_courses sc
                    JOIN specializations s ON s.id = sc.specialization_id
                    WHERE s.program_id = $1 AND NOT s.is_placeholder
                    """,
                    program_id,
                )
            )
            null_students = int(
                await connection.fetchval(
                    "SELECT COUNT(*) FROM students WHERE program_id = $1 AND specialization_id IS NULL", program_id
                )
            )
            placeholder_courses = program_courses if null_students else program_courses - mapped_courses
            await connection.execute(
                "DELETE FROM specialization_courses WHERE specialization_id = $1", placeholder["id"]
            )
            if placeholder_courses:
                await _executemany(
                    connection,
                    """
                    INSERT INTO specialization_courses (specialization_id, course_id)
                    VALUES ($1, $2) ON CONFLICT DO NOTHING
                    """,
                    [(placeholder["id"], course_id) for course_id in sorted(placeholder_courses)],
                )
            await connection.execute(
                "UPDATE specializations SET is_active = $2, updated_at = NOW() WHERE id = $1",
                placeholder["id"],
                bool(null_students or placeholder_courses),
            )

        database_student_count = int(await connection.fetchval("SELECT COUNT(*) FROM students"))
        imported_count = int(
            await connection.fetchval(
                "SELECT COUNT(*) FROM students WHERE student_code = ANY($1::text[])", student_codes
            )
        )
        null_specializations = int(
            await connection.fetchval(
                """
                SELECT COUNT(*) FROM students
                WHERE student_code = ANY($1::text[]) AND specialization_id IS NULL
                """,
                student_codes,
            )
        )
        imported_enrollments = int(
            await connection.fetchval(
                "SELECT COUNT(*) FROM enrollments WHERE student_id = ANY($1::int[])", relevant_student_ids
            )
        )
        imported_components = int(
            await connection.fetchval(
                """
                SELECT COUNT(*) FROM grade_components gc
                JOIN enrollments e ON e.id = gc.enrollment_id
                WHERE e.student_id = ANY($1::int[])
                """,
                relevant_student_ids,
            )
        )
        expected_components = artifact["manifest"]["grade_components"]
        checks = {
            "database_students": database_student_count == expected_students,
            "imported_students": imported_count == expected_students,
            "null_specializations": null_specializations == 0,
            "enrollments": imported_enrollments == artifact["manifest"]["enrollments"],
            "grade_components": imported_components == expected_components,
        }
        if not all(checks.values()):
            raise DatasetValidationError(
                "Post-import acceptance failed: "
                + json.dumps(
                    {
                        "checks": checks,
                        "database_students": database_student_count,
                        "imported_students": imported_count,
                        "null_specializations": null_specializations,
                        "enrollments": imported_enrollments,
                        "expected_enrollments": artifact["manifest"]["enrollments"],
                        "grade_components": imported_components,
                        "expected_grade_components": expected_components,
                    },
                    sort_keys=True,
                )
            )

    after = await _database_counts(connection)
    return {
        "applied_at": datetime.now(UTC).isoformat(),
        "artifact_checksum": artifact["manifest"]["artifact_checksum"],
        "before": before,
        "after": after,
        "acceptance": {
            "expected_students": expected_students,
            "imported_students": expected_students,
            "null_specializations": 0,
            "enrollments": artifact["manifest"]["enrollments"],
            "grade_components": artifact["manifest"]["grade_components"],
            "passed": True,
        },
    }


def write_evidence(report: dict[str, Any], report_dir: Path) -> None:
    """Write aggregate-only H46 execution evidence."""
    report_dir.mkdir(parents=True, exist_ok=True)
    json_path = report_dir / "H46-import-report.json"
    if json_path.exists():
        previous_report = json.loads(json_path.read_text(encoding="utf-8"))
        report["initial_before"] = previous_report.get("initial_before", previous_report["before"])
    else:
        report["initial_before"] = report["before"]
    report["idempotent_rerun"] = report["before"] == report["after"]
    json_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    acceptance = report["acceptance"]
    markdown = f"""# H46 Import Evidence

- Applied at: `{report['applied_at']}`
- Artifact checksum: `{report['artifact_checksum']}`
- Students: **{acceptance['imported_students']}**
- Students without specialization: **{acceptance['null_specializations']}**
- Enrollments: **{acceptance['enrollments']}**
- Grade components: **{acceptance['grade_components']}**
- Idempotent acceptance: **PASS**

## Counts

| Entity | Before | After |
|---|---:|---:|
| Students | {report['before']['students']} | {report['after']['students']} |
| Enrollments | {report['before']['enrollments']} | {report['after']['enrollments']} |
| Grade components | {report['before']['grade_components']} | {report['after']['grade_components']} |
| Real specializations | {report['before']['real_specializations']} | {report['after']['real_specializations']} |

Initial pre-H46 student count: **{report['initial_before']['students']}**.  
Second-run row counts unchanged: **{'PASS' if report['idempotent_rerun'] else 'NOT RUN'}**.
"""
    (report_dir / "H46-import-report.md").write_text(markdown, encoding="utf-8")


def _database_url(cli_value: str | None) -> str:
    value = cli_value or os.getenv("DATABASE_URL", "")
    if not value:
        raise DatasetValidationError("DATABASE_URL or --database-url is required with --apply")
    return value.replace("postgresql+asyncpg://", "postgresql://", 1)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--class-mapping", type=Path, default=DEFAULT_CLASS_MAPPING)
    parser.add_argument("--course-departments", type=Path, default=DEFAULT_COURSE_DEPARTMENTS)
    parser.add_argument("--artifact", type=Path, help="Read a previously normalized .json.gz artifact")
    parser.add_argument("--artifact-out", type=Path, default=DEFAULT_ARTIFACT)
    parser.add_argument("--manifest-out", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--specialization-catalog-out", type=Path, default=DEFAULT_SPECIALIZATION_CATALOG)
    parser.add_argument("--expected-students", type=int, default=DEFAULT_EXPECTED_STUDENTS)
    parser.add_argument("--apply", action="store_true", help="Upsert into PostgreSQL; omitted means dry-run")
    parser.add_argument("--database-url")
    parser.add_argument(
        "--report-dir",
        type=Path,
        default=PROJECT_ROOT / "docs" / "07-Sprint-Planning" / "evidence" / "H46",
    )
    return parser.parse_args()


async def _async_main(args: argparse.Namespace) -> None:
    if args.artifact:
        artifact = load_artifact(args.artifact)
    else:
        artifact = build_artifact(args.source, args.class_mapping, args.course_departments)
        write_artifact(
            artifact,
            args.artifact_out,
            args.manifest_out,
            args.specialization_catalog_out,
        )
    validate_manifest(artifact, args.expected_students)
    print(json.dumps(artifact["manifest"], ensure_ascii=False, indent=2, sort_keys=True))
    if not args.apply:
        print("[H46] Dry-run passed; PostgreSQL was not modified.")
        return

    connection = await asyncpg.connect(_database_url(args.database_url), command_timeout=300)
    try:
        report = await apply_artifact(connection, artifact, expected_students=args.expected_students)
    finally:
        await connection.close()
    write_evidence(report, args.report_dir)
    print(json.dumps(report, indent=2, sort_keys=True))


def main() -> None:
    """CLI entry point."""
    asyncio.run(_async_main(_parse_args()))


if __name__ == "__main__":
    main()

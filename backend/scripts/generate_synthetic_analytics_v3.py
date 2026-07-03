"""Generate deterministic synthetic analytics artifacts without writing a database."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from datetime import UTC, datetime
from pathlib import Path

SOURCE = "synthetic_analytics_v3"
DEFAULT_SEED = 20260702
TARGET_STUDENTS = 30


def _stable_int(*parts: object) -> int:
    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:12], 16)


def _grade(seed: int, program_id: int, student_index: int, semester_id: int, course_id: int) -> float | None:
    rng = random.Random(_stable_int(seed, program_id, student_index, semester_id, course_id))
    if rng.random() < 0.04:
        return None
    profile = student_index % 10
    center = 4.2 if profile == 0 else 5.4 if profile < 3 else 7.1
    return round(min(10, max(0, rng.gauss(center, 1.05))), 2)


def generate(catalog: dict, seed: int = DEFAULT_SEED) -> dict:
    """Build a stable artifact from an audited catalog snapshot."""
    generated_at = datetime.now(UTC).isoformat()
    artifact = {
        "schema_version": 1,
        "source": SOURCE,
        "seed": seed,
        "official": False,
        "generated_at": generated_at,
        "derivation": "deterministic sparse-program completion from audited catalog natural keys",
        "programs": [],
    }
    for program in sorted(catalog["programs"], key=lambda row: row["program_id"]):
        current = int(program.get("active_students_with_enrollments", 0))
        needed = max(0, TARGET_STUDENTS - current)
        if not needed:
            continue
        courses = list(program["course_ids"])[:8]
        semesters = list(program["semester_ids"])[-6:]
        if len(courses) < 5 or len(semesters) < 4 or not program.get("cohort_ids") or not program.get("teacher_ids"):
            raise ValueError(f"Program {program['program_id']} lacks 5 courses, 4 semesters, cohort, or teacher")
        courses = courses[: max(5, min(8, len(courses)))]
        semesters = semesters[-max(4, min(6, len(semesters))):]
        sections = []
        for semester_id in semesters:
            for course_id in courses:
                sections.append({
                    "natural_key": f"SYNV3-{program['program_code']}-{semester_id}-{course_id}",
                    "course_id": course_id,
                    "semester_id": semester_id,
                    "teacher_id": program["teacher_ids"][_stable_int(seed, course_id, semester_id) % len(program["teacher_ids"])],
                    "max_students": 45,
                })
        students = []
        for index in range(needed):
            student_code = f"SYNV3{program['program_id']:04d}{index:04d}"
            enrollments = []
            grades_for_gpa = []
            for semester_id in semesters:
                for course_id in courses:
                    final_grade = _grade(seed, program["program_id"], index, semester_id, course_id)
                    grades_for_gpa.append(final_grade)
                    components = [] if final_grade is None else [
                        {"name": "Quá trình", "weight": 0.3, "score": round(max(0, min(10, final_grade + 0.4)), 2)},
                        {"name": "Giữa kỳ", "weight": 0.3, "score": round(max(0, min(10, final_grade - 0.2)), 2)},
                        {"name": "Cuối kỳ", "weight": 0.4, "score": final_grade},
                    ]
                    enrollments.append({
                        "section_key": f"SYNV3-{program['program_code']}-{semester_id}-{course_id}",
                        "course_id": course_id,
                        "semester_id": semester_id,
                        "final_grade": final_grade,
                        "components": components,
                    })
            completed = [grade for grade in grades_for_gpa if grade is not None]
            students.append({
                "student_code": student_code,
                "full_name": f"Sinh viên mô phỏng {program['program_code']} {index + 1:02d}",
                "program_id": program["program_id"],
                "cohort_id": program["cohort_ids"][index % len(program["cohort_ids"])],
                "class_code": f"SYN-{program['program_code']}",
                "gpa_cumulative": round(sum(completed) / len(completed) * 0.4, 2) if completed else None,
                "enrollments": enrollments,
            })
        artifact["programs"].append({
            "program_id": program["program_id"], "program_code": program["program_code"],
            "baseline": current, "target": TARGET_STUDENTS, "students": students, "sections": sections,
        })
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()
    artifact = generate(json.loads(args.catalog.read_text(encoding="utf-8")), args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"programs={len(artifact['programs'])} output={args.output}")


if __name__ == "__main__":
    main()

"""Generate transcript-first synthetic demo data from a v5 audit snapshot."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from datetime import UTC, datetime
from pathlib import Path

SOURCE = "synthetic_transcript_coverage_v5"
DEFAULT_SEED = 20260702
STUDENTS_PER_CLASS = 30
MAX_STUDENTS = 800
MAX_ENROLLMENTS = 18000
COMPONENTS = [
    {"name": "Quá trình", "weight": 0.30, "clo_code": "CLO1"},
    {"name": "Giữa kỳ", "weight": 0.30, "clo_code": "CLO2"},
    {"name": "Cuối kỳ", "weight": 0.40, "clo_code": "CLO3"},
]


def _stable_int(*parts: object) -> int:
    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:12], 16)


def _profile(index: int) -> str:
    bucket = index % 20
    if bucket < 3:
        return "high"
    if bucket < 8:
        return "watch"
    return "normal"


def _grade(seed: int, profile: str, program_id: int, student_index: int, semester_index: int, course_index: int) -> float:
    rng = random.Random(_stable_int(seed, profile, program_id, student_index, semester_index, course_index))
    if profile == "high":
        center = 4.2 + semester_index * 0.18
    elif profile == "watch":
        center = 5.3 + semester_index * 0.15
    else:
        center = 7.1 + semester_index * 0.08
    return round(max(1.5, min(9.8, rng.gauss(center, 0.9))), 2)


def _components(final_grade: float) -> list[dict]:
    return [
        {"name": "Quá trình", "weight": 0.30, "score": round(max(0, min(10, final_grade + 0.35)), 2)},
        {"name": "Giữa kỳ", "weight": 0.30, "score": round(max(0, min(10, final_grade - 0.10)), 2)},
        {"name": "Cuối kỳ", "weight": 0.40, "score": final_grade},
    ]


def _class_code(program_code: str, cohort_code: str, suffix: str) -> str:
    clean_cohort = cohort_code.replace(" ", "").replace("-", "")
    if clean_cohort.upper().startswith("K"):
        clean_cohort = clean_cohort[1:]
    return f"S5-{program_code}-K{clean_cohort}-{suffix}"[:30]


def _section_code(program_id: int, cohort_id: int, semester_id: int, course_slot: int, suffix: str) -> str:
    return f"S5P{program_id:02d}C{cohort_id:02d}S{semester_id:02d}{course_slot:02d}{suffix}"[:20]


def generate(audit: dict, seed: int = DEFAULT_SEED, max_students: int = MAX_STUDENTS, max_enrollments: int = MAX_ENROLLMENTS) -> dict:
    artifact = {
        "schema_version": 1,
        "source": SOURCE,
        "seed": seed,
        "official": False,
        "generated_at": datetime.now(UTC).isoformat(),
        "derivation": "deterministic transcript-first synthetic demo coverage",
        "components": COMPONENTS,
        "programs": [],
    }
    semesters = audit["semesters"][-4:]
    for program in audit["programs"]:
        program_payload = {
            "program_id": program["program_id"],
            "program_code": program["program_code"],
            "program_name": program["program_name"],
            "department_id": program["department_id"],
            "classes": [],
            "sections": [],
            "students": [],
        }
        courses = program["courses"][:20]
        teachers = program["teachers"]
        specializations = program.get("specializations") or []
        for cohort_index, cohort in enumerate(program["cohorts"][:2]):
            suffix = chr(ord("A") + cohort_index)
            class_code = _class_code(program["program_code"], cohort["code"], suffix)
            teacher = teachers[cohort_index % len(teachers)]
            specialization_id = specializations[cohort_index % len(specializations)]["id"] if specializations else None
            program_payload["classes"].append({
                "class_code": class_code,
                "teacher_id": teacher["id"],
                "cohort_id": cohort["id"],
                "cohort_code": cohort["code"],
                "specialization_id": specialization_id,
            })
            class_sections = []
            for semester_index, semester in enumerate(semesters):
                semester_courses = courses[semester_index * 5:(semester_index + 1) * 5]
                for course_index, course in enumerate(semester_courses):
                    section_key = f"{class_code}:{semester['code']}:{course['course_id']}"
                    section = {
                        "section_key": section_key,
                        "section_code": _section_code(program["program_id"], cohort["id"], semester["id"], course_index + 1, suffix),
                        "course_id": course["course_id"],
                        "course_code": course["code"],
                        "course_name": course["name"],
                        "semester_id": semester["id"],
                        "semester_code": semester["code"],
                        "teacher_id": teachers[(semester_index + course_index + cohort_index) % len(teachers)]["id"],
                        "max_students": 45,
                    }
                    program_payload["sections"].append(section)
                    class_sections.append(section)
            for student_index in range(STUDENTS_PER_CLASS):
                absolute_index = cohort_index * STUDENTS_PER_CLASS + student_index
                profile = _profile(absolute_index)
                enrollments = []
                grade_values = []
                for enrollment_index, section in enumerate(class_sections):
                    semester_index = enrollment_index // 5
                    course_index = enrollment_index % 5
                    final_grade = _grade(seed, profile, program["program_id"], absolute_index, semester_index, course_index)
                    grade_values.append(final_grade)
                    enrollments.append({
                        "section_key": section["section_key"],
                        "course_id": section["course_id"],
                        "semester_id": section["semester_id"],
                        "final_grade": final_grade,
                        "components": _components(final_grade),
                    })
                student_code = f"S5{program['program_id']:02d}{cohort['id']:02d}{student_index + 1:03d}"[:20]
                program_payload["students"].append({
                    "student_code": student_code,
                    "full_name": f"Sinh viên mô phỏng {program['program_code']} {suffix}{student_index + 1:02d}",
                    "program_id": program["program_id"],
                    "cohort_id": cohort["id"],
                    "specialization_id": specialization_id,
                    "class_code": class_code,
                    "profile": profile,
                    "gpa_cumulative": round(sum(grade_values) / len(grade_values) * 0.4, 2),
                    "enrollments": enrollments,
                })
        artifact["programs"].append(program_payload)
    summary = {
        "programs": len(artifact["programs"]),
        "classes": sum(len(program["classes"]) for program in artifact["programs"]),
        "students": sum(len(program["students"]) for program in artifact["programs"]),
        "sections": sum(len(program["sections"]) for program in artifact["programs"]),
        "enrollments": sum(len(student["enrollments"]) for program in artifact["programs"] for student in program["students"]),
    }
    summary["grade_components"] = summary["enrollments"] * len(COMPONENTS)
    artifact["summary"] = summary
    if summary["students"] > max_students or summary["enrollments"] > max_enrollments:
        raise RuntimeError(f"Artifact exceeds safety limits: {summary}")
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--max-students", type=int, default=MAX_STUDENTS)
    parser.add_argument("--max-enrollments", type=int, default=MAX_ENROLLMENTS)
    args = parser.parse_args()
    artifact = generate(
        json.loads(args.audit.read_text(encoding="utf-8")),
        seed=args.seed,
        max_students=args.max_students,
        max_enrollments=args.max_enrollments,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(artifact["summary"], ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

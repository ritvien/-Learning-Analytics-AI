"""Generate SQL seed data from crawled JSON export."""

import json
import os
import re
from typing import Any


def escape_sql(text: str | None) -> str:
    """Escape a value for safe SQL string interpolation."""
    if text is None:
        return "NULL"
    text = str(text).replace("'", "''")
    return f"'{text}'"


def parse_float(text: str | None) -> str:
    """Parse a string to a SQL float literal, or NULL on failure."""
    if not text:
        return "NULL"
    try:
        return str(float(text))
    except ValueError:
        return "NULL"


def parse_bool(text: str | None) -> str:
    """Return TRUE/FALSE/NULL for a pass/fail check (threshold 5.0)."""
    if not text:
        return "NULL"
    try:
        return "TRUE" if float(text) >= 5.0 else "FALSE"
    except ValueError:
        return "NULL"


def parse_semester_code(text: str) -> tuple[str, int, int]:
    """Parse a Vietnamese semester label into (code, year, term)."""
    # e.g., "HK1 (2021-2022)" -> code: "2021-1", year: 2021, term: 1
    match = re.search(r"HK(\d)\s*\((\d{4})-\d{4}\)", text)
    if match:
        term = int(match.group(1))
        year = int(match.group(2))
        return f"{year}-{term}", year, term
    return text, 2020, 1


def clean_grade_letter(text: str) -> str | None:
    """Extract letter grade (e.g. '[A  - Giỏi]' -> 'A', '[B+ - ]' -> 'B+')."""
    if not text:
        return None
    text = text.replace("[", "").replace("]", "").strip()
    parts = text.split("-")
    cleaned = parts[0].strip()
    return cleaned if cleaned else None


# Grade component columns in the source data, with default weight and display order.
# Weight is a placeholder — actual pedagogical weight varies per course.
GRADE_COMPONENTS = [
    ("TX1", 10.00, 1),
    ("TX2", 10.00, 2),
    ("TX3", 10.00, 3),
    ("TX4", 10.00, 4),
    ("Kết thúc L1", 60.00, 5),
    ("Kết thúc L2", 0.00, 6),  # weight 0 = retake exam, not counted separately
]


def generate_sql() -> None:
    """Read crawled JSON and write SQL INSERT statements to init-data.sql."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    candidates = [
        os.path.join(repo_root, "..", "crawl", "epu_data_batch.json"),
        os.path.join(repo_root, "crawl", "epu_data_batch.json"),
        os.path.join(repo_root, "epu_data.json"),
    ]
    json_path = next((path for path in candidates if os.path.exists(path)), candidates[0])
    sql_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../db/init-data.sql"))

    if not os.path.exists(json_path):
        print(f"File not found: {json_path}")
        return

    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    # --- Lookup maps (natural key -> integer id) ---
    universities: dict[str, int] = {}
    departments: dict[str, int] = {}
    programs: dict[str, int] = {}
    cohorts: dict[str, int] = {}
    semesters: dict[str, int] = {}
    courses: dict[str, int] = {}
    program_courses: set[tuple[int, int]] = set()
    students: dict[str, int] = {}
    sections: dict[str, int] = {}
    # enrollment key: (student_id, section_id) -> enrollment_id
    enrollments: dict[tuple[int, int], int] = {}
    # grade component type key: (section_id, comp_name) -> gct_id
    section_gcts: dict[tuple[int, str], int] = {}
    
    student_records: dict[int, dict[str, Any]] = {}
    student_gpa_data: dict[int, dict[str, float]] = {}

    uni_id = 1
    dept_id = 1
    prog_id = 1
    coh_id = 1
    sem_id = 1
    crs_id = 1
    stu_id = 1
    sec_id = 1
    enr_id = 1
    gct_id = 1
    gc_id = 1

    universities["EPU"] = uni_id

    dept_items: list[str] = []
    prog_items: list[str] = []
    coh_items: list[str] = []
    sem_items: list[str] = []
    crs_items: list[str] = []
    stu_items: list[str] = []
    sec_items: list[str] = []
    enr_items: list[str] = []
    gct_items: list[str] = []
    gc_items: list[str] = []

    print("Parsing JSON data...")
    for item in data:
        student_info = item.get("student_info", {})
        grades = item.get("grades", [])

        # Department
        khoa = student_info.get("Khoa", "Chưa phân khoa")
        if khoa not in departments:
            departments[khoa] = dept_id
            code = f"DEPT{dept_id:02d}"
            dept_items.append(f"({dept_id}, {uni_id}, {escape_sql(code)}, {escape_sql(khoa)}, TRUE)")
            dept_id += 1

        # Program
        nganh = student_info.get("Ngành", "Chưa phân ngành")
        if nganh not in programs:
            programs[nganh] = prog_id
            code = f"PROG{prog_id:03d}"
            d_id = departments[khoa]
            prog_items.append(f"({prog_id}, {d_id}, {escape_sql(code)}, {escape_sql(nganh)}, 4, TRUE)")
            prog_id += 1

        # Cohort
        khoa_hoc = student_info.get("Khóa", "2021")
        if khoa_hoc not in cohorts:
            cohorts[khoa_hoc] = coh_id
            try:
                year_start = int(khoa_hoc)
            except (ValueError, TypeError):
                year_start = 2021
            code = f"K{str(year_start)[-2:]}" if len(str(year_start)) == 4 else f"K{khoa_hoc}"
            coh_items.append(f"({coh_id}, {escape_sql(code)}, {year_start})")
            coh_id += 1

        # Student
        mssv = student_info.get("MSSV", "")
        if not mssv:
            continue
        if mssv not in students:
            students[mssv] = stu_id
            p_id = programs[nganh]
            c_id = cohorts[khoa_hoc]
            name = student_info.get("Họ và tên", "")
            gender = student_info.get("Giới tính", "")
            class_code = student_info.get("Lớp", "")
            trang_thai = student_info.get("Trạng thái", "")
            status_map = {
                "Đang học": "active",
                "Tốt nghiệp": "graduated",
                "Buộc thôi học": "expelled",
                "Thôi học": "withdrawn",
            }
            stu_status = status_map.get(trang_thai, "active")
            student_records[stu_id] = {
                "p_id": p_id,
                "c_id": c_id,
                "mssv": mssv,
                "name": name,
                "gender": gender,
                "class_code": class_code,
                "status": stu_status,
            }
            student_gpa_data[stu_id] = {"total_points": 0.0, "total_credits": 0.0}
            stu_id += 1

        s_id = students[mssv]

        for g in grades:
            hk_name = g.get("Học kỳ", "")
            course_name = g.get("Tên môn học", "")
            section_code = g.get("Mã lớp", "")
            credits_str = g.get("TC", "0")
            final_grade_str = g.get("Điểm tổng kết", "")
            raw_letter = g.get("Xếp loại", "")
            grade_letter = clean_grade_letter(raw_letter)

            if not course_name or not section_code:
                continue

            # Semester
            if hk_name not in semesters:
                code, year, term = parse_semester_code(hk_name)
                semesters[hk_name] = sem_id
                sem_items.append(f"({sem_id}, {escape_sql(code)}, {escape_sql(hk_name)}, {year}, {term}, FALSE)")
                sem_id += 1
            sm_id = semesters[hk_name]

            # Course
            if course_name not in courses:
                courses[course_name] = crs_id
                c_code = f"CRS{crs_id:04d}"
                try:
                    tc = int(credits_str)
                except (ValueError, TypeError):
                    tc = 0
                crs_items.append(f"({crs_id}, {escape_sql(c_code)}, {escape_sql(course_name)}, {tc}, FALSE, TRUE)")
                crs_id += 1
            cr_id = courses[course_name]

            # Program → Course link
            p_id = programs[nganh]
            program_courses.add((p_id, cr_id))

            # Section (unique by section_code + course + semester)
            sec_key = f"{section_code}_{cr_id}_{sm_id}"
            if sec_key not in sections:
                sections[sec_key] = sec_id
                sec_items.append(f"({sec_id}, {cr_id}, {sm_id}, {escape_sql(section_code)}, TRUE)")
                sec_id += 1
            sc_id = sections[sec_key]

            # Enrollment (unique by student + section; attempt_number defaults to 1)
            enr_key = (s_id, sc_id)
            if enr_key not in enrollments:
                enrollments[enr_key] = enr_id
                fg = parse_float(final_grade_str)
                ip = parse_bool(final_grade_str)
                gl = escape_sql(grade_letter)
                
                # Calculate grade_4
                grade_4_map = {
                    "A+": "4.0", "A": "4.0", "B+": "3.5", "B": "3.0",
                    "C+": "2.5", "C": "2.0", "D+": "1.5", "D": "1.0", "F": "0.0"
                }
                g4_val = grade_4_map.get(grade_letter, "NULL")
                
                # Accumulate for student GPA
                if g4_val != "NULL":
                    student_gpa_data[s_id]["total_points"] += float(g4_val) * tc
                    student_gpa_data[s_id]["total_credits"] += tc
                
                enr_items.append(
                    f"({enr_id}, {s_id}, {sc_id}, {fg}, {gl}, {g4_val}, {ip}, 1, 'completed')"
                )
                enr_id += 1
            e_id = enrollments[enr_key]

            # Grade component types + scores
            for comp_name, weight, sort_order in GRADE_COMPONENTS:
                score_str = g.get(comp_name, "")
                score = parse_float(score_str)
                if score == "NULL":
                    continue

                gct_key = (sc_id, comp_name)
                if gct_key not in section_gcts:
                    section_gcts[gct_key] = gct_id
                    gct_items.append(
                        f"({gct_id}, {sc_id}, {escape_sql(comp_name)}, "
                        f"{weight}, 10.0, TRUE, {sort_order})"
                    )
                    gct_id += 1
                gct_val_id = section_gcts[gct_key]

                gc_items.append(f"({gc_id}, {e_id}, {gct_val_id}, {score}, 10.0, FALSE)")
                gc_id += 1

    # Build stu_items now that GPA is computed
    for sid, rec in student_records.items():
        gpa_info = student_gpa_data[sid]
        if gpa_info["total_credits"] > 0:
            gpa_cum = round(gpa_info["total_points"] / gpa_info["total_credits"], 2)
            gpa_str = str(gpa_cum)
        else:
            gpa_str = "NULL"
            
        stu_items.append(
            f"({sid}, {rec['p_id']}, {rec['c_id']}, {escape_sql(rec['mssv'])}, "
            f"{escape_sql(rec['name'])}, {escape_sql(rec['gender'])}, {escape_sql(rec['class_code'])}, "
            f"'{rec['status']}', {gpa_str}, TRUE)"
        )

    print(f"Writing to {sql_path}...")
    os.makedirs(os.path.dirname(sql_path), exist_ok=True)

    batch_size = 1000

    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("-- Auto-generated seed data from crawled JSON\n")
        f.write("-- DO NOT EDIT MANUALLY\n\n")

        # Universities
        f.write("INSERT INTO universities (id, code, name, is_active) VALUES\n")
        f.write("(1, 'EPU', 'Đại học Điện Lực', TRUE)\n")
        f.write("ON CONFLICT DO NOTHING;\n\n")

        # Departments
        if dept_items:
            f.write("INSERT INTO departments (id, university_id, code, name, is_active) VALUES\n")
            f.write(",\n".join(dept_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Programs
        if prog_items:
            f.write("INSERT INTO programs (id, department_id, code, name, duration_years, is_active) VALUES\n")
            f.write(",\n".join(prog_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Cohorts
        if coh_items:
            f.write("INSERT INTO cohorts (id, code, year_start) VALUES\n")
            f.write(",\n".join(coh_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Semesters
        if sem_items:
            f.write("INSERT INTO semesters (id, code, name, year, term, is_current) VALUES\n")
            f.write(",\n".join(sem_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Courses
        if crs_items:
            f.write("INSERT INTO courses (id, code, name, credits, is_elective, is_active) VALUES\n")
            f.write(",\n".join(crs_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Program → Course links
        if program_courses:
            f.write("INSERT INTO program_courses (program_id, course_id) VALUES\n")
            f.write(",\n".join([f"({p}, {c})" for p, c in sorted(program_courses)]))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Students
        if stu_items:
            f.write(
                "INSERT INTO students"
                " (id, program_id, cohort_id, student_code, full_name, gender, class_code, status,"
                " gpa_cumulative, is_active)"
                " VALUES\n"
            )
            f.write(",\n".join(stu_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Sections
        for i in range(0, len(sec_items), batch_size):
            batch = sec_items[i : i + batch_size]
            f.write("INSERT INTO sections (id, course_id, semester_id, section_code, is_active) VALUES\n")
            f.write(",\n".join(batch))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Enrollments
        for i in range(0, len(enr_items), batch_size):
            batch = enr_items[i : i + batch_size]
            f.write(
                "INSERT INTO enrollments"
                " (id, student_id, section_id, final_grade, grade_letter, grade_4,"
                " is_passed, attempt_number, status)"
                " VALUES\n"
            )
            f.write(",\n".join(batch))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Grade component types
        for i in range(0, len(gct_items), batch_size):
            batch = gct_items[i : i + batch_size]
            f.write(
                "INSERT INTO grade_component_types"
                " (id, section_id, name, weight, max_score, is_required, sort_order)"
                " VALUES\n"
            )
            f.write(",\n".join(batch))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Grade components
        for i in range(0, len(gc_items), batch_size):
            batch = gc_items[i : i + batch_size]
            f.write(
                "INSERT INTO grade_components"
                " (id, enrollment_id, component_type_id, score, max_score, is_absent)"
                " VALUES\n"
            )
            f.write(",\n".join(batch))
            f.write("\nON CONFLICT DO NOTHING;\n\n")

        # Reset sequences
        f.write("-- Update sequences to prevent primary key conflicts on future inserts\n")
        for tbl in [
            "universities",
            "departments",
            "programs",
            "cohorts",
            "semesters",
            "courses",
            "students",
            "sections",
            "enrollments",
            "grade_component_types",
            "grade_components",
        ]:
            f.write(f"SELECT setval('{tbl}_id_seq', (SELECT MAX(id) FROM {tbl}));\n")

    stats = {
        "departments": len(dept_items),
        "programs": len(prog_items),
        "cohorts": len(coh_items),
        "semesters": len(sem_items),
        "courses": len(crs_items),
        "students": len(stu_items),
        "sections": len(sec_items),
        "enrollments": len(enr_items),
        "grade_component_types": len(gct_items),
        "grade_components": len(gc_items),
    }
    for name, count in stats.items():
        print(f"  {name}: {count:,}")
    print(f"Success! Generated {sql_path}")


if __name__ == "__main__":
    generate_sql()

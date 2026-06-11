import os
import sys
import json
import re
import unicodedata
from datetime import datetime

# Add the backend directory to sys.path so we can import from app
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend'))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

# Load the correct .env file
from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

from app.database import SessionLocal, engine
from app.models import (
    University, Department, Program, Semester, Course, Cohort, Student,
    Section, Enrollment, GradeComponentType, GradeComponent
)

def parse_cohort(class_code: str) -> str:
    if not class_code:
        return "Unknown"
    match = re.match(r'^(D\d+)', class_code)
    if match:
        return match.group(1)
    return "Unknown"

def parse_semester(semester_str: str) -> tuple[int, int]:
    # Example: "HK1 (2021-2022)" -> term=1, year=2021
    term, year = 1, 2021
    match = re.search(r'HK(\d)', semester_str, re.IGNORECASE)
    if match:
        term = int(match.group(1))
    match = re.search(r'(\d{4})-\d{4}', semester_str)
    if match:
        year = int(match.group(1))
    return term, year

def clean_course_code(name: str, class_code: str) -> str:
    if class_code and len(class_code) >= 6:
        # Keep first 10 digits as course code
        return class_code[:10]
    # Otherwise, clean course name to create a code
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    s = re.sub(r'[^a-zA-Z0-9\s]', '', s)
    words = s.upper().split()
    return "".join(w[:4] for w in words)[:20]

def get_or_create(session, model, defaults=None, **kwargs):
    instance = session.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    else:
        params = dict((k, v) for k, v in kwargs.items())
        params.update(defaults or {})
        instance = model(**params)
        session.add(instance)
        session.flush()
        return instance, True

def main():
    json_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../crawl/epu_data_batch.json'))
    if not os.path.exists(json_path):
        # Fallback to local epu_data.json
        json_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../epu_data.json'))
        if not os.path.exists(json_path):
            print(f"Error: Data file not found.")
            return

    print(f"Reading data from: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    db = SessionLocal()

    total_courses_imported = 0
    total_enrollments_imported = 0

    try:
        # Upsert EPU University
        epu, _ = get_or_create(db, University, defaults={"name": "Trường Đại học Điện Lực", "name_short": "EPU"}, code="EPU")
        
        for idx, record in enumerate(data, 1):
            student_info = record.get("student_info", {})
            grades = record.get("grades", [])
            
            mssv = student_info.get("MSSV")
            if not mssv:
                continue

            full_name = student_info.get("Họ và tên", "Unknown")
            gender = student_info.get("Giới tính", "Unknown")
            department_name = student_info.get("Khoa", "Unknown Khoa")
            program_name = student_info.get("Ngành", "Unknown Ngành")
            class_code = student_info.get("Lớp", "Unknown")
            
            cohort_code = parse_cohort(class_code)
            
            # Upsert Department
            dept, _ = get_or_create(db, Department, defaults={"name": department_name}, university_id=epu.id, code=department_name[:20])
            
            # Upsert Program
            prog, _ = get_or_create(db, Program, defaults={"name": program_name}, department_id=dept.id, code=program_name[:30])
            
            # Upsert Cohort
            cohort, _ = get_or_create(db, Cohort, defaults={"year_start": 2021}, code=cohort_code)
            
            # Upsert Student
            student, _ = get_or_create(db, Student, defaults={
                "program_id": prog.id,
                "cohort_id": cohort.id,
                "full_name": full_name,
                "gender": gender,
                "class_code": class_code
            }, student_code=mssv)
            
            # Process grades
            for course_data in grades:
                sem_str = course_data.get("Học kỳ", "")
                if not sem_str:
                    continue
                term, year = parse_semester(sem_str)
                sem_code = f"{year}-{term}"
                
                semester, _ = get_or_create(db, Semester, defaults={"name": sem_str, "year": year, "term": term}, code=sem_code)
                
                c_name = course_data.get("Tên môn học")
                if not c_name:
                    continue
                
                class_code_val = course_data.get("Mã lớp", "")
                c_code = clean_course_code(c_name, class_code_val)
                
                credits_str = course_data.get("TC", "0")
                try:
                    credits = int(float(credits_str))
                except ValueError:
                    credits = 0
                
                course, c_created = get_or_create(db, Course, defaults={"name": c_name, "credits": credits}, code=c_code)
                if c_created:
                    total_courses_imported += 1
                
                # Map course to program
                from sqlalchemy import text
                db.execute(
                    text("INSERT INTO program_courses (program_id, course_id) VALUES (:p, :c) ON CONFLICT DO NOTHING"),
                    {"p": prog.id, "c": course.id}
                )
                
                sect_code = (class_code_val if class_code_val else f"{c_code}-{sem_code}")[:50]
                section, _ = get_or_create(db, Section, defaults={}, course_id=course.id, semester_id=semester.id, section_code=sect_code)
                
                types = {
                    "TX1": 20.0,
                    "TX2": 20.0,
                    "Thi Lần 1": 60.0
                }
                type_objs = {}
                for t_idx, (t_name, t_weight) in enumerate(types.items()):
                    gct, _ = get_or_create(db, GradeComponentType, defaults={"weight": t_weight, "sort_order": t_idx}, section_id=section.id, name=t_name)
                    type_objs[t_name] = gct
                
                final_grade_str = course_data.get("Điểm tổng kết")
                final_grade = None
                if final_grade_str:
                    try:
                        final_grade = float(final_grade_str)
                    except ValueError:
                        pass
                
                grade_letter_raw = course_data.get("Xếp loại", "")
                grade_letter = ""
                letter_match = re.search(r'\[([A-DFa-df\+\-]+)', grade_letter_raw)
                if letter_match:
                    grade_letter = letter_match.group(1).strip()
                
                enrollment, e_created = get_or_create(db, Enrollment, defaults={
                    "final_grade": final_grade,
                    "grade_letter": grade_letter,
                    "status": "completed"
                }, student_id=student.id, section_id=section.id, attempt_number=1)
                if e_created:
                    total_enrollments_imported += 1
                
                # Grade Components
                for t_name, json_key in [("TX1", "TX1"), ("TX2", "TX2"), ("Thi Lần 1", "Kết thúc L1")]:
                    score_str = course_data.get(json_key)
                    score = None
                    if score_str:
                        try:
                            score = float(score_str)
                        except ValueError:
                            pass
                    
                    if score is not None:
                        get_or_create(db, GradeComponent, defaults={"score": score}, enrollment_id=enrollment.id, component_type_id=type_objs[t_name].id)
            
            if idx % 50 == 0:
                print(f"Processed {idx} students...")
                db.commit()

        db.commit()
        print(f"Success! Inserted/Updated {idx} students, {total_courses_imported} courses, and {total_enrollments_imported} enrollments in the database.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()

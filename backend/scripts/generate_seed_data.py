import json
import os
import re

def escape_sql(text):
    if text is None:
        return "NULL"
    text = str(text).replace("'", "''")
    return f"'{text}'"

def parse_float(text):
    if not text:
        return "NULL"
    try:
        return str(float(text))
    except ValueError:
        return "NULL"

def parse_semester_code(text):
    # e.g., "HK1 (2021-2022)" -> code: "2021-1", name: "HK1 (2021-2022)", year: 2021, term: 1
    # Check if format is matching
    match = re.search(r'HK(\d)\s*\((\d{4})-\d{4}\)', text)
    if match:
        term = int(match.group(1))
        year = int(match.group(2))
        return f"{year}-{term}", year, term
    return text, 2020, 1

def generate_sql():
    json_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../crawl/epu_data_batch.json'))
    sql_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../db/init-data.sql'))
    
    if not os.path.exists(json_path):
        print(f"File not found: {json_path}")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # In-memory structures to ensure uniqueness and generate IDs
    # Using 1-indexed integers for simplicity
    
    universities = {} # code -> id
    departments = {}  # name -> id
    programs = {}     # name -> id
    cohorts = {}      # code -> id
    semesters = {}    # code -> id
    courses = {}      # name -> id
    program_courses = set() # (program_id, course_id)
    students = {}     # mssv -> id
    sections = {}     # code -> id
    enrollments = set() # (student_id, section_id)
    
    uni_id = 1
    dept_id = 1
    prog_id = 1
    coh_id = 1
    sem_id = 1
    crs_id = 1
    stu_id = 1
    sec_id = 1

    # Initialize university
    universities['EPU'] = uni_id
    
    # Store items for writing
    dept_items = []
    prog_items = []
    coh_items = []
    sem_items = []
    crs_items = []
    stu_items = []
    sec_items = []
    enr_items = []
    
    print("Parsing JSON data...")
    for item in data:
        student_info = item.get("student_info", {})
        grades = item.get("grades", [])
        
        # Parse Department
        khoa = student_info.get("Khoa", "Chưa phân khoa")
        if khoa not in departments:
            departments[khoa] = dept_id
            # code format: generate from id for simplicity or acronym
            code = f"DEPT{dept_id:02d}"
            dept_items.append(f"({dept_id}, {uni_id}, {escape_sql(code)}, {escape_sql(khoa)})")
            dept_id += 1
            
        # Parse Program
        nganh = student_info.get("Ngành", "Chưa phân ngành")
        if nganh not in programs:
            programs[nganh] = prog_id
            code = f"PROG{prog_id:03d}"
            d_id = departments[khoa]
            prog_items.append(f"({prog_id}, {d_id}, {escape_sql(code)}, {escape_sql(nganh)})")
            prog_id += 1
            
        # Parse Cohort
        khoa_hoc = student_info.get("Khóa", "2021")
        if khoa_hoc not in cohorts:
            cohorts[khoa_hoc] = coh_id
            try:
                year_start = int(khoa_hoc)
            except:
                year_start = 2021
            code = f"K{str(year_start)[-2:]}" if len(str(year_start)) == 4 else f"K{khoa_hoc}"
            coh_items.append(f"({coh_id}, {escape_sql(code)}, {year_start})")
            coh_id += 1
            
        # Parse Student
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
            # Assume date_of_birth is null since we don't have it easily parseable sometimes
            stu_items.append(f"({stu_id}, {p_id}, {c_id}, {escape_sql(mssv)}, {escape_sql(name)}, {escape_sql(gender)}, {escape_sql(class_code)})")
            stu_id += 1
            
        s_id = students[mssv]
        
        for g in grades:
            hk_name = g.get("Học kỳ", "")
            course_name = g.get("Tên môn học", "")
            section_code = g.get("Mã lớp", "")
            credits_str = g.get("TC", "0")
            final_grade = g.get("Điểm tổng kết", "")
            grade_letter = g.get("Xếp loại", "").replace("[", "").replace("]", "").replace("-", "").strip()
            
            if not course_name or not section_code:
                continue
                
            # Parse Semester
            if hk_name not in semesters:
                code, year, term = parse_semester_code(hk_name)
                semesters[hk_name] = sem_id
                sem_items.append(f"({sem_id}, {escape_sql(code)}, {escape_sql(hk_name)}, {year}, {term})")
                sem_id += 1
                
            sm_id = semesters[hk_name]
            
            # Parse Course
            if course_name not in courses:
                courses[course_name] = crs_id
                c_code = f"CRS{crs_id:04d}"
                try:
                    tc = int(credits_str)
                except:
                    tc = 0
                crs_items.append(f"({crs_id}, {escape_sql(c_code)}, {escape_sql(course_name)}, {tc})")
                crs_id += 1
                
            cr_id = courses[course_name]
            
            # Link Program <-> Course
            p_id = programs[nganh]
            program_courses.add((p_id, cr_id))
            
            # Parse Section (Unique by section_code, course_id, semester_id)
            sec_key = f"{section_code}_{cr_id}_{sm_id}"
            if sec_key not in sections:
                sections[sec_key] = sec_id
                sec_items.append(f"({sec_id}, {cr_id}, {sm_id}, {escape_sql(section_code)})")
                sec_id += 1
                
            sc_id = sections[sec_key]
            
            # Parse Enrollment
            enr_key = (s_id, sc_id)
            if enr_key not in enrollments:
                enrollments.add(enr_key)
                f_grade = parse_float(final_grade)
                enr_items.append(f"({s_id}, {sc_id}, {f_grade}, {escape_sql(grade_letter)})")

    print(f"Writing to {sql_path}...")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(sql_path), exist_ok=True)
    
    with open(sql_path, 'w', encoding='utf-8') as f:
        f.write("-- Auto-generated seed data from crawled JSON\n")
        f.write("-- DO NOT EDIT MANUALLY\n\n")
        
        # Universities
        f.write("INSERT INTO universities (id, code, name) VALUES\n")
        f.write(f"(1, 'EPU', 'Đại học Điện Lực')\n")
        f.write("ON CONFLICT DO NOTHING;\n\n")
        
        # Departments
        if dept_items:
            f.write("INSERT INTO departments (id, university_id, code, name) VALUES\n")
            f.write(",\n".join(dept_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")
            
        # Programs
        if prog_items:
            f.write("INSERT INTO programs (id, department_id, code, name) VALUES\n")
            f.write(",\n".join(prog_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")
            
        # Cohorts
        if coh_items:
            f.write("INSERT INTO cohorts (id, code, year_start) VALUES\n")
            f.write(",\n".join(coh_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")
            
        # Semesters
        if sem_items:
            f.write("INSERT INTO semesters (id, code, name, year, term) VALUES\n")
            f.write(",\n".join(sem_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")
            
        # Courses
        if crs_items:
            f.write("INSERT INTO courses (id, code, name, credits) VALUES\n")
            f.write(",\n".join(crs_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")
            
        # Program Courses
        if program_courses:
            f.write("INSERT INTO program_courses (program_id, course_id) VALUES\n")
            f.write(",\n".join([f"({p}, {c})" for p, c in program_courses]))
            f.write("\nON CONFLICT DO NOTHING;\n\n")
            
        # Students
        if stu_items:
            # Batching to avoid huge statements
            f.write("INSERT INTO students (id, program_id, cohort_id, student_code, full_name, gender, class_code) VALUES\n")
            f.write(",\n".join(stu_items))
            f.write("\nON CONFLICT DO NOTHING;\n\n")
            
        # Sections
        if sec_items:
            batch_size = 1000
            for i in range(0, len(sec_items), batch_size):
                batch = sec_items[i:i+batch_size]
                f.write("INSERT INTO sections (id, course_id, semester_id, section_code) VALUES\n")
                f.write(",\n".join(batch))
                f.write("\nON CONFLICT DO NOTHING;\n\n")
                
        # Enrollments
        if enr_items:
            batch_size = 1000
            for i in range(0, len(enr_items), batch_size):
                batch = enr_items[i:i+batch_size]
                f.write("INSERT INTO enrollments (student_id, section_id, final_grade, grade_letter, status) VALUES\n")
                f.write(",\n".join([f"({row[1:row.rfind(')')]}, 'completed')" for row in batch]))
                f.write("\nON CONFLICT DO NOTHING;\n\n")
                
        # Fix sequences
        f.write("\n-- Update sequences to prevent primary key conflicts on future inserts\n")
        f.write("SELECT setval('universities_id_seq', (SELECT MAX(id) FROM universities));\n")
        f.write("SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));\n")
        f.write("SELECT setval('programs_id_seq', (SELECT MAX(id) FROM programs));\n")
        f.write("SELECT setval('cohorts_id_seq', (SELECT MAX(id) FROM cohorts));\n")
        f.write("SELECT setval('semesters_id_seq', (SELECT MAX(id) FROM semesters));\n")
        f.write("SELECT setval('courses_id_seq', (SELECT MAX(id) FROM courses));\n")
        f.write("SELECT setval('students_id_seq', (SELECT MAX(id) FROM students));\n")
        f.write("SELECT setval('sections_id_seq', (SELECT MAX(id) FROM sections));\n")
        f.write("SELECT setval('enrollments_id_seq', (SELECT MAX(id) FROM enrollments));\n")

    print("Success! Generated init-data.sql.")

if __name__ == "__main__":
    generate_sql()

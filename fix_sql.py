"""Fix H11 init-data.sql to match current schema (add missing NOT NULL columns)."""
import re

SRC = 'init_699_raw.sql'
DST = 'backend/db/init-data.sql'

with open(SRC, encoding='utf-8') as f:
    sql = f.read()

# ── 1. universities: add is_active=TRUE ─────────────────────────────────────
sql = sql.replace(
    'INSERT INTO universities (id, code, name) VALUES',
    'INSERT INTO universities (id, code, name, is_active) VALUES',
)
sql = re.sub(
    r"(\(\d+,\s*'[^']+',\s*'[^']+')\)",
    lambda m: m.group(1) + ', TRUE)',
    sql,
    flags=0,
)
# Guard: only the universities block is single-row like above — but regex is greedy.
# Better: do per-table replacement below instead.

# Reset and do per-table replacements more surgically
with open(SRC, encoding='utf-8') as f:
    sql = f.read()

def fix_block(sql, table, old_cols, new_cols, row_transform):
    """Replace INSERT header and transform each value row in a table block."""
    old_header = f'INSERT INTO {table} ({old_cols}) VALUES'
    new_header = f'INSERT INTO {table} ({new_cols}) VALUES'
    if old_header not in sql:
        print(f'  WARN: header not found for {table}')
        return sql

    # Find the full INSERT block (header + all rows until ON CONFLICT or next INSERT)
    pattern = re.compile(
        re.escape(old_header) + r'(.*?)(?=ON CONFLICT|INSERT INTO|\Z)',
        re.DOTALL,
    )
    def replace_block(m):
        rows_sql = m.group(1)
        # Transform each value tuple
        def transform_row(rm):
            return row_transform(rm.group(0))
        rows_sql = re.sub(r'\([^()]+\)', transform_row, rows_sql)
        return new_header + rows_sql

    result = pattern.sub(replace_block, sql, count=1)
    if result == sql:
        print(f'  WARN: no change for {table}')
    else:
        print(f'  OK: {table}')
    return result

# ── universities: (id, code, name) → add is_active ──────────────────────────
sql = sql.replace(
    'INSERT INTO universities (id, code, name) VALUES',
    'INSERT INTO universities (id, code, name, is_active) VALUES',
)
sql = re.sub(
    r"(INSERT INTO universities[^\n]+\n)((?:\([^;]+?\)[,;]\n?)*)",
    lambda m: m.group(0),  # handled by row transform below
    sql,
)
# Row-level: universities rows are like (1, 'EPU', 'Trường ...')
sql = re.sub(
    r"(?<=INSERT INTO universities \(id, code, name, is_active\) VALUES\n)((?:\(\d+, '[^']+', '[^']+'\)[,\n ]*)+)",
    lambda m: re.sub(r"(\(\d+, '[^']+', '[^']+')\)", r'\1, TRUE)', m.group(0)),
    sql,
)

# ── departments: (id, university_id, code, name) → add is_active ────────────
sql = sql.replace(
    'INSERT INTO departments (id, university_id, code, name) VALUES',
    'INSERT INTO departments (id, university_id, code, name, is_active) VALUES',
)
sql = re.sub(
    r"(\(\d+, \d+, '[^']+', '[^']+')\)",
    r'\1, TRUE)',
    sql,
)

# ── programs: (id, dept_id, code, name) → add duration_years, is_active ─────
# Note: departments regex already ran and turned programs rows from
# (int, int, 'str', 'str') → (int, int, 'str', 'str', TRUE)
# So match the 5-col version and insert duration_years=4 before the trailing TRUE
sql = sql.replace(
    'INSERT INTO programs (id, department_id, code, name) VALUES',
    'INSERT INTO programs (id, department_id, code, name, duration_years, is_active) VALUES',
)
# Find the programs block and fix rows within it
prog_start = sql.find('INSERT INTO programs (id, department_id, code, name, duration_years, is_active) VALUES')
prog_end = sql.find('INSERT INTO cohorts', prog_start)
if prog_start >= 0 and prog_end > prog_start:
    prog_block = sql[prog_start:prog_end]
    prog_fixed = re.sub(
        r"(\(\d+, \d+, '[^']+', '[^']+')\, TRUE\)",
        r'\1, 4, TRUE)',
        prog_block,
    )
    sql = sql[:prog_start] + prog_fixed + sql[prog_end:]

# ── semesters: (id, code, name, year, term) → add is_current ────────────────
sql = sql.replace(
    'INSERT INTO semesters (id, code, name, year, term) VALUES',
    'INSERT INTO semesters (id, code, name, year, term, is_current) VALUES',
)
sql = re.sub(
    r"(\(\d+, '[^']+', '[^']+', \d+, \d+)\)",
    r'\1, FALSE)',
    sql,
)

# ── courses: (id, code, name, credits) → add is_elective, is_active ─────────
sql = sql.replace(
    'INSERT INTO courses (id, code, name, credits) VALUES',
    'INSERT INTO courses (id, code, name, credits, is_elective, is_active) VALUES',
)
sql = re.sub(
    r"(\(\d+, '[^']+', '[^']+', \d+)\)",
    r'\1, FALSE, TRUE)',
    sql,
)

# ── sections: (id, course_id, semester_id, section_code) → add is_active ────
sql = sql.replace(
    'INSERT INTO sections (id, course_id, semester_id, section_code) VALUES',
    'INSERT INTO sections (id, course_id, semester_id, section_code, is_active) VALUES',
)
sql = re.sub(
    r"(\(\d+, \d+, \d+, '[^']+')\)",
    r'\1, TRUE)',
    sql,
)

# ── students: add status, is_active ─────────────────────────────────────────
sql = sql.replace(
    'INSERT INTO students (id, program_id, cohort_id, student_code, full_name, gender, class_code) VALUES',
    'INSERT INTO students (id, program_id, cohort_id, student_code, full_name, gender, class_code, status, is_active) VALUES',
)
sql = re.sub(
    r"(\(\d+, \d+, \d+, '[^']+', '[^']+', '[^']+', '[^']+')\)",
    r"\1, 'active', TRUE)",
    sql,
)

# ── enrollments: add id, is_passed, attempt_number ──────────────────────────
# Old: (student_id, section_id, final_grade, grade_letter, status)
# New: (id, student_id, section_id, final_grade, grade_letter, is_passed, attempt_number, status)
sql = sql.replace(
    'INSERT INTO enrollments (student_id, section_id, final_grade, grade_letter, status) VALUES',
    'INSERT INTO enrollments (id, student_id, section_id, final_grade, grade_letter, is_passed, attempt_number, status) VALUES',
)

enroll_counter = [0]
def fix_enrollment(m):
    row = m.group(0)
    # Parse: (student_id, section_id, final_grade_or_NULL, grade_letter, status)
    inner = re.match(
        r"\((\d+), (\d+), ([^,]+), '([^']*)', '([^']*)'\)",
        row.strip()
    )
    if not inner:
        return row
    student_id, section_id, grade_raw, grade_letter, status = inner.groups()
    enroll_counter[0] += 1
    eid = enroll_counter[0]
    try:
        grade_val = float(grade_raw)
        is_passed = 'TRUE' if grade_val >= 5.0 else 'FALSE'
        grade_sql = str(grade_val)
    except (ValueError, TypeError):
        is_passed = 'NULL'
        grade_sql = 'NULL'
    # Clean grade letter (remove trailing spaces/brackets like "[A  - ]")
    gl = re.sub(r'\s+', '', grade_letter).strip()
    if not gl or gl in ('', '-', 'NULL'):
        gl = ''
    return f"({eid}, {student_id}, {section_id}, {grade_sql}, '{gl}', {is_passed}, 1, '{status}')"

# Apply only within the enrollments block
enroll_block_pat = re.compile(
    r'(INSERT INTO enrollments \([^)]+\) VALUES\n)(.*?)(?=ON CONFLICT|INSERT INTO|\Z)',
    re.DOTALL
)
def replace_enroll_block(m):
    header = m.group(1)
    rows_sql = re.sub(r'\([^\(\)]+\)', fix_enrollment, m.group(2))
    return header + rows_sql

sql = enroll_block_pat.sub(replace_enroll_block, sql)

# ── Sequence resets ──────────────────────────────────────────────────────────
if 'SELECT setval' not in sql:
    sql += """
-- Update sequences
SELECT setval('universities_id_seq', (SELECT MAX(id) FROM universities));
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
SELECT setval('programs_id_seq', (SELECT MAX(id) FROM programs));
SELECT setval('cohorts_id_seq', (SELECT MAX(id) FROM cohorts));
SELECT setval('semesters_id_seq', (SELECT MAX(id) FROM semesters));
SELECT setval('courses_id_seq', (SELECT MAX(id) FROM courses));
SELECT setval('students_id_seq', (SELECT MAX(id) FROM students));
SELECT setval('sections_id_seq', (SELECT MAX(id) FROM sections));
SELECT setval('enrollments_id_seq', (SELECT MAX(id) FROM enrollments));
"""

with open(DST, 'w', encoding='utf-8') as f:
    f.write(sql)

print(f'\nDone -> {DST}')
print('Verify tables:')
for t in ['universities','departments','programs','semesters','courses','students','sections','enrollments']:
    lines = [l for l in sql.splitlines() if l.startswith('INSERT INTO ' + t)]
    print(f'  {t}: {"found" if lines else "MISSING"} — header: {lines[0][:100] if lines else ""}')

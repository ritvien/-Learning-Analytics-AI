from app.models.academic import Course, Department, Program, Semester, University
from app.models.people import Cohort, Student, Teacher
from app.models.teaching import Enrollment, Section
from scripts.seed_users import _assign_sections_to_teacher


async def test_assign_sections_to_teacher_does_not_stop_at_existing_empty_section(db_session):
    university = University(code="SEED-U", name="Seed University")
    db_session.add(university)
    await db_session.flush()

    department = Department(university_id=university.id, code="SEED-D", name="Seed Department")
    db_session.add(department)
    await db_session.flush()

    program = Program(department_id=department.id, code="SEED-P", name="Seed Program")
    course = Course(department_id=department.id, code="SEED-C", name="Seed Course", credits=3)
    cohort = Cohort(code="KSEED", year_start=2026)
    semester = Semester(code="SEED-2026", name="Seed Semester", year=2026, term=1)
    teacher = Teacher(department_id=department.id, code="SEED-T", full_name="Seed Teacher")
    db_session.add_all([program, course, cohort, semester, teacher])
    await db_session.flush()

    empty_section = Section(
        course_id=course.id,
        semester_id=semester.id,
        section_code="EMPTY",
        teacher_id=teacher.id,
    )
    section_with_grades = Section(course_id=course.id, semester_id=semester.id, section_code="GRADED")
    db_session.add_all([empty_section, section_with_grades])
    await db_session.flush()

    student = Student(
        program_id=program.id,
        cohort_id=cohort.id,
        student_code="SEED-S1",
        full_name="Seed Student",
    )
    db_session.add(student)
    await db_session.flush()

    db_session.add(
        Enrollment(
            student_id=student.id,
            section_id=section_with_grades.id,
            final_grade=8.0,
            is_passed=True,
            status="completed",
            registered_credits=3,
        )
    )
    await db_session.flush()

    assigned_sections = await _assign_sections_to_teacher(db_session, teacher, limit=1)

    assert assigned_sections == [section_with_grades]
    assert section_with_grades.teacher_id == teacher.id
    assert empty_section.teacher_id == teacher.id

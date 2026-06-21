"""CRUD operations for academic entities."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import create_obj, get_by_id, hard_delete_obj, list_scalars, soft_delete_obj, update_obj
from app.models.academic import Course, Department, Program, Semester, Specialization, program_courses


async def list_departments(db: AsyncSession, skip: int, limit: int) -> list[Department]:
    """Return active departments."""
    return await list_scalars(db, select(Department).where(Department.is_active == True), skip, limit)  # noqa: E712


async def get_department(db: AsyncSession, department_id: int) -> Department | None:
    """Return one department."""
    return await get_by_id(db, Department, department_id)


async def create_department(db: AsyncSession, data: dict) -> Department:
    """Create a department."""
    return await create_obj(db, Department, data)


async def update_department(db: AsyncSession, department: Department, data: dict) -> Department:
    """Update a department."""
    return await update_obj(db, department, data)


async def delete_department(db: AsyncSession, department: Department) -> None:
    """Soft-delete a department."""
    await soft_delete_obj(db, department)


async def list_programs(db: AsyncSession, skip: int, limit: int, department_id: int | None = None) -> list[Program]:
    """Return active programs."""
    q = select(Program).where(Program.is_active == True)  # noqa: E712
    if department_id is not None:
        q = q.where(Program.department_id == department_id)
    return await list_scalars(db, q, skip, limit)


async def get_program(db: AsyncSession, program_id: int) -> Program | None:
    """Return one program."""
    return await get_by_id(db, Program, program_id)


async def create_program(db: AsyncSession, data: dict) -> Program:
    """Create a program with its default unassigned specialization."""
    program = await create_obj(db, Program, data)
    db.add(
        Specialization(
            program_id=program.id,
            code="UNASSIGNED",
            name="Chưa phân loại",
            is_placeholder=True,
        )
    )
    await db.flush()
    return program


async def update_program(db: AsyncSession, program: Program, data: dict) -> Program:
    """Update a program."""
    return await update_obj(db, program, data)


async def delete_program(db: AsyncSession, program: Program) -> None:
    """Soft-delete a program."""
    await soft_delete_obj(db, program)


async def list_specializations(
    db: AsyncSession,
    skip: int,
    limit: int,
    program_id: int | None = None,
) -> list[Specialization]:
    """Return active specializations with courses loaded."""
    q = select(Specialization).options(selectinload(Specialization.courses)).where(Specialization.is_active == True)  # noqa: E712
    if program_id is not None:
        q = q.where(Specialization.program_id == program_id)
    result = await db.execute(q.offset(skip).limit(limit))
    return list(result.unique().scalars().all())


async def get_specialization(db: AsyncSession, specialization_id: int) -> Specialization | None:
    """Return one specialization with courses loaded."""
    result = await db.execute(
        select(Specialization)
        .options(selectinload(Specialization.courses))
        .where(Specialization.id == specialization_id)
    )
    return result.unique().scalar_one_or_none()


async def get_courses_by_ids(db: AsyncSession, course_ids: list[int]) -> list[Course]:
    """Return courses and their program mappings for validation."""
    if not course_ids:
        return []
    result = await db.execute(
        select(Course).options(selectinload(Course.programs)).where(Course.id.in_(course_ids))
    )
    return list(result.unique().scalars().all())


async def create_specialization(
    db: AsyncSession,
    data: dict,
    courses: list[Course],
) -> Specialization:
    """Create a specialization and attach courses."""
    obj = Specialization(**data, courses=courses)
    db.add(obj)
    await db.flush()
    await db.refresh(obj, attribute_names=["courses"])
    return obj


async def update_specialization(
    db: AsyncSession,
    specialization: Specialization,
    data: dict,
    courses: list[Course] | None = None,
) -> Specialization:
    """Update a specialization and optionally replace its courses."""
    for field, value in data.items():
        setattr(specialization, field, value)
    if courses is not None:
        specialization.courses = courses
    await db.flush()
    await db.refresh(specialization)
    await db.refresh(specialization, attribute_names=["courses"])
    return specialization


async def delete_specialization(db: AsyncSession, specialization: Specialization) -> None:
    """Soft-delete a specialization."""
    await soft_delete_obj(db, specialization)


async def list_courses(db: AsyncSession, skip: int, limit: int, program_id: int | None = None) -> list[Course]:
    """Return active courses, optionally by program."""
    q = select(Course).options(selectinload(Course.programs)).where(Course.is_active == True)  # noqa: E712
    if program_id is not None:
        q = q.join(program_courses).where(program_courses.c.program_id == program_id)
    return await list_scalars(db, q, skip, limit)


async def get_course(db: AsyncSession, course_id: int) -> Course | None:
    """Return one course with programs loaded."""
    result = await db.execute(select(Course).options(selectinload(Course.programs)).where(Course.id == course_id))
    return result.scalar_one_or_none()


async def get_programs_by_ids(db: AsyncSession, program_ids: list[int]) -> list[Program]:
    """Return programs for the given IDs."""
    return list((await db.execute(select(Program).where(Program.id.in_(program_ids)))).scalars().all())


async def create_course(db: AsyncSession, data: dict, programs: list[Program]) -> Course:
    """Create a course and attach programs."""
    obj = Course(**data, programs=programs)
    db.add(obj)
    await db.flush()
    if programs:
        result = await db.execute(
            select(Specialization)
            .options(selectinload(Specialization.courses))
            .where(
                Specialization.program_id.in_([program.id for program in programs]),
                Specialization.is_placeholder == True,  # noqa: E712
            )
        )
        for specialization in result.unique().scalars().all():
            if obj not in specialization.courses:
                specialization.courses.append(obj)
        await db.flush()
    await db.refresh(obj, attribute_names=["programs"])
    return obj


async def update_course(db: AsyncSession, course: Course, data: dict, programs: list[Program] | None = None) -> Course:
    """Update a course and optionally replace programs."""
    for field, value in data.items():
        setattr(course, field, value)
    if programs is not None:
        previous_program_ids = {program.id for program in course.programs}
        target_program_ids = {program.id for program in programs}
        course.programs = programs
        affected_program_ids = previous_program_ids | target_program_ids
        if affected_program_ids:
            result = await db.execute(
                select(Specialization)
                .options(selectinload(Specialization.courses))
                .where(Specialization.program_id.in_(affected_program_ids))
            )
            for specialization in result.unique().scalars().all():
                should_include = specialization.program_id in target_program_ids and specialization.is_placeholder
                if should_include and course not in specialization.courses:
                    specialization.courses.append(course)
                elif specialization.program_id not in target_program_ids and course in specialization.courses:
                    specialization.courses.remove(course)
    await db.flush()
    await db.refresh(course, attribute_names=["programs"])
    return course


async def delete_course(db: AsyncSession, course: Course) -> None:
    """Soft-delete a course."""
    await soft_delete_obj(db, course)


async def list_semesters(db: AsyncSession, skip: int, limit: int) -> list[Semester]:
    """Return semesters ordered newest first."""
    return await list_scalars(db, select(Semester).order_by(Semester.year.desc(), Semester.term.desc()), skip, limit)


async def get_current_semester(db: AsyncSession) -> Semester | None:
    """Return the current semester."""
    result = await db.execute(select(Semester).where(Semester.is_current == True))  # noqa: E712
    return result.scalar_one_or_none()


async def get_semester(db: AsyncSession, semester_id: int) -> Semester | None:
    """Return one semester."""
    return await get_by_id(db, Semester, semester_id)


async def clear_current_semester(db: AsyncSession) -> None:
    """Unset the current flag on all semesters."""
    result = await db.execute(select(Semester).where(Semester.is_current == True))  # noqa: E712
    for existing in result.scalars().all():
        existing.is_current = False


async def create_semester(db: AsyncSession, data: dict) -> Semester:
    """Create a semester."""
    return await create_obj(db, Semester, data)


async def update_semester(db: AsyncSession, semester: Semester, data: dict) -> Semester:
    """Update a semester."""
    return await update_obj(db, semester, data)


async def delete_semester(db: AsyncSession, semester: Semester) -> None:
    """Hard-delete a semester."""
    await hard_delete_obj(db, semester)

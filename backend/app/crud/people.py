"""CRUD operations for people entities."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import create_obj, get_by_id, hard_delete_obj, list_scalars, soft_delete_obj, update_obj
from app.models.people import Cohort, Student, Teacher


async def list_cohorts(db: AsyncSession, skip: int, limit: int) -> list[Cohort]:
    """Return cohorts ordered newest first."""
    return await list_scalars(db, select(Cohort).order_by(Cohort.year_start.desc()), skip, limit)


async def get_cohort(db: AsyncSession, cohort_id: int) -> Cohort | None:
    """Return one cohort."""
    return await get_by_id(db, Cohort, cohort_id)


async def create_cohort(db: AsyncSession, data: dict) -> Cohort:
    """Create a cohort."""
    return await create_obj(db, Cohort, data)


async def update_cohort(db: AsyncSession, cohort: Cohort, data: dict) -> Cohort:
    """Update a cohort."""
    return await update_obj(db, cohort, data)


async def delete_cohort(db: AsyncSession, cohort: Cohort) -> None:
    """Hard-delete a cohort."""
    await hard_delete_obj(db, cohort)


async def list_students(
    db: AsyncSession,
    skip: int,
    limit: int,
    program_id: int | None = None,
    cohort_id: int | None = None,
) -> list[Student]:
    """Return active students with optional filters."""
    q = select(Student).where(Student.is_active == True)  # noqa: E712
    if program_id is not None:
        q = q.where(Student.program_id == program_id)
    if cohort_id is not None:
        q = q.where(Student.cohort_id == cohort_id)
    return await list_scalars(db, q, skip, limit)


async def get_student(db: AsyncSession, student_id: int) -> Student | None:
    """Return one student."""
    return await get_by_id(db, Student, student_id)


async def create_student(db: AsyncSession, data: dict) -> Student:
    """Create a student."""
    return await create_obj(db, Student, data)


async def update_student(db: AsyncSession, student: Student, data: dict) -> Student:
    """Update a student."""
    return await update_obj(db, student, data)


async def delete_student(db: AsyncSession, student: Student) -> None:
    """Soft-delete a student."""
    await soft_delete_obj(db, student)


async def list_teachers(db: AsyncSession, skip: int, limit: int, department_id: int | None = None) -> list[Teacher]:
    """Return active teachers with optional department filter."""
    q = select(Teacher).where(Teacher.is_active == True)  # noqa: E712
    if department_id is not None:
        q = q.where(Teacher.department_id == department_id)
    return await list_scalars(db, q, skip, limit)


async def get_teacher(db: AsyncSession, teacher_id: int) -> Teacher | None:
    """Return one teacher."""
    return await get_by_id(db, Teacher, teacher_id)


async def create_teacher(db: AsyncSession, data: dict) -> Teacher:
    """Create a teacher."""
    return await create_obj(db, Teacher, data)


async def update_teacher(db: AsyncSession, teacher: Teacher, data: dict) -> Teacher:
    """Update a teacher."""
    return await update_obj(db, teacher, data)


async def delete_teacher(db: AsyncSession, teacher: Teacher) -> None:
    """Soft-delete a teacher."""
    await soft_delete_obj(db, teacher)

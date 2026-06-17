"""CRUD operations for teaching and grade entities."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import create_obj, get_by_id, list_scalars, soft_delete_obj, update_obj
from app.models.teaching import Enrollment, GradeComponent, Section


async def list_sections(
    db: AsyncSession,
    skip: int,
    limit: int,
    course_id: int | None = None,
    semester_id: int | None = None,
    teacher_id: int | None = None,
) -> list[Section]:
    """Return active sections with optional filters."""
    q = select(Section).where(Section.is_active == True)  # noqa: E712
    if course_id is not None:
        q = q.where(Section.course_id == course_id)
    if semester_id is not None:
        q = q.where(Section.semester_id == semester_id)
    if teacher_id is not None:
        q = q.where(Section.teacher_id == teacher_id)
    return await list_scalars(db, q, skip, limit)


async def get_section(db: AsyncSession, section_id: int) -> Section | None:
    """Return one section."""
    return await get_by_id(db, Section, section_id)


async def create_section(db: AsyncSession, data: dict) -> Section:
    """Create a section."""
    return await create_obj(db, Section, data)


async def update_section(db: AsyncSession, section: Section, data: dict) -> Section:
    """Update a section."""
    return await update_obj(db, section, data)


async def delete_section(db: AsyncSession, section: Section) -> None:
    """Soft-delete a section."""
    await soft_delete_obj(db, section)


async def list_enrollments(
    db: AsyncSession,
    skip: int,
    limit: int,
    section_id: int | None = None,
    student_id: int | None = None,
) -> list[Enrollment]:
    """Return enrollments with optional filters."""
    q = select(Enrollment)
    if section_id is not None:
        q = q.where(Enrollment.section_id == section_id)
    if student_id is not None:
        q = q.where(Enrollment.student_id == student_id)
    return await list_scalars(db, q, skip, limit)


async def create_enrollment(db: AsyncSession, data: dict) -> Enrollment:
    """Create an enrollment."""
    return await create_obj(db, Enrollment, data)


async def get_enrollment(db: AsyncSession, enrollment_id: int) -> Enrollment | None:
    """Return one enrollment."""
    return await get_by_id(db, Enrollment, enrollment_id)


async def update_enrollment(db: AsyncSession, enrollment: Enrollment, data: dict) -> Enrollment:
    """Update an enrollment."""
    return await update_obj(db, enrollment, data)


async def get_grade_component(
    db: AsyncSession,
    enrollment_id: int,
    component_type_id: int,
) -> GradeComponent | None:
    """Return one grade component by enrollment and component type."""
    result = await db.execute(
        select(GradeComponent).where(
            GradeComponent.enrollment_id == enrollment_id,
            GradeComponent.component_type_id == component_type_id,
        )
    )
    return result.scalar_one_or_none()


async def create_grade_component(db: AsyncSession, data: dict) -> GradeComponent:
    """Create a grade component."""
    return await create_obj(db, GradeComponent, data)


async def update_grade_component(db: AsyncSession, component: GradeComponent, data: dict) -> GradeComponent:
    """Update a grade component."""
    return await update_obj(db, component, data)

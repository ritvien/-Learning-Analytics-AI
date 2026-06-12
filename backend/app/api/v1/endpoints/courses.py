"""CRUD endpoints for Course (Môn học)."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.dependencies import DBSession, PaginationDep
from app.models.academic import Course, Program, program_courses
from app.schemas.academic import CourseCreate, CourseResponse, CourseUpdate

router = APIRouter()


@router.get("", response_model=list[CourseResponse])
async def list_courses(
    db: DBSession,
    pagination: PaginationDep,
    program_id: int | None = None,
) -> list[Course]:
    """Return courses, optionally filtered by program."""
    q = select(Course).options(selectinload(Course.programs)).where(Course.is_active == True)  # noqa: E712
    if program_id is not None:
        q = q.join(program_courses).where(program_courses.c.program_id == program_id)
    result = await db.execute(q.offset(pagination.skip).limit(pagination.limit))
    return list(result.scalars().all())


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: int, db: DBSession) -> Course:
    """Retrieve a course by ID."""
    obj = (
        await db.execute(select(Course).options(selectinload(Course.programs)).where(Course.id == course_id))
    ).scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return obj


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(payload: CourseCreate, db: DBSession) -> Course:
    """Create a new course."""
    data = payload.model_dump(exclude={"program_ids"})
    programs = list((await db.execute(select(Program).where(Program.id.in_(payload.program_ids)))).scalars().all())
    if len(programs) != len(set(payload.program_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more programs were not found")
    obj = Course(**data, programs=programs)
    db.add(obj)
    await db.flush()
    await db.refresh(obj, attribute_names=["programs"])
    return obj


@router.patch("/{course_id}", response_model=CourseResponse)
async def update_course(course_id: int, payload: CourseUpdate, db: DBSession) -> Course:
    """Apply a partial update to a course."""
    obj = (
        await db.execute(select(Course).options(selectinload(Course.programs)).where(Course.id == course_id))
    ).scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    data = payload.model_dump(exclude_unset=True, exclude={"program_ids"})
    for field, value in data.items():
        setattr(obj, field, value)
    if payload.program_ids is not None:
        programs = list((await db.execute(select(Program).where(Program.id.in_(payload.program_ids)))).scalars().all())
        if len(programs) != len(set(payload.program_ids)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more programs were not found")
        obj.programs = programs
    await db.flush()
    await db.refresh(obj, attribute_names=["programs"])
    return obj


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(course_id: int, db: DBSession) -> None:
    """Soft-delete a course."""
    obj = await db.get(Course, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    obj.is_active = False

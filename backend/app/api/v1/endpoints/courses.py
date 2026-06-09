"""CRUD endpoints for Course (Môn học)."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DBSession, PaginationDep
from app.models.academic import Course
from app.schemas.academic import CourseCreate, CourseResponse, CourseUpdate

router = APIRouter()


@router.get("", response_model=list[CourseResponse])
async def list_courses(
    db: DBSession,
    pagination: PaginationDep,
    program_id: int | None = None,
) -> list[Course]:
    """Return courses, optionally filtered by program."""
    q = select(Course).where(Course.is_active == True)  # noqa: E712
    if program_id is not None:
        q = q.where(Course.program_id == program_id)
    result = await db.execute(q.offset(pagination.skip).limit(pagination.limit))
    return list(result.scalars().all())


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: int, db: DBSession) -> Course:
    obj = await db.get(Course, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return obj


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(payload: CourseCreate, db: DBSession) -> Course:
    obj = Course(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/{course_id}", response_model=CourseResponse)
async def update_course(course_id: int, payload: CourseUpdate, db: DBSession) -> Course:
    obj = await db.get(Course, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(course_id: int, db: DBSession) -> None:
    obj = await db.get(Course, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    obj.is_active = False

"""CRUD endpoints for Course (Môn học)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.crud import academic as crud
from app.dependencies import DBSession, PaginationDep, require_write_access
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
    return await crud.list_courses(db, pagination.skip, pagination.limit, program_id)


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: int, db: DBSession) -> Course:
    """Retrieve a course by ID."""
    obj = await crud.get_course(db, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return obj


@router.post(
    "",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_course(payload: CourseCreate, db: DBSession) -> Course:
    """Create a new course."""
    data = payload.model_dump(exclude={"program_ids"})
    programs = await crud.get_programs_by_ids(db, payload.program_ids)
    if len(programs) != len(set(payload.program_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more programs were not found")
    return await crud.create_course(db, data, programs)


@router.patch("/{course_id}", response_model=CourseResponse, dependencies=[Depends(require_write_access)])
async def update_course(course_id: int, payload: CourseUpdate, db: DBSession) -> Course:
    """Apply a partial update to a course."""
    obj = await crud.get_course(db, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    data = payload.model_dump(exclude_unset=True, exclude={"program_ids"})
    if payload.program_ids is not None:
        programs = await crud.get_programs_by_ids(db, payload.program_ids)
        if len(programs) != len(set(payload.program_ids)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more programs were not found")
    else:
        programs = None
    return await crud.update_course(db, obj, data, programs)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_course(course_id: int, db: DBSession) -> None:
    """Soft-delete a course."""
    obj = await crud.get_course(db, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    await crud.delete_course(db, obj)

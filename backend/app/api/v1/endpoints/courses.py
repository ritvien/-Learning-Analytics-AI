"""CRUD endpoints for Course (Môn học)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.access_control import can_access_course, is_admin, require_department_scope
from app.crud import academic as crud
from app.dependencies import CurrentUser, DBSession, PaginationDep, require_write_access
from app.models.academic import Course, Program, program_courses
from app.schemas.academic import CourseCreate, CourseResponse, CourseUpdate

router = APIRouter()


@router.get("", response_model=list[CourseResponse])
async def list_courses(
    db: DBSession,
    pagination: PaginationDep,
    current_user: CurrentUser,
    program_id: int | None = None,
) -> list[Course]:
    """Return courses, optionally filtered by program."""
    if not is_admin(current_user):
        q = select(Course).options(selectinload(Course.programs)).where(Course.is_active == True).distinct()  # noqa: E712
        if program_id is not None:
            q = q.join(program_courses).where(program_courses.c.program_id == program_id)
        department_ids = await require_department_scope(db, current_user)
        q = q.outerjoin(program_courses, program_courses.c.course_id == Course.id).outerjoin(
            Program, Program.id == program_courses.c.program_id
        )
        scope_clauses = [
            Course.department_id.in_(department_ids),
            Program.department_id.in_(department_ids),
        ]
        q = q.where(or_(*scope_clauses)).offset(pagination.skip).limit(pagination.limit)
        return list((await db.execute(q)).scalars().all())
    return await crud.list_courses(db, pagination.skip, pagination.limit, program_id)


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: int, db: DBSession, current_user: CurrentUser) -> Course:
    """Retrieve a course by ID."""
    obj = await crud.get_course(db, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if not await can_access_course(db, current_user, course_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return obj


@router.post(
    "",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_course(payload: CourseCreate, db: DBSession, current_user: CurrentUser) -> Course:
    """Create a new course."""
    data = payload.model_dump(exclude={"program_ids"})
    programs = await crud.get_programs_by_ids(db, payload.program_ids)
    if len(programs) != len(set(payload.program_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more programs were not found")
    if not is_admin(current_user):
        department_ids = await require_department_scope(db, current_user)
        if any(program.department_id not in department_ids for program in programs):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course scope is outside your permissions")
        if payload.department_id is not None and payload.department_id not in department_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course scope is outside your permissions")
    return await crud.create_course(db, data, programs)


@router.patch("/{course_id}", response_model=CourseResponse, dependencies=[Depends(require_write_access)])
async def update_course(course_id: int, payload: CourseUpdate, db: DBSession, current_user: CurrentUser) -> Course:
    """Apply a partial update to a course."""
    obj = await crud.get_course(db, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if not await can_access_course(db, current_user, course_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course scope is outside your permissions")
    data = payload.model_dump(exclude_unset=True, exclude={"program_ids"})
    if payload.program_ids is not None:
        programs = await crud.get_programs_by_ids(db, payload.program_ids)
        if len(programs) != len(set(payload.program_ids)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more programs were not found")
        if not is_admin(current_user):
            department_ids = await require_department_scope(db, current_user)
            if any(program.department_id not in department_ids for program in programs):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Course scope is outside your permissions",
                )
    else:
        programs = None
    return await crud.update_course(db, obj, data, programs)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_course(course_id: int, db: DBSession, current_user: CurrentUser) -> None:
    """Soft-delete a course."""
    obj = await crud.get_course(db, course_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if not await can_access_course(db, current_user, course_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course scope is outside your permissions")
    await crud.delete_course(db, obj)

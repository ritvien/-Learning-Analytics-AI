"""CRUD endpoints for Specialization (Chuyên ngành)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.access_control import can_access_program, can_access_specialization, is_admin, require_department_scope
from app.crud import academic as crud
from app.dependencies import CurrentUser, DBSession, PaginationDep, require_write_access
from app.models.academic import Course, Program, Specialization
from app.schemas.academic import SpecializationCreate, SpecializationResponse, SpecializationUpdate

router = APIRouter()


def _validate_course_program(program_id: int, courses: list[Course]) -> None:
    invalid = [course.id for course in courses if program_id not in {program.id for program in course.programs}]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Courses are not mapped to parent program: {invalid}",
        )


@router.get("", response_model=list[SpecializationResponse])
async def list_specializations(
    db: DBSession,
    pagination: PaginationDep,
    current_user: CurrentUser,
    program_id: int | None = None,
) -> list[Specialization]:
    """Return specializations, optionally filtered by Program."""
    if is_admin(current_user):
        return await crud.list_specializations(db, pagination.skip, pagination.limit, program_id)

    department_ids = await require_department_scope(db, current_user)
    query = (
        select(Specialization)
        .join(Program, Program.id == Specialization.program_id)
        .options(selectinload(Specialization.courses))
        .where(Specialization.is_active == True, Program.department_id.in_(department_ids))  # noqa: E712
    )
    if program_id is not None:
        query = query.where(Specialization.program_id == program_id)
    result = await db.execute(query.offset(pagination.skip).limit(pagination.limit))
    return list(result.unique().scalars().all())


@router.get("/{specialization_id}", response_model=SpecializationResponse)
async def get_specialization(
    specialization_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> Specialization:
    """Retrieve a specialization by ID."""
    obj = await crud.get_specialization(db, specialization_id)
    if obj is None or not await can_access_specialization(db, current_user, specialization_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specialization not found")
    return obj


@router.post(
    "",
    response_model=SpecializationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_specialization(
    payload: SpecializationCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> Specialization:
    """Create a specialization under an accessible Program."""
    program = await crud.get_program(db, payload.program_id)
    if program is None or not await can_access_program(db, current_user, payload.program_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    courses = await crud.get_courses_by_ids(db, payload.course_ids)
    if len(courses) != len(set(payload.course_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more courses were not found")
    _validate_course_program(program.id, courses)
    return await crud.create_specialization(
        db,
        payload.model_dump(exclude={"course_ids"}),
        courses,
    )


@router.patch(
    "/{specialization_id}",
    response_model=SpecializationResponse,
    dependencies=[Depends(require_write_access)],
)
async def update_specialization(
    specialization_id: int,
    payload: SpecializationUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> Specialization:
    """Apply a partial update to a specialization."""
    obj = await crud.get_specialization(db, specialization_id)
    if obj is None or not await can_access_specialization(db, current_user, specialization_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specialization not found")
    data = payload.model_dump(exclude_unset=True, exclude={"course_ids"})
    courses = None
    if payload.course_ids is not None:
        courses = await crud.get_courses_by_ids(db, payload.course_ids)
        if len(courses) != len(set(payload.course_ids)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more courses were not found")
        _validate_course_program(obj.program_id, courses)
    return await crud.update_specialization(db, obj, data, courses)


@router.delete(
    "/{specialization_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_write_access)],
)
async def delete_specialization(
    specialization_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> None:
    """Soft-delete a specialization."""
    obj = await crud.get_specialization(db, specialization_id)
    if obj is None or not await can_access_specialization(db, current_user, specialization_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specialization not found")
    await crud.delete_specialization(db, obj)

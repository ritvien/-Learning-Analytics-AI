"""CRUD endpoints for Teacher (Giảng viên)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.crud import people as crud
from app.dependencies import DBSession, PaginationDep, require_write_access
from app.models.people import Teacher
from app.schemas.people import TeacherCreate, TeacherResponse, TeacherUpdate

router = APIRouter()


@router.get("", response_model=list[TeacherResponse])
async def list_teachers(
    db: DBSession,
    pagination: PaginationDep,
    department_id: int | None = None,
) -> list[Teacher]:
    """Return teachers, optionally filtered by department."""
    return await crud.list_teachers(db, pagination.skip, pagination.limit, department_id)


@router.get("/{teacher_id}", response_model=TeacherResponse)
async def get_teacher(teacher_id: int, db: DBSession) -> Teacher:
    """Retrieve a teacher by ID."""
    obj = await crud.get_teacher(db, teacher_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    return obj


@router.post(
    "",
    response_model=TeacherResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_teacher(payload: TeacherCreate, db: DBSession) -> Teacher:
    """Create a new teacher."""
    return await crud.create_teacher(db, payload.model_dump())


@router.patch("/{teacher_id}", response_model=TeacherResponse, dependencies=[Depends(require_write_access)])
async def update_teacher(teacher_id: int, payload: TeacherUpdate, db: DBSession) -> Teacher:
    """Apply a partial update to a teacher."""
    obj = await crud.get_teacher(db, teacher_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    return await crud.update_teacher(db, obj, payload.model_dump(exclude_unset=True))


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_teacher(teacher_id: int, db: DBSession) -> None:
    """Soft-delete a teacher."""
    obj = await crud.get_teacher(db, teacher_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    await crud.delete_teacher(db, obj)

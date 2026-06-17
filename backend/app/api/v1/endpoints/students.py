"""CRUD endpoints for Student (Sinh viên)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.crud import people as crud
from app.dependencies import DBSession, PaginationDep, require_write_access
from app.models.people import Student
from app.schemas.people import StudentCreate, StudentResponse, StudentUpdate

router = APIRouter()


@router.get("", response_model=list[StudentResponse])
async def list_students(
    db: DBSession,
    pagination: PaginationDep,
    program_id: int | None = None,
    cohort_id: int | None = None,
) -> list[Student]:
    """Return students with optional filters by program and cohort."""
    return await crud.list_students(db, pagination.skip, pagination.limit, program_id, cohort_id)


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(student_id: int, db: DBSession) -> Student:
    """Retrieve a student by ID."""
    obj = await crud.get_student(db, student_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return obj


@router.post(
    "",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_student(payload: StudentCreate, db: DBSession) -> Student:
    """Create a new student."""
    return await crud.create_student(db, payload.model_dump())


@router.patch("/{student_id}", response_model=StudentResponse, dependencies=[Depends(require_write_access)])
async def update_student(student_id: int, payload: StudentUpdate, db: DBSession) -> Student:
    """Apply a partial update to a student."""
    obj = await crud.get_student(db, student_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return await crud.update_student(db, obj, payload.model_dump(exclude_unset=True))


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_student(student_id: int, db: DBSession) -> None:
    """Soft-delete a student."""
    obj = await crud.get_student(db, student_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    await crud.delete_student(db, obj)

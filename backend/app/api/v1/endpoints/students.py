"""CRUD endpoints for Student (Sinh viên)."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DBSession, PaginationDep
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
    q = select(Student).where(Student.is_active == True)  # noqa: E712
    if program_id is not None:
        q = q.where(Student.program_id == program_id)
    if cohort_id is not None:
        q = q.where(Student.cohort_id == cohort_id)
    result = await db.execute(q.offset(pagination.skip).limit(pagination.limit))
    return list(result.scalars().all())


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(student_id: int, db: DBSession) -> Student:
    obj = await db.get(Student, student_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return obj


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(payload: StudentCreate, db: DBSession) -> Student:
    obj = Student(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(student_id: int, payload: StudentUpdate, db: DBSession) -> Student:
    obj = await db.get(Student, student_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(student_id: int, db: DBSession) -> None:
    obj = await db.get(Student, student_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    obj.is_active = False

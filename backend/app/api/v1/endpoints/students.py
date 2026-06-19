"""CRUD endpoints for Student (Sinh viên)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.access_control import can_access_student, get_teacher_for_user, is_admin, require_department_scope
from app.crud import people as crud
from app.dependencies import CurrentUser, DBSession, PaginationDep, require_write_access
from app.models.academic import Program
from app.models.people import Student, UserRole
from app.models.teaching import Enrollment, Section
from app.schemas.people import StudentCreate, StudentResponse, StudentUpdate

router = APIRouter()


@router.get("", response_model=list[StudentResponse])
async def list_students(
    db: DBSession,
    pagination: PaginationDep,
    current_user: CurrentUser,
    program_id: int | None = None,
    cohort_id: int | None = None,
) -> list[Student]:
    """Return students with optional filters by program and cohort."""
    if not is_admin(current_user):
        q = select(Student).where(Student.is_active == True).distinct()  # noqa: E712
        if program_id is not None:
            q = q.where(Student.program_id == program_id)
        if cohort_id is not None:
            q = q.where(Student.cohort_id == cohort_id)
        if current_user.role == UserRole.lecturer:
            teacher = await get_teacher_for_user(db, current_user)
            if teacher is None:
                return []
            q = (
                q.join(Enrollment, Enrollment.student_id == Student.id)
                .join(Section, Section.id == Enrollment.section_id)
                .where(Section.teacher_id == teacher.id)
            )
        else:
            department_ids = await require_department_scope(db, current_user)
            q = q.join(Program, Program.id == Student.program_id).where(Program.department_id.in_(department_ids))
        q = q.offset(pagination.skip).limit(pagination.limit)
        return list((await db.execute(q)).scalars().all())
    return await crud.list_students(db, pagination.skip, pagination.limit, program_id, cohort_id)


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(student_id: int, db: DBSession, current_user: CurrentUser) -> Student:
    """Retrieve a student by ID."""
    obj = await crud.get_student(db, student_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if not await can_access_student(db, current_user, student_id):
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

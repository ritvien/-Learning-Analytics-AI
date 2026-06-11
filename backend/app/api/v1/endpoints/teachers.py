"""CRUD endpoints for Teacher (Giảng viên)."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DBSession, PaginationDep
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
    q = select(Teacher).where(Teacher.is_active == True)  # noqa: E712
    if department_id is not None:
        q = q.where(Teacher.department_id == department_id)
    result = await db.execute(q.offset(pagination.skip).limit(pagination.limit))
    return list(result.scalars().all())


@router.get("/{teacher_id}", response_model=TeacherResponse)
async def get_teacher(teacher_id: int, db: DBSession) -> Teacher:
    """Retrieve a teacher by ID."""
    obj = await db.get(Teacher, teacher_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    return obj


@router.post("", response_model=TeacherResponse, status_code=status.HTTP_201_CREATED)
async def create_teacher(payload: TeacherCreate, db: DBSession) -> Teacher:
    """Create a new teacher."""
    obj = Teacher(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/{teacher_id}", response_model=TeacherResponse)
async def update_teacher(teacher_id: int, payload: TeacherUpdate, db: DBSession) -> Teacher:
    """Apply a partial update to a teacher."""
    obj = await db.get(Teacher, teacher_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_teacher(teacher_id: int, db: DBSession) -> None:
    """Soft-delete a teacher."""
    obj = await db.get(Teacher, teacher_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    obj.is_active = False

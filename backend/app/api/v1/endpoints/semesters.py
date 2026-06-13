"""CRUD endpoints for Semester (Học kỳ)."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DBSession, PaginationDep
from app.models.academic import Semester
from app.schemas.academic import SemesterCreate, SemesterResponse, SemesterUpdate

router = APIRouter()


@router.get("", response_model=list[SemesterResponse])
async def list_semesters(db: DBSession, pagination: PaginationDep) -> list[Semester]:
    """Return all semesters ordered by year and term."""
    result = await db.execute(
        select(Semester).order_by(Semester.year.desc(), Semester.term.desc())
        .offset(pagination.skip).limit(pagination.limit)
    )
    return list(result.scalars().all())


@router.get("/current", response_model=SemesterResponse)
async def get_current_semester(db: DBSession) -> Semester:
    """Return the semester marked as current."""
    result = await db.execute(select(Semester).where(Semester.is_current == True))  # noqa: E712
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No current semester set")
    return obj


@router.get("/{semester_id}", response_model=SemesterResponse)
async def get_semester(semester_id: int, db: DBSession) -> Semester:
    """Retrieve a semester by ID."""
    obj = await db.get(Semester, semester_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found")
    return obj


@router.post("", response_model=SemesterResponse, status_code=status.HTTP_201_CREATED)
async def create_semester(payload: SemesterCreate, db: DBSession) -> Semester:
    """Create a new semester. If is_current=True, clears the flag on all others first."""
    if payload.is_current:
        await db.execute(
            select(Semester).where(Semester.is_current == True)  # noqa: E712
        )
        result = await db.execute(select(Semester).where(Semester.is_current == True))  # noqa: E712
        for existing in result.scalars().all():
            existing.is_current = False
    obj = Semester(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/{semester_id}", response_model=SemesterResponse)
async def update_semester(semester_id: int, payload: SemesterUpdate, db: DBSession) -> Semester:
    """Apply a partial update to a semester."""
    obj = await db.get(Semester, semester_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found")
    if payload.is_current:
        result = await db.execute(select(Semester).where(Semester.is_current == True))  # noqa: E712
        for existing in result.scalars().all():
            existing.is_current = False
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{semester_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_semester(semester_id: int, db: DBSession) -> None:
    """Delete a semester (only if no sections reference it)."""
    obj = await db.get(Semester, semester_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found")
    await db.delete(obj)

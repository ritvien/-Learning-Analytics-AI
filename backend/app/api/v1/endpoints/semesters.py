"""CRUD endpoints for Semester (Học kỳ)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.crud import academic as crud
from app.dependencies import DBSession, PaginationDep, require_write_access
from app.models.academic import Semester
from app.schemas.academic import SemesterCreate, SemesterResponse, SemesterUpdate

router = APIRouter()


@router.get("", response_model=list[SemesterResponse])
async def list_semesters(db: DBSession, pagination: PaginationDep) -> list[Semester]:
    """Return all semesters ordered by year and term."""
    return await crud.list_semesters(db, pagination.skip, pagination.limit)


@router.get("/current", response_model=SemesterResponse)
async def get_current_semester(db: DBSession) -> Semester:
    """Return the semester marked as current."""
    obj = await crud.get_current_semester(db)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No current semester set")
    return obj


@router.get("/{semester_id}", response_model=SemesterResponse)
async def get_semester(semester_id: int, db: DBSession) -> Semester:
    """Retrieve a semester by ID."""
    obj = await crud.get_semester(db, semester_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found")
    return obj


@router.post(
    "",
    response_model=SemesterResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_semester(payload: SemesterCreate, db: DBSession) -> Semester:
    """Create a new semester. If is_current=True, clears the flag on all others first."""
    if payload.is_current:
        await crud.clear_current_semester(db)
    return await crud.create_semester(db, payload.model_dump())


@router.patch("/{semester_id}", response_model=SemesterResponse, dependencies=[Depends(require_write_access)])
async def update_semester(semester_id: int, payload: SemesterUpdate, db: DBSession) -> Semester:
    """Apply a partial update to a semester."""
    obj = await crud.get_semester(db, semester_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found")
    if payload.is_current:
        await crud.clear_current_semester(db)
    return await crud.update_semester(db, obj, payload.model_dump(exclude_unset=True))


@router.delete("/{semester_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_semester(semester_id: int, db: DBSession) -> None:
    """Delete a semester (only if no sections reference it)."""
    obj = await crud.get_semester(db, semester_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found")
    await crud.delete_semester(db, obj)

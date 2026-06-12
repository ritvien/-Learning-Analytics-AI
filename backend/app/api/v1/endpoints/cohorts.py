"""CRUD endpoints for Cohort (Khóa học K17, K18, ...)."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DBSession, PaginationDep
from app.models.people import Cohort
from app.schemas.people import CohortCreate, CohortResponse, CohortUpdate

router = APIRouter()


@router.get("", response_model=list[CohortResponse])
async def list_cohorts(db: DBSession, pagination: PaginationDep) -> list[Cohort]:
    """Return all cohorts ordered by year_start descending."""
    result = await db.execute(
        select(Cohort).order_by(Cohort.year_start.desc())
        .offset(pagination.skip).limit(pagination.limit)
    )
    return list(result.scalars().all())


@router.get("/{cohort_id}", response_model=CohortResponse)
async def get_cohort(cohort_id: int, db: DBSession) -> Cohort:
    """Retrieve a cohort by ID."""
    obj = await db.get(Cohort, cohort_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    return obj


@router.post("", response_model=CohortResponse, status_code=status.HTTP_201_CREATED)
async def create_cohort(payload: CohortCreate, db: DBSession) -> Cohort:
    """Create a new cohort."""
    obj = Cohort(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/{cohort_id}", response_model=CohortResponse)
async def update_cohort(cohort_id: int, payload: CohortUpdate, db: DBSession) -> Cohort:
    """Apply a partial update to a cohort."""
    obj = await db.get(Cohort, cohort_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{cohort_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cohort(cohort_id: int, db: DBSession) -> None:
    """Delete a cohort (only if no students reference it)."""
    obj = await db.get(Cohort, cohort_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    await db.delete(obj)

"""CRUD endpoints for Cohort (Khóa học K17, K18, ...)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.crud import people as crud
from app.dependencies import DBSession, PaginationDep, require_write_access
from app.models.people import Cohort
from app.schemas.people import CohortCreate, CohortResponse, CohortUpdate

router = APIRouter()


@router.get("", response_model=list[CohortResponse])
async def list_cohorts(db: DBSession, pagination: PaginationDep) -> list[Cohort]:
    """Return all cohorts ordered by year_start descending."""
    return await crud.list_cohorts(db, pagination.skip, pagination.limit)


@router.get("/{cohort_id}", response_model=CohortResponse)
async def get_cohort(cohort_id: int, db: DBSession) -> Cohort:
    """Retrieve a cohort by ID."""
    obj = await crud.get_cohort(db, cohort_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    return obj


@router.post(
    "",
    response_model=CohortResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_cohort(payload: CohortCreate, db: DBSession) -> Cohort:
    """Create a new cohort."""
    return await crud.create_cohort(db, payload.model_dump())


@router.patch("/{cohort_id}", response_model=CohortResponse, dependencies=[Depends(require_write_access)])
async def update_cohort(cohort_id: int, payload: CohortUpdate, db: DBSession) -> Cohort:
    """Apply a partial update to a cohort."""
    obj = await crud.get_cohort(db, cohort_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    return await crud.update_cohort(db, obj, payload.model_dump(exclude_unset=True))


@router.delete("/{cohort_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_cohort(cohort_id: int, db: DBSession) -> None:
    """Delete a cohort (only if no students reference it)."""
    obj = await crud.get_cohort(db, cohort_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    await crud.delete_cohort(db, obj)

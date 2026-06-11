"""CRUD endpoints for Department.

Full implementation lives in T9. This module wires up the router
and defines all endpoint signatures with proper type annotations.
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DBSession, PaginationDep
from app.models.academic import Department
from app.schemas.academic import DepartmentCreate, DepartmentResponse, DepartmentUpdate

router = APIRouter()


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(db: DBSession, pagination: PaginationDep) -> list[Department]:
    """Return all active departments with pagination."""
    result = await db.execute(
        select(Department)
        .where(Department.is_active == True)  # noqa: E712
        .offset(pagination.skip)
        .limit(pagination.limit)
    )
    return list(result.scalars().all())


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(department_id: int, db: DBSession) -> Department:
    """Return a single department by ID."""
    obj = await db.get(Department, department_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return obj


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(payload: DepartmentCreate, db: DBSession) -> Department:
    """Create a new department."""
    obj = Department(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/{department_id}", response_model=DepartmentResponse)
async def update_department(department_id: int, payload: DepartmentUpdate, db: DBSession) -> Department:
    """Partial update of a department."""
    obj = await db.get(Department, department_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(department_id: int, db: DBSession) -> None:
    """Soft-delete a department (sets is_active=False)."""
    obj = await db.get(Department, department_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    obj.is_active = False

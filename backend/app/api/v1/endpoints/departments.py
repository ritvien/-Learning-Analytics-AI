"""CRUD endpoints for Department.

Full implementation lives in T9. This module wires up the router
and defines all endpoint signatures with proper type annotations.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.access_control import is_admin, require_department_scope
from app.crud import academic as crud
from app.dependencies import CurrentUser, DBSession, PaginationDep, require_write_access
from app.models.academic import Department
from app.schemas.academic import DepartmentCreate, DepartmentResponse, DepartmentUpdate

router = APIRouter()


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(db: DBSession, pagination: PaginationDep, current_user: CurrentUser) -> list[Department]:
    """Return all active departments with pagination."""
    if not is_admin(current_user):
        department_ids = await require_department_scope(db, current_user)
        result = await db.execute(
            select(Department)
            .where(Department.is_active == True, Department.id.in_(department_ids))  # noqa: E712
            .offset(pagination.skip)
            .limit(pagination.limit)
        )
        return list(result.scalars().all())
    return await crud.list_departments(db, pagination.skip, pagination.limit)


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(department_id: int, db: DBSession, current_user: CurrentUser) -> Department:
    """Return a single department by ID."""
    obj = await crud.get_department(db, department_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    if not is_admin(current_user):
        department_ids = await require_department_scope(db, current_user)
        if department_id not in department_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return obj


@router.post(
    "",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_department(payload: DepartmentCreate, db: DBSession) -> Department:
    """Create a new department."""
    return await crud.create_department(db, payload.model_dump())


@router.patch("/{department_id}", response_model=DepartmentResponse, dependencies=[Depends(require_write_access)])
async def update_department(department_id: int, payload: DepartmentUpdate, db: DBSession) -> Department:
    """Partial update of a department."""
    obj = await crud.get_department(db, department_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return await crud.update_department(db, obj, payload.model_dump(exclude_unset=True))


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_department(department_id: int, db: DBSession) -> None:
    """Soft-delete a department (sets is_active=False)."""
    obj = await crud.get_department(db, department_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    await crud.delete_department(db, obj)

"""CRUD endpoints for Program (Ngành / Chương trình đào tạo)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.access_control import can_access_program, is_admin, require_department_scope
from app.crud import academic as crud
from app.dependencies import CurrentUser, DBSession, PaginationDep, require_write_access
from app.models.academic import Program
from app.schemas.academic import ProgramCreate, ProgramResponse, ProgramUpdate

router = APIRouter()


@router.get("", response_model=list[ProgramResponse])
async def list_programs(
    db: DBSession,
    pagination: PaginationDep,
    current_user: CurrentUser,
    department_id: int | None = None,
) -> list[Program]:
    """Return programs, optionally filtered by department."""
    if not is_admin(current_user):
        department_ids = await require_department_scope(db, current_user)
        if department_id is not None:
            department_ids = department_ids.intersection({department_id})
        if not department_ids:
            return []
        result = await db.execute(
            select(Program)
            .where(Program.is_active == True, Program.department_id.in_(department_ids))  # noqa: E712
            .offset(pagination.skip)
            .limit(pagination.limit)
        )
        return list(result.scalars().all())
    return await crud.list_programs(db, pagination.skip, pagination.limit, department_id)


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program(program_id: int, db: DBSession, current_user: CurrentUser) -> Program:
    """Retrieve a program by ID."""
    obj = await crud.get_program(db, program_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    if not await can_access_program(db, current_user, program_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return obj


@router.post(
    "",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_program(payload: ProgramCreate, db: DBSession, current_user: CurrentUser) -> Program:
    """Create a new program."""
    if not is_admin(current_user):
        department_ids = await require_department_scope(db, current_user)
        if payload.department_id not in department_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Program scope is outside your permissions")
    return await crud.create_program(db, payload.model_dump())


@router.patch("/{program_id}", response_model=ProgramResponse, dependencies=[Depends(require_write_access)])
async def update_program(program_id: int, payload: ProgramUpdate, db: DBSession, current_user: CurrentUser) -> Program:
    """Apply a partial update to a program."""
    obj = await crud.get_program(db, program_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    if not await can_access_program(db, current_user, program_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Program scope is outside your permissions")
    return await crud.update_program(db, obj, payload.model_dump(exclude_unset=True))


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_program(program_id: int, db: DBSession, current_user: CurrentUser) -> None:
    """Soft-delete a program."""
    obj = await crud.get_program(db, program_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    if not await can_access_program(db, current_user, program_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Program scope is outside your permissions")
    await crud.delete_program(db, obj)

"""CRUD endpoints for Program (Ngành / Chương trình đào tạo)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.crud import academic as crud
from app.dependencies import DBSession, PaginationDep, require_write_access
from app.models.academic import Program
from app.schemas.academic import ProgramCreate, ProgramResponse, ProgramUpdate

router = APIRouter()


@router.get("", response_model=list[ProgramResponse])
async def list_programs(
    db: DBSession,
    pagination: PaginationDep,
    department_id: int | None = None,
) -> list[Program]:
    """Return programs, optionally filtered by department."""
    return await crud.list_programs(db, pagination.skip, pagination.limit, department_id)


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program(program_id: int, db: DBSession) -> Program:
    """Retrieve a program by ID."""
    obj = await crud.get_program(db, program_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return obj


@router.post(
    "",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_program(payload: ProgramCreate, db: DBSession) -> Program:
    """Create a new program."""
    return await crud.create_program(db, payload.model_dump())


@router.patch("/{program_id}", response_model=ProgramResponse, dependencies=[Depends(require_write_access)])
async def update_program(program_id: int, payload: ProgramUpdate, db: DBSession) -> Program:
    """Apply a partial update to a program."""
    obj = await crud.get_program(db, program_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return await crud.update_program(db, obj, payload.model_dump(exclude_unset=True))


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_program(program_id: int, db: DBSession) -> None:
    """Soft-delete a program."""
    obj = await crud.get_program(db, program_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    await crud.delete_program(db, obj)

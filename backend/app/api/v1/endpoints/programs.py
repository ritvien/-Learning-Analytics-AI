"""CRUD endpoints for Program (Ngành / Chương trình đào tạo)."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DBSession, PaginationDep
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
    q = select(Program).where(Program.is_active == True)  # noqa: E712
    if department_id is not None:
        q = q.where(Program.department_id == department_id)
    result = await db.execute(q.offset(pagination.skip).limit(pagination.limit))
    return list(result.scalars().all())


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program(program_id: int, db: DBSession) -> Program:
    obj = await db.get(Program, program_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return obj


@router.post("", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_program(payload: ProgramCreate, db: DBSession) -> Program:
    obj = Program(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/{program_id}", response_model=ProgramResponse)
async def update_program(program_id: int, payload: ProgramUpdate, db: DBSession) -> Program:
    obj = await db.get(Program, program_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(program_id: int, db: DBSession) -> None:
    obj = await db.get(Program, program_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    obj.is_active = False

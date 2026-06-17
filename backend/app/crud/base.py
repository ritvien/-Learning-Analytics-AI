"""Reusable async SQLAlchemy CRUD helpers."""

from typing import Any, TypeVar

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

ModelT = TypeVar("ModelT")


async def list_scalars(db: AsyncSession, query: Select[tuple[ModelT]], skip: int, limit: int) -> list[ModelT]:
    """Execute a paginated scalar query."""
    result = await db.execute(query.offset(skip).limit(limit))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, model: type[ModelT], obj_id: object) -> ModelT | None:
    """Return one model by primary key."""
    return await db.get(model, obj_id)


async def create_obj(db: AsyncSession, model: type[ModelT], data: dict[str, Any]) -> ModelT:
    """Create and refresh a model instance."""
    obj = model(**data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def update_obj(db: AsyncSession, obj: ModelT, data: dict[str, Any]) -> ModelT:
    """Patch a model instance and refresh it."""
    for field, value in data.items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


async def soft_delete_obj(db: AsyncSession, obj: object) -> None:
    """Mark an object inactive."""
    obj.is_active = False


async def hard_delete_obj(db: AsyncSession, obj: object) -> None:
    """Delete an object from the session."""
    await db.delete(obj)


def active_query(model: type[ModelT]) -> Select[tuple[ModelT]]:
    """Build a query for active models."""
    return select(model).where(model.is_active == True)  # noqa: E712

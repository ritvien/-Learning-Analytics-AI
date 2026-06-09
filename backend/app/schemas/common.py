"""Shared Pydantic schema utilities and base types."""

from pydantic import BaseModel, ConfigDict


class OrmBase(BaseModel):
    """Base schema for all ORM-backed responses.

    Enables model_config from_attributes so SQLAlchemy model instances
    can be passed directly to response schemas.
    """

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(OrmBase):
    """Generic paginated list wrapper."""

    total: int
    skip: int
    limit: int
    items: list  # override with a typed list in subclasses

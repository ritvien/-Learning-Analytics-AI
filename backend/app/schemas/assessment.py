"""Pydantic schemas for CLO/PLO assessment entities."""

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase


# ====================================================================== PLO
class PLOBase(BaseModel):
    """Shared fields for PLO create/update."""

    code: str = Field(max_length=20)
    name: str = Field(max_length=255)
    description: str | None = None
    bloom_level: int | None = Field(None, ge=1, le=6)
    sort_order: int = 0
    is_active: bool = True


class PLOCreate(PLOBase):
    """Fields required when creating a PLO."""

    program_id: int


class PLOUpdate(BaseModel):
    """All fields optional for PATCH update of PLO."""

    name: str | None = Field(None, max_length=255)
    description: str | None = None
    bloom_level: int | None = Field(None, ge=1, le=6)
    sort_order: int | None = None
    is_active: bool | None = None


class PLOResponse(PLOBase, OrmBase):
    """Full PLO response."""

    id: int
    program_id: int


# ====================================================================== CLO
class CLOBase(BaseModel):
    """Shared fields for CLO create/update."""

    code: str = Field(max_length=20)
    name: str = Field(max_length=255)
    description: str | None = None
    bloom_level: int | None = Field(None, ge=1, le=6)
    weight: float = 1.0
    sort_order: int = 0
    is_active: bool = True


class CLOCreate(CLOBase):
    """Fields required when creating a CLO."""

    course_id: int


class CLOUpdate(BaseModel):
    """All fields optional for PATCH update of CLO."""

    name: str | None = Field(None, max_length=255)
    description: str | None = None
    bloom_level: int | None = Field(None, ge=1, le=6)
    weight: float | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CLOResponse(CLOBase, OrmBase):
    """Full CLO response."""

    id: int
    course_id: int


# ============================================================ CLO-PLO Matrix
class CLOPLOMappingCreate(BaseModel):
    """Single cell in the CLO-PLO matrix."""

    clo_id: int
    plo_id: int
    contribution: int = Field(default=1, ge=1, le=3)


class CLOPLOMappingResponse(OrmBase):
    """CLO-PLO mapping response."""

    clo_id: int
    plo_id: int
    contribution: int


class CLOPLOMatrixUpdate(BaseModel):
    """Bulk update: replace all CLO-PLO mappings for a course."""

    mappings: list[CLOPLOMappingCreate]


# ======================================================== CLO Achievement
class StudentCLOAchievementResponse(OrmBase):
    """CLO achievement result for a single student."""

    id: int
    enrollment_id: int
    clo_id: int
    achievement_score: float | None
    is_achieved: bool | None
    source: str

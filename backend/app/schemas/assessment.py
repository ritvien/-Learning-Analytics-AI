"""Pydantic schemas for CLO/PLO assessment entities."""

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase


# ====================================================================== PLO
class PLOBase(BaseModel):
    code: str = Field(max_length=20)
    name: str = Field(max_length=255)
    description: str | None = None
    bloom_level: int | None = Field(None, ge=1, le=6)
    sort_order: int = 0
    is_active: bool = True


class PLOCreate(PLOBase):
    program_id: int


class PLOUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    bloom_level: int | None = Field(None, ge=1, le=6)
    sort_order: int | None = None
    is_active: bool | None = None


class PLOResponse(PLOBase, OrmBase):
    id: int
    program_id: int


# ====================================================================== CLO
class CLOBase(BaseModel):
    code: str = Field(max_length=20)
    name: str = Field(max_length=255)
    description: str | None = None
    bloom_level: int | None = Field(None, ge=1, le=6)
    weight: float = 1.0
    sort_order: int = 0
    is_active: bool = True


class CLOCreate(CLOBase):
    course_id: int


class CLOUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    bloom_level: int | None = Field(None, ge=1, le=6)
    weight: float | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CLOResponse(CLOBase, OrmBase):
    id: int
    course_id: int


# ============================================================ CLO-PLO Matrix
class CLOPLOMappingCreate(BaseModel):
    """Single cell in the CLO-PLO matrix."""

    clo_id: int
    plo_id: int
    contribution: int = Field(default=1, ge=1, le=3)


class CLOPLOMappingResponse(OrmBase):
    clo_id: int
    plo_id: int
    contribution: int


class CLOPLOMatrixUpdate(BaseModel):
    """Bulk update: replace all CLO-PLO mappings for a course."""

    mappings: list[CLOPLOMappingCreate]


# ======================================================== CLO Achievement
class StudentCLOAchievementResponse(OrmBase):
    id: int
    enrollment_id: int
    clo_id: int
    achievement_score: float | None
    is_achieved: bool | None

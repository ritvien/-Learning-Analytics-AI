"""Pydantic schemas for academic hierarchy entities."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase


# ================================================================ Department
class DepartmentBase(BaseModel):
    """Shared fields for Department create/update."""

    code: str = Field(max_length=20)
    name: str = Field(max_length=255)
    name_en: str | None = None
    description: str | None = None
    head_name: str | None = None
    email: str | None = None
    phone: str | None = None
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    """Fields required when creating a Department."""

    university_id: int


class DepartmentUpdate(BaseModel):
    """All fields optional for PATCH update."""

    code: str | None = Field(None, max_length=20)
    name: str | None = Field(None, max_length=255)
    name_en: str | None = None
    description: str | None = None
    head_name: str | None = None
    email: str | None = None
    phone: str | None = None
    is_active: bool | None = None


class DepartmentResponse(DepartmentBase, OrmBase):
    """Full Department response including PK and timestamps."""

    id: int
    university_id: int
    created_at: datetime
    updated_at: datetime


# ================================================================== Program
class ProgramBase(BaseModel):
    """Shared fields for Program create/update."""

    code: str = Field(max_length=30)
    name: str = Field(max_length=255)
    name_en: str | None = None
    description: str | None = None
    duration_years: int = 4
    total_credits: int | None = None
    accreditation: str | None = None
    version: str | None = None
    is_active: bool = True


class ProgramCreate(ProgramBase):
    """Fields required when creating a Program."""

    department_id: int


class ProgramUpdate(BaseModel):
    """All fields optional for PATCH update of Program."""

    code: str | None = Field(None, max_length=30)
    name: str | None = Field(None, max_length=255)
    name_en: str | None = None
    description: str | None = None
    duration_years: int | None = None
    total_credits: int | None = None
    accreditation: str | None = None
    version: str | None = None
    is_active: bool | None = None


class ProgramResponse(ProgramBase, OrmBase):
    """Full Program response including PK and timestamps."""

    id: int
    department_id: int
    created_at: datetime
    updated_at: datetime


# =================================================================== Course
class CourseBase(BaseModel):
    """Shared fields for Course create/update."""

    code: str = Field(max_length=30)
    name: str = Field(max_length=255)
    name_en: str | None = None
    credits: int = Field(ge=1)
    theory_hours: int | None = None
    lab_hours: int | None = None
    description: str | None = None
    is_elective: bool = False
    is_active: bool = True


class CourseCreate(CourseBase):
    """Fields required when creating a Course."""

    program_ids: list[int] = Field(min_length=1)


class CourseUpdate(BaseModel):
    """All fields optional for PATCH update of Course."""

    code: str | None = Field(None, max_length=30)
    name: str | None = Field(None, max_length=255)
    name_en: str | None = None
    credits: int | None = Field(None, ge=1)
    theory_hours: int | None = None
    lab_hours: int | None = None
    description: str | None = None
    is_elective: bool | None = None
    is_active: bool | None = None
    program_ids: list[int] | None = Field(None, min_length=1)


class CourseResponse(CourseBase, OrmBase):
    """Full Course response including PK and timestamps."""

    id: int
    program_ids: list[int]
    created_at: datetime
    updated_at: datetime


# ================================================================= Semester
class SemesterResponse(OrmBase):
    """Full Semester response."""

    id: int
    code: str
    name: str
    year: int
    term: int
    is_current: bool

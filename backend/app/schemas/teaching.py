"""Pydantic schemas for teaching entities: Section, Enrollment, GradeComponent."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase


# ================================================================= Section
class SectionBase(BaseModel):
    """Shared fields for Section create/update."""

    section_code: str = Field(max_length=20)
    room: str | None = None
    schedule: str | None = None
    max_students: int | None = None
    is_active: bool = True


class SectionCreate(SectionBase):
    """Fields required when creating a Section."""

    course_id: int
    teacher_id: int | None = None
    semester_id: int


class SectionUpdate(BaseModel):
    """All fields optional for PATCH update of Section."""

    teacher_id: int | None = None
    room: str | None = None
    schedule: str | None = None
    max_students: int | None = None
    is_active: bool | None = None


class SectionResponse(SectionBase, OrmBase):
    """Full Section response including PK and timestamps."""

    id: int
    course_id: int
    teacher_id: int | None
    semester_id: int
    created_at: datetime
    updated_at: datetime


# =============================================================== Enrollment
class EnrollmentCreate(BaseModel):
    """Fields required when creating an Enrollment."""

    student_id: int
    section_id: int
    attempt_number: int = 1


class EnrollmentGradeUpdate(BaseModel):
    """Payload for submitting or updating a student's final grade."""

    final_grade: float = Field(ge=0, le=10)


class EnrollmentResponse(OrmBase):
    """Full Enrollment response."""

    id: int
    student_id: int
    section_id: int
    final_grade: float | None
    grade_letter: str | None
    grade_4: float | None
    is_passed: bool | None
    registered_credits: int | None
    completed_at: datetime | None
    attempt_number: int
    status: str
    created_at: datetime
    updated_at: datetime


# ========================================================= GradeComponent
class GradeComponentTypeCreate(BaseModel):
    """Define a grade component (Quiz 1, Midterm, Final…) for a section."""

    name: str = Field(max_length=100)
    weight: float = Field(gt=0, le=100)
    max_score: float = Field(default=10.0, gt=0)
    is_required: bool = True
    sort_order: int = 0


class GradeComponentUpsert(BaseModel):
    """Create or update a student's score for one component."""

    enrollment_id: int
    component_type_id: int
    score: float | None = Field(None, ge=0)
    assessed_at: datetime | None = None
    is_absent: bool = False
    notes: str | None = None


class GradeComponentResponse(OrmBase):
    """Full GradeComponent response."""

    id: int
    enrollment_id: int
    component_type_id: int
    score: float | None
    max_score: float
    is_absent: bool
    assessed_at: datetime | None
    recorded_at: datetime | None
    updated_at: datetime


class GradeComponentDetailResponse(GradeComponentResponse):
    """Grade component response with its component name for grade screens."""

    component_name: str


class GradeImportRow(BaseModel):
    """One row imported from Excel/CSV grade sheets."""

    row_number: int | None = None
    enrollment_id: int | None = None
    student_code: str | None = None
    section_code: str | None = None
    course_code: str | None = None
    final_grade: float | None = Field(None, ge=0, le=10)
    component_name: str | None = None
    component_score: float | None = Field(None, ge=0)
    notes: str | None = None


class GradeImportRequest(BaseModel):
    """Bulk grade import payload parsed from a spreadsheet on the client."""

    rows: list[GradeImportRow]


class GradeImportResult(BaseModel):
    """Bulk grade import result."""

    total_rows: int
    updated_rows: int
    skipped_rows: int
    errors: list[str] = Field(default_factory=list)

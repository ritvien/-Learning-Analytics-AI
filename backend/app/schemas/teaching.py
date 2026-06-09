"""Pydantic schemas for teaching entities: Section, Enrollment, GradeComponent."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase


# ================================================================= Section
class SectionBase(BaseModel):
    section_code: str = Field(max_length=20)
    room: str | None = None
    schedule: str | None = None
    max_students: int | None = None
    is_active: bool = True


class SectionCreate(SectionBase):
    course_id: int
    teacher_id: int | None = None
    semester_id: int


class SectionUpdate(BaseModel):
    teacher_id: int | None = None
    room: str | None = None
    schedule: str | None = None
    max_students: int | None = None
    is_active: bool | None = None


class SectionResponse(SectionBase, OrmBase):
    id: int
    course_id: int
    teacher_id: int | None
    semester_id: int
    created_at: datetime
    updated_at: datetime


# =============================================================== Enrollment
class EnrollmentCreate(BaseModel):
    student_id: int
    section_id: int
    attempt_number: int = 1


class EnrollmentGradeUpdate(BaseModel):
    """Payload for submitting or updating a student's final grade."""

    final_grade: float = Field(ge=0, le=10)


class EnrollmentResponse(OrmBase):
    id: int
    student_id: int
    section_id: int
    final_grade: float | None
    grade_letter: str | None
    grade_4: float | None
    is_passed: bool | None
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
    is_absent: bool = False
    notes: str | None = None


class GradeComponentResponse(OrmBase):
    id: int
    enrollment_id: int
    component_type_id: int
    score: float | None
    max_score: float
    is_absent: bool
    updated_at: datetime

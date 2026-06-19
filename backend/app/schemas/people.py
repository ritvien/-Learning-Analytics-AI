"""Pydantic schemas for people entities: User, Teacher, Cohort, Student."""

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.people import UserRole
from app.schemas.common import OrmBase


# ===================================================================== User
class UserCreate(BaseModel):
    """Payload for registering a new user."""

    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(max_length=255)
    role: UserRole = UserRole.viewer
    department_id: int | None = None


class UserUpdate(BaseModel):
    """All fields optional for PATCH update of User."""

    full_name: str | None = Field(None, max_length=255)
    role: UserRole | None = None
    department_id: int | None = None
    is_active: bool | None = None


class UserResponse(OrmBase):
    """Safe user response — never includes hashed_password."""

    id: str
    email: str
    full_name: str
    role: UserRole
    department_id: int | None
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """JWT token pair returned after login."""

    access_token: str
    token_type: str = "bearer"


# ================================================================= Teacher
class TeacherBase(BaseModel):
    """Shared fields for Teacher create/update."""

    code: str | None = Field(None, max_length=20)
    full_name: str = Field(max_length=255)
    email: str | None = None
    phone: str | None = None
    academic_title: str | None = None
    specialization: str | None = None
    is_active: bool = True


class TeacherCreate(TeacherBase):
    """Fields required when creating a Teacher."""

    department_id: int
    create_account: bool = False
    login_password: str | None = Field(None, min_length=6)


class TeacherUpdate(BaseModel):
    """All fields optional for PATCH update of Teacher."""

    code: str | None = Field(None, max_length=20)
    full_name: str | None = Field(None, max_length=255)
    email: str | None = None
    phone: str | None = None
    academic_title: str | None = None
    specialization: str | None = None
    department_id: int | None = None
    is_active: bool | None = None


class TeacherResponse(TeacherBase, OrmBase):
    """Full Teacher response including PK and timestamps."""

    id: int
    user_id: str | None
    department_id: int
    created_at: datetime
    updated_at: datetime


class TeacherAccountProvision(BaseModel):
    """Create or reset a lecturer login account for a Teacher."""

    email: EmailStr | None = None
    password: str = Field(min_length=6)


class TeacherAccountResponse(BaseModel):
    """Safe response after provisioning a Teacher login account."""

    teacher_id: int
    user_id: str
    email: str
    role: UserRole = UserRole.lecturer


# ================================================================== Student
class StudentBase(BaseModel):
    """Shared fields for Student create/update."""

    student_code: str = Field(max_length=20)
    full_name: str = Field(max_length=255)
    date_of_birth: date | None = None
    gender: str | None = None
    email: str | None = None
    phone: str | None = None
    class_code: str | None = None
    status: str = "active"
    is_active: bool = True


class StudentCreate(StudentBase):
    """Fields required when creating a Student."""

    program_id: int
    cohort_id: int


class StudentUpdate(BaseModel):
    """All fields optional for PATCH update of Student."""

    full_name: str | None = Field(None, max_length=255)
    email: str | None = None
    phone: str | None = None
    class_code: str | None = None
    status: str | None = None
    is_active: bool | None = None


class StudentResponse(StudentBase, OrmBase):
    """Full Student response including PK and timestamps."""

    id: int
    program_id: int
    cohort_id: int
    gpa_cumulative: float | None
    created_at: datetime
    updated_at: datetime


# ================================================================== Cohort
class CohortCreate(BaseModel):
    """Fields required when creating a Cohort."""

    code: str = Field(max_length=10)
    year_start: int
    year_end: int | None = None
    note: str | None = None


class CohortUpdate(BaseModel):
    """All fields optional for PATCH update of Cohort."""

    year_end: int | None = None
    note: str | None = None


class CohortResponse(OrmBase):
    """Full Cohort response."""

    id: int
    code: str
    year_start: int
    year_end: int | None
    note: str | None

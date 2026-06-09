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
    code: str | None = Field(None, max_length=20)
    full_name: str = Field(max_length=255)
    email: str | None = None
    phone: str | None = None
    academic_title: str | None = None
    specialization: str | None = None
    is_active: bool = True


class TeacherCreate(TeacherBase):
    department_id: int


class TeacherUpdate(BaseModel):
    code: str | None = Field(None, max_length=20)
    full_name: str | None = Field(None, max_length=255)
    email: str | None = None
    phone: str | None = None
    academic_title: str | None = None
    specialization: str | None = None
    department_id: int | None = None
    is_active: bool | None = None


class TeacherResponse(TeacherBase, OrmBase):
    id: int
    department_id: int
    created_at: datetime
    updated_at: datetime


# ================================================================== Student
class StudentBase(BaseModel):
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
    program_id: int
    cohort_id: int


class StudentUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=255)
    email: str | None = None
    phone: str | None = None
    class_code: str | None = None
    status: str | None = None
    is_active: bool | None = None


class StudentResponse(StudentBase, OrmBase):
    id: int
    program_id: int
    cohort_id: int
    gpa_cumulative: float | None
    created_at: datetime
    updated_at: datetime


# ================================================================== Cohort
class CohortResponse(OrmBase):
    id: int
    code: str
    year_start: int
    year_end: int | None

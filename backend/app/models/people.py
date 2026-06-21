"""People ORM models: User, Teacher, Cohort, Student."""

from __future__ import annotations

import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Index, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.academic import Department, Program, Specialization
    from app.models.teaching import Enrollment, Section


class UserRole(StrEnum):
    """RBAC roles for the EduInsight system."""

    superadmin = "superadmin"
    admin = "admin"
    manager = "manager"  # BQL khoa — full read + limited write
    lecturer = "lecturer"  # Giảng viên — view own sections only
    viewer = "viewer"  # Read-only


class User(TimestampMixin, Base):
    """Auth user account — linked optionally to a Teacher record."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUID stored as string for SQLite compat
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.viewer, nullable=False)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    department: Mapped[Department | None] = relationship()


class Teacher(TimestampMixin, Base):
    """Giảng viên — may be linked to a User account."""

    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    code: Mapped[str | None] = mapped_column(String(20), unique=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    academic_title: Mapped[str | None] = mapped_column(String(50))  # GS, PGS, TS, ThS
    specialization: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    department: Mapped[Department] = relationship(back_populates="teachers")
    sections: Mapped[list[Section]] = relationship(back_populates="teacher")


class Cohort(Base):
    """Khóa học — K17, K18, K19… Used for cross-cohort comparisons."""

    __tablename__ = "cohorts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    year_start: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    year_end: Mapped[int | None] = mapped_column(SmallInteger)
    note: Mapped[str | None] = mapped_column(Text)

    students: Mapped[list[Student]] = relationship(back_populates="cohort")


class Student(TimestampMixin, Base):
    """Sinh viên — linked to program, optional specialization, and cohort."""

    __tablename__ = "students"
    __table_args__ = (Index("idx_students_specialization", "specialization_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id", ondelete="RESTRICT"), nullable=False)
    specialization_id: Mapped[int | None] = mapped_column(
        ForeignKey("specializations.id", ondelete="SET NULL"),
        nullable=True,
    )
    cohort_id: Mapped[int] = mapped_column(ForeignKey("cohorts.id", ondelete="RESTRICT"), nullable=False)
    student_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[datetime.date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(10))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    class_code: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    gpa_cumulative: Mapped[float | None] = mapped_column(Numeric(4, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    program: Mapped[Program] = relationship(back_populates="students")
    specialization: Mapped[Specialization | None] = relationship(back_populates="students")
    cohort: Mapped[Cohort] = relationship(back_populates="students")
    enrollments: Mapped[list[Enrollment]] = relationship(back_populates="student")

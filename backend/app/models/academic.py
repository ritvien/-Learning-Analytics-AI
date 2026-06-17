"""Academic hierarchy ORM models: University → Department → Program → Course."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, ForeignKey, Integer, SmallInteger, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.people import Student, Teacher
    from app.models.teaching import Section


program_courses = Table(
    "program_courses",
    Base.metadata,
    Column("program_id", ForeignKey("programs.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
)


class University(TimestampMixin, Base):
    """Root node of the Academic Tree (supports multi-university)."""

    __tablename__ = "universities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_short: Mapped[str | None] = mapped_column(String(50))
    website: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    departments: Mapped[list[Department]] = relationship(back_populates="university")


class Department(TimestampMixin, Base):
    """Khoa — second level of the Academic Tree."""

    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("university_id", "code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    university_id: Mapped[int] = mapped_column(ForeignKey("universities.id", ondelete="RESTRICT"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    head_name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    university: Mapped[University] = relationship(back_populates="departments")
    programs: Mapped[list[Program]] = relationship(back_populates="department")
    teachers: Mapped[list[Teacher]] = relationship(back_populates="department")
    courses: Mapped[list[Course]] = relationship(back_populates="department")


class Program(TimestampMixin, Base):
    """Ngành / Chương trình đào tạo — third level of the Academic Tree."""

    __tablename__ = "programs"
    __table_args__ = (UniqueConstraint("department_id", "code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    duration_years: Mapped[int] = mapped_column(SmallInteger, default=4, nullable=False)
    total_credits: Mapped[int | None] = mapped_column(SmallInteger)
    accreditation: Mapped[str | None] = mapped_column(String(50))
    version: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    department: Mapped[Department] = relationship(back_populates="programs")
    courses: Mapped[list[Course]] = relationship(secondary=program_courses, back_populates="programs")
    plos: Mapped[list[PLO]] = relationship(back_populates="program")  # type: ignore[name-defined]
    students: Mapped[list[Student]] = relationship(back_populates="program")


class Semester(Base):
    """Học kỳ — used as FK for sections and metric snapshots."""

    __tablename__ = "semesters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    term: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    sections: Mapped[list[Section]] = relationship(back_populates="semester")


class Course(TimestampMixin, Base):
    """Môn học — fourth level of the Academic Tree."""

    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id", ondelete="RESTRICT"), nullable=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(255))
    credits: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    theory_hours: Mapped[int | None] = mapped_column(SmallInteger)
    lab_hours: Mapped[int | None] = mapped_column(SmallInteger)

    description: Mapped[str | None] = mapped_column(Text)
    is_elective: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    department: Mapped[Department] = relationship(back_populates="courses")
    programs: Mapped[list[Program]] = relationship(secondary=program_courses, back_populates="courses")
    clos: Mapped[list[CLO]] = relationship(back_populates="course")  # type: ignore[name-defined]
    plo_mappings: Mapped[list[CoursePLOMapping]] = relationship(back_populates="course") # type: ignore[name-defined]
    sections: Mapped[list[Section]] = relationship(back_populates="course")

    @property
    def program_ids(self) -> list[int]:
        """Return IDs of programs that include this course."""
        return [program.id for program in self.programs]


# Deferred import to avoid circular dependency at top level
from app.models.assessment import CLO, PLO, CoursePLOMapping  # noqa: E402

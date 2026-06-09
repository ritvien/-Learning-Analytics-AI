"""Teaching ORM models: Section, Enrollment, GradeComponentType, GradeComponent."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.academic import Course, Semester
    from app.models.assessment import GradeComponentCLOMapping
    from app.models.people import Student, Teacher


class Section(TimestampMixin, Base):
    """Lớp học phần — one course offered in one semester by one teacher."""

    __tablename__ = "sections"
    __table_args__ = (UniqueConstraint("course_id", "semester_id", "section_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="SET NULL"))
    semester_id: Mapped[int] = mapped_column(ForeignKey("semesters.id", ondelete="RESTRICT"), nullable=False)
    section_code: Mapped[str] = mapped_column(String(20), nullable=False)
    room: Mapped[str | None] = mapped_column(String(50))
    schedule: Mapped[str | None] = mapped_column(String(255))
    max_students: Mapped[int | None] = mapped_column(SmallInteger)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    course: Mapped[Course] = relationship(back_populates="sections")
    teacher: Mapped[Teacher | None] = relationship(back_populates="sections")
    semester: Mapped[Semester] = relationship(back_populates="sections")
    enrollments: Mapped[list[Enrollment]] = relationship(back_populates="section")
    component_types: Mapped[list[GradeComponentType]] = relationship(back_populates="section")


class Enrollment(TimestampMixin, Base):
    """Đăng ký học phần + điểm tổng kết.

    attempt_number tracks re-takes (1 = first attempt, 2 = retake, …).
    is_passed and grade conversions are computed by a DB trigger or
    the Metric Engine after final_grade is set.
    """

    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("student_id", "section_id", "attempt_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id", ondelete="RESTRICT"), nullable=False)
    final_grade: Mapped[float | None] = mapped_column(Numeric(4, 2))
    grade_letter: Mapped[str | None] = mapped_column(String(5))
    grade_4: Mapped[float | None] = mapped_column(Numeric(3, 2))
    is_passed: Mapped[bool | None] = mapped_column(Boolean)
    attempt_number: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="enrolled", nullable=False)

    student: Mapped[Student] = relationship(back_populates="enrollments")
    section: Mapped[Section] = relationship(back_populates="enrollments")
    grade_components: Mapped[list[GradeComponent]] = relationship(back_populates="enrollment")


class GradeComponentType(Base):
    """Định nghĩa cấu trúc điểm thành phần của từng lớp (Quiz 1, Midterm, Final…)."""

    __tablename__ = "grade_component_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    max_score: Mapped[float] = mapped_column(Numeric(5, 2), default=10.0, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)

    section: Mapped[Section] = relationship(back_populates="component_types")
    grade_components: Mapped[list[GradeComponent]] = relationship(back_populates="component_type")
    clo_mappings: Mapped[list[GradeComponentCLOMapping]] = relationship(back_populates="component_type")


class GradeComponent(TimestampMixin, Base):
    """Điểm thành phần từng sinh viên — linked to CLO via GradeComponentCLOMapping."""

    __tablename__ = "grade_components"
    __table_args__ = (UniqueConstraint("enrollment_id", "component_type_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    component_type_id: Mapped[int] = mapped_column(
        ForeignKey("grade_component_types.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    max_score: Mapped[float] = mapped_column(Numeric(5, 2), default=10.0, nullable=False)
    is_absent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    enrollment: Mapped[Enrollment] = relationship(back_populates="grade_components")
    component_type: Mapped[GradeComponentType] = relationship(back_populates="grade_components")

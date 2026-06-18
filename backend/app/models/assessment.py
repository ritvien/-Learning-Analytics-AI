"""CLO / PLO assessment ORM models."""

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

if TYPE_CHECKING:
    from app.models.academic import Course, Program
    from app.models.teaching import GradeComponentType


class PLO(Base):
    """Program Learning Outcome — CĐR cấp chương trình (ABET/AUN standard)."""

    __tablename__ = "plos"
    __table_args__ = (UniqueConstraint("program_id", "code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    bloom_level: Mapped[int | None] = mapped_column(SmallInteger)  # 1-6 Bloom's taxonomy
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    program: Mapped[Program] = relationship(back_populates="plos")
    clo_mappings: Mapped[list[CLOPLOMapping]] = relationship(back_populates="plo")
    course_mappings: Mapped[list[CoursePLOMapping]] = relationship(back_populates="plo")


class CLO(Base):
    """Course Learning Outcome — CĐR cấp môn học."""

    __tablename__ = "clos"
    __table_args__ = (UniqueConstraint("course_id", "code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    bloom_level: Mapped[int | None] = mapped_column(SmallInteger)
    weight: Mapped[float] = mapped_column(Numeric(5, 2), default=1.0, nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    course: Mapped[Course] = relationship(back_populates="clos")
    plo_mappings: Mapped[list[CLOPLOMapping]] = relationship(back_populates="clo")
    component_mappings: Mapped[list[GradeComponentCLOMapping]] = relationship(back_populates="clo")
    student_achievements: Mapped[list[StudentCLOAchievement]] = relationship(back_populates="clo")


class CLOPLOMapping(Base):
    """Ma trận CLO ↔ PLO.

    contribution levels follow ABET/AUN standard:
      1 = Introduced, 2 = Developed, 3 = Assessed
    """

    __tablename__ = "clo_plo_mappings"

    clo_id: Mapped[int] = mapped_column(ForeignKey("clos.id", ondelete="CASCADE"), primary_key=True)
    plo_id: Mapped[int] = mapped_column(ForeignKey("plos.id", ondelete="CASCADE"), primary_key=True)
    contribution: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)

    clo: Mapped[CLO] = relationship(back_populates="plo_mappings")
    plo: Mapped[PLO] = relationship(back_populates="clo_mappings")


class CoursePLOMapping(Base):
    """Ma trận Course ↔ PLO. (Ánh xạ trực tiếp từ môn học sang chuẩn đầu ra chương trình)."""

    __tablename__ = "course_plos"

    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    plo_id: Mapped[int] = mapped_column(ForeignKey("plos.id", ondelete="CASCADE"), primary_key=True)
    level: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)

    course: Mapped[Course] = relationship(back_populates="plo_mappings")
    plo: Mapped[PLO] = relationship(back_populates="course_mappings")


class GradeComponentCLOMapping(Base):
    """Mapping: bài kiểm tra/thi → CLO đánh giá."""

    __tablename__ = "grade_component_clo_mappings"

    component_type_id: Mapped[int] = mapped_column(
        ForeignKey("grade_component_types.id", ondelete="CASCADE"), primary_key=True
    )
    clo_id: Mapped[int] = mapped_column(ForeignKey("clos.id", ondelete="CASCADE"), primary_key=True)
    weight: Mapped[float] = mapped_column(Numeric(5, 2), default=1.0, nullable=False)

    component_type: Mapped[GradeComponentType] = relationship(back_populates="clo_mappings")
    clo: Mapped[CLO] = relationship(back_populates="component_mappings")


class StudentCLOAchievement(Base):
    """Mức đạt CLO từng sinh viên — computed by Metric Engine."""

    __tablename__ = "student_clo_achievements"
    __table_args__ = (UniqueConstraint("enrollment_id", "clo_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    clo_id: Mapped[int] = mapped_column(ForeignKey("clos.id", ondelete="CASCADE"), nullable=False)
    achievement_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    is_achieved: Mapped[bool | None] = mapped_column(Boolean)

    clo: Mapped[CLO] = relationship(back_populates="student_achievements")

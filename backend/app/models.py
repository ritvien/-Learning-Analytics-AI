"""Legacy flat ORM models (kept for Alembic migrations)."""

import enum
import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Table, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class UserRole(enum.StrEnum):
    """User permission roles."""

    superadmin = 'superadmin'
    admin = 'admin'
    manager = 'manager'
    lecturer = 'lecturer'
    viewer = 'viewer'

class NodeType(enum.StrEnum):
    """Academic tree node types."""

    university = 'university'
    department = 'department'
    program = 'program'
    course = 'course'

class HealthStatus(enum.StrEnum):
    """Traffic-light health indicator."""

    green = 'green'
    yellow = 'yellow'
    red = 'red'

class AlertLevel(enum.StrEnum):
    """Alert severity levels."""

    info = 'info'
    warning = 'warning'
    critical = 'critical'

class ImportStatus(enum.StrEnum):
    """Data import pipeline states."""

    pending = 'pending'
    processing = 'processing'
    completed = 'completed'
    failed = 'failed'

class University(Base):
    """ORM model for universities table."""

    __tablename__ = "universities"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    name_short = Column(String(50))
    website = Column(String(255))
    address = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    departments = relationship("Department", back_populates="university")

class Department(Base):
    """ORM model for departments table."""

    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(Integer, ForeignKey("universities.id", ondelete="RESTRICT"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    name_en = Column(String(255))
    description = Column(Text)
    head_name = Column(String(255))
    email = Column(String(255))
    phone = Column(String(30))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    university = relationship("University", back_populates="departments")
    programs = relationship("Program", back_populates="department")

class Program(Base):
    """ORM model for programs table."""

    __tablename__ = "programs"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    code = Column(String(30), nullable=False)
    name = Column(String(255), nullable=False)
    name_en = Column(String(255))
    description = Column(Text)
    duration_years = Column(SmallInteger, default=4, nullable=False)
    total_credits = Column(SmallInteger)
    accreditation = Column(String(50))
    version = Column(String(20))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    department = relationship("Department", back_populates="programs")
    courses = relationship("Course", secondary="program_courses", back_populates="programs")

program_courses = Table('program_courses', Base.metadata,
    Column('program_id', Integer, ForeignKey('programs.id', ondelete='CASCADE'), primary_key=True),
    Column('course_id', Integer, ForeignKey('courses.id', ondelete='CASCADE'), primary_key=True)
)

class Semester(Base):
    """ORM model for semesters table."""

    __tablename__ = "semesters"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    year = Column(SmallInteger, nullable=False)
    term = Column(SmallInteger, nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    is_current = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Course(Base):
    """ORM model for courses table."""

    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    name_en = Column(String(255))
    credits = Column(SmallInteger, nullable=False)
    theory_hours = Column(SmallInteger)
    lab_hours = Column(SmallInteger)
    prerequisite_note = Column(Text)
    description = Column(Text)
    is_elective = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    programs = relationship("Program", secondary="program_courses", back_populates="courses")

class Cohort(Base):
    """ORM model for cohorts table."""

    __tablename__ = "cohorts"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False)
    year_start = Column(SmallInteger, nullable=False)
    year_end = Column(SmallInteger)
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class User(Base):
    """ORM model for users table."""

    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.viewer, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class Teacher(Base):
    """ORM model for teachers table."""

    __tablename__ = "teachers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    code = Column(String(20), unique=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True)
    phone = Column(String(30))
    academic_title = Column(String(50))
    specialization = Column(String(255))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class Student(Base):
    """ORM model for students table."""

    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("programs.id", ondelete="RESTRICT"), nullable=False)
    cohort_id = Column(Integer, ForeignKey("cohorts.id", ondelete="RESTRICT"), nullable=False)
    student_code = Column(String(20), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date)
    gender = Column(String(10))
    email = Column(String(255))
    phone = Column(String(30))
    class_code = Column(String(30))
    status = Column(String(20), default="active", nullable=False)
    gpa_cumulative = Column(Numeric(4, 2))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    program = relationship("Program")
    cohort = relationship("Cohort")

class Section(Base):
    """ORM model for sections table."""

    __tablename__ = "sections"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="SET NULL"))
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="RESTRICT"), nullable=False)
    section_code = Column(String(20), nullable=False)
    room = Column(String(50))
    schedule = Column(String(255))
    max_students = Column(SmallInteger)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    course = relationship("Course")
    semester = relationship("Semester")

class Enrollment(Base):
    """ORM model for enrollments table."""

    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="RESTRICT"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="RESTRICT"), nullable=False)
    final_grade = Column(Numeric(4, 2))
    grade_letter = Column(String(5))
    grade_4 = Column(Numeric(3, 2))
    is_passed = Column(Boolean)
    attempt_number = Column(SmallInteger, default=1, nullable=False)
    status = Column(String(20), default="enrolled", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student")
    section = relationship("Section")
    components = relationship("GradeComponent", back_populates="enrollment", cascade="all, delete-orphan")

class GradeComponentType(Base):
    """ORM model for grade_component_types table."""

    __tablename__ = "grade_component_types"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    weight = Column(Numeric(5, 2), nullable=False)
    max_score = Column(Numeric(5, 2), default=10, nullable=False)
    is_required = Column(Boolean, default=True, nullable=False)
    sort_order = Column(SmallInteger, default=0, nullable=False)

class GradeComponent(Base):
    """ORM model for grade_components table."""

    __tablename__ = "grade_components"
    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    component_type_id = Column(Integer, ForeignKey("grade_component_types.id", ondelete="CASCADE"), nullable=False)
    score = Column(Numeric(5, 2))
    max_score = Column(Numeric(5, 2), default=10, nullable=False)
    is_absent = Column(Boolean, default=False, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    enrollment = relationship("Enrollment", back_populates="components")
    component_type = relationship("GradeComponentType")

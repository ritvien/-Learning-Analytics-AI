"""ORM model registry — import all models so Alembic autogenerate sees them."""

from app.models.academic import Course, Department, Program, Semester, University
from app.models.assessment import (
    CLO,
    PLO,
    CLOPLOMapping,
    GradeComponentCLOMapping,
    StudentCLOAchievement,
)
from app.models.people import Cohort, Student, Teacher, User, UserRole
from app.models.teaching import Enrollment, GradeComponent, GradeComponentType, Section

__all__ = [
    "University",
    "Department",
    "Program",
    "Semester",
    "Course",
    "User",
    "UserRole",
    "Teacher",
    "Cohort",
    "Student",
    "Section",
    "Enrollment",
    "GradeComponentType",
    "GradeComponent",
    "PLO",
    "CLO",
    "CLOPLOMapping",
    "GradeComponentCLOMapping",
    "StudentCLOAchievement",
]

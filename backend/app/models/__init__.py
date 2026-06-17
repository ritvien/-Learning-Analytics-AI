"""ORM model registry — import all models so Alembic autogenerate sees them."""

from app.models.academic import Course, Department, Program, Semester, University
from app.models.assessment import (
    CLO,
    PLO,
    CLOPLOMapping,
    CoursePLOMapping,
    GradeComponentCLOMapping,
    StudentCLOAchievement,
)
from app.models.people import Cohort, Student, Teacher, User, UserRole
from app.models.report import Report, ReportFeedback
from app.models.teaching import Enrollment, GradeComponent, GradeComponentType, Section

__all__ = [
    "CLO",
    "PLO",
    "CLOPLOMapping",
    "CoursePLOMapping",
    "Cohort",
    "Course",
    "Department",
    "Enrollment",
    "GradeComponent",
    "GradeComponentCLOMapping",
    "GradeComponentType",
    "Program",
    "Report",
    "ReportFeedback",
    "Section",
    "Semester",
    "Student",
    "StudentCLOAchievement",
    "Teacher",
    "University",
    "User",
    "UserRole",
]

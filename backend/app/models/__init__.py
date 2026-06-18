"""ORM model registry — import all models so Alembic autogenerate sees them."""

from app.models.academic import Course, Department, Program, Semester, University
from app.models.assessment import (
    CLO,
    PLO,
    CLOPLOMapping,
    CoursePLOMapping,
    GradeComponentCLOMapping,
    StudentCLOAchievement,
    StudentPLOAchievement,
)
from app.models.people import Cohort, Student, Teacher, User, UserRole
from app.models.report import Report, ReportFeedback
from app.models.task import AnalyticsTask, StudentIntervention, TaskComment
from app.models.teaching import Enrollment, GradeComponent, GradeComponentType, Section

__all__ = [
    "AnalyticsTask",
    "CLO",
    "PLO",
    "CLOPLOMapping",
    "Cohort",
    "Course",
    "CoursePLOMapping",
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
    "StudentIntervention",
    "StudentCLOAchievement",
    "StudentPLOAchievement",
    "TaskComment",
    "Teacher",
    "University",
    "User",
    "UserRole",
]

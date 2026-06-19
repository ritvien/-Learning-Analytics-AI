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
from app.models.report import Report, ReportFeedback, ReportSchedule, ReportScheduleRun
from app.models.agent import (
    AgentMemory,
    AgentPromptVersion,
    ReportAgentMessage,
    ReportAgentPendingAction,
    ReportAgentSession,
    ReportAgentToolCall,
)
from app.models.chat import ChatSession
from app.models.teaching import Enrollment, GradeComponent, GradeComponentType, Section

__all__ = [
    "AgentMemory",
    "AgentPromptVersion",
    "CLO",
    "PLO",
    "CLOPLOMapping",
    "Cohort",
    "Course",
    "CoursePLOMapping",
    "ChatSession",
    "Department",
    "Enrollment",
    "GradeComponent",
    "GradeComponentCLOMapping",
    "GradeComponentType",
    "Program",
    "Report",
    "ReportAgentMessage",
    "ReportAgentPendingAction",
    "ReportAgentSession",
    "ReportAgentToolCall",
    "ReportFeedback",
    "ReportSchedule",
    "ReportScheduleRun",
    "Section",
    "Semester",
    "Student",
    "StudentCLOAchievement",
    "Teacher",
    "University",
    "User",
    "UserRole",
]

"""ORM model registry — import all models so Alembic autogenerate sees them."""

from app.models.academic import Course, Department, Program, Semester, Specialization, University
from app.models.agent import (
    AgentMemory,
    AgentPromptVersion,
    ReportAgentMessage,
    ReportAgentPendingAction,
    ReportAgentSession,
    ReportAgentToolCall,
)
from app.models.assessment import (
    CLO,
    PLO,
    CLOPLOMapping,
    CoursePLOMapping,
    GradeComponentCLOMapping,
    StudentCLOAchievement,
)
from app.models.chat import ChatSession
from app.models.intervention import InterventionCampaign, InterventionMessage, InterventionMessageEvent, StudentInterventionContact
from app.models.people import Cohort, Student, Teacher, User, UserRole
from app.models.report import Report, ReportFeedback, ReportSchedule, ReportScheduleRun
from app.models.teaching import Enrollment, GradeComponent, GradeComponentType, Section

__all__ = [
    "CLO",
    "PLO",
    "AgentMemory",
    "AgentPromptVersion",
    "CLOPLOMapping",
    "ChatSession",
    "Cohort",
    "Course",
    "CoursePLOMapping",
    "Department",
    "Enrollment",
    "GradeComponent",
    "GradeComponentCLOMapping",
    "GradeComponentType",
    "InterventionCampaign",
    "InterventionMessage",
    "InterventionMessageEvent",
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
    "Specialization",
    "Student",
    "StudentCLOAchievement",
    "StudentInterventionContact",
    "Teacher",
    "University",
    "User",
    "UserRole",
]

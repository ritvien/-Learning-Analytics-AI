"""Pydantic schema exports."""

from app.schemas.academic import (
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    ProgramCreate,
    ProgramResponse,
    ProgramUpdate,
    SemesterResponse,
)
from app.schemas.assessment import (
    CLOCreate,
    CLOPLOMappingResponse,
    CLOPLOMatrixUpdate,
    CLOResponse,
    CLOUpdate,
    PLOCreate,
    PLOResponse,
    PLOUpdate,
    StudentCLOAchievementResponse,
)
from app.schemas.common import OrmBase, PaginatedResponse
from app.schemas.people import (
    CohortResponse,
    StudentCreate,
    StudentResponse,
    StudentUpdate,
    TeacherCreate,
    TeacherResponse,
    TeacherUpdate,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.schemas.teaching import (
    EnrollmentCreate,
    EnrollmentGradeUpdate,
    EnrollmentResponse,
    GradeComponentResponse,
    GradeComponentTypeCreate,
    GradeComponentUpsert,
    SectionCreate,
    SectionResponse,
    SectionUpdate,
)

__all__ = [
    "OrmBase",
    "PaginatedResponse",
    "DepartmentCreate", "DepartmentUpdate", "DepartmentResponse",
    "ProgramCreate", "ProgramUpdate", "ProgramResponse",
    "CourseCreate", "CourseUpdate", "CourseResponse",
    "SemesterResponse",
    "UserCreate", "UserUpdate", "UserResponse", "TokenResponse",
    "TeacherCreate", "TeacherUpdate", "TeacherResponse",
    "StudentCreate", "StudentUpdate", "StudentResponse",
    "CohortResponse",
    "SectionCreate", "SectionUpdate", "SectionResponse",
    "EnrollmentCreate", "EnrollmentGradeUpdate", "EnrollmentResponse",
    "GradeComponentTypeCreate", "GradeComponentUpsert", "GradeComponentResponse",
    "PLOCreate", "PLOUpdate", "PLOResponse",
    "CLOCreate", "CLOUpdate", "CLOResponse",
    "CLOPLOMappingResponse", "CLOPLOMatrixUpdate",
    "StudentCLOAchievementResponse",
]

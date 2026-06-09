"""Aggregate router for API v1 — registers all endpoint sub-routers."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    courses,
    departments,
    grades,
    programs,
    sections,
    students,
    teachers,
)

api_router = APIRouter()

api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(programs.router, prefix="/programs", tags=["programs"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(teachers.router, prefix="/teachers", tags=["teachers"])
api_router.include_router(sections.router, prefix="/sections", tags=["sections"])
api_router.include_router(grades.router, prefix="/grades", tags=["grades"])

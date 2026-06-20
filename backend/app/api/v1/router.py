"""Aggregate router for API v1 — registers all endpoint sub-routers."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    auth,
    chat,
    cohorts,
    courses,
    departments,
    grades,
    programs,
    report_agent,
    reports,
    sections,
    semesters,
    students,
    teachers,
    tree,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(analytics.router, tags=["analytics"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(programs.router, prefix="/programs", tags=["programs"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(teachers.router, prefix="/teachers", tags=["teachers"])
api_router.include_router(sections.router, prefix="/sections", tags=["sections"])
api_router.include_router(grades.router, prefix="/grades", tags=["grades"])
api_router.include_router(semesters.router, prefix="/semesters", tags=["semesters"])
api_router.include_router(cohorts.router, prefix="/cohorts", tags=["cohorts"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(report_agent.router, prefix="/report-agent", tags=["report-agent"])
api_router.include_router(tree.router, prefix="/tree", tags=["tree"])

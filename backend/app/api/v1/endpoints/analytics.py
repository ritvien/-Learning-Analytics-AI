"""Analytics warehouse and prediction read/operation endpoints."""

import asyncio
from datetime import datetime
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text

from app.access_control import (
    can_access_course,
    can_access_department,
    can_access_program,
    can_access_section,
    can_access_student,
)
from app.analytics.etl import refresh_dwh
from app.analytics.health_score import (
    get_course_health_batch,
    get_course_health_score,
    get_department_health_score,
    get_program_health_score,
)
from app.config import get_settings
from app.database import AsyncSessionLocal
from app.dependencies import CurrentUser, DBSession, require_admin_access
from app.ml.dropout import predict_dropout_risk_for_student, score_dropout_predictions, train_dropout_model
from app.ml.dropout.score import DropoutModelNotFoundError, DropoutStudentNotFoundError
from app.ml.dropout.types import DropoutRiskResult
from app.ml.scoring import aggregate_student_semester_predictions
from app.models.people import Student
from app.models.teaching import Enrollment

router = APIRouter()

settings = get_settings()
_DASHBOARD_CACHE_TTL_SECONDS = 300
_dashboard_cache: dict[tuple, tuple[float, dict]] = {}


def _parse_dashboard_datetime(value: str, param_name: str) -> datetime:
    """Parse browser ISO timestamps before passing them to asyncpg."""
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {param_name}; expected ISO datetime",
        ) from exc


def _deny_out_of_scope() -> None:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Analytics scope is outside your permissions")


async def _require_program_scope(db: DBSession, user: CurrentUser, program_id: int) -> None:
    if not await can_access_program(db, user, program_id):
        _deny_out_of_scope()


async def _require_course_scope(db: DBSession, user: CurrentUser, course_id: int) -> None:
    if not await can_access_course(db, user, course_id):
        _deny_out_of_scope()


async def _require_department_scope(db: DBSession, user: CurrentUser, department_id: int) -> None:
    if not await can_access_department(db, user, department_id):
        _deny_out_of_scope()


async def _require_student_scope(db: DBSession, user: CurrentUser, student_id: int) -> None:
    if not await can_access_student(db, user, student_id):
        _deny_out_of_scope()


async def _require_enrollment_scope(db: DBSession, user: CurrentUser, enrollment_id: int) -> None:
    enrollment = await db.get(Enrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")
    if not await can_access_section(db, user, enrollment.section_id):
        _deny_out_of_scope()


def _dashboard_cache_get(key: tuple) -> dict | None:
    cached = _dashboard_cache.get(key)
    if cached is None:
        return None
    cached_at, payload = cached
    if monotonic() - cached_at > _DASHBOARD_CACHE_TTL_SECONDS:
        _dashboard_cache.pop(key, None)
        return None
    return payload


def _dashboard_cache_set(key: tuple, payload: dict) -> dict:
    _dashboard_cache[key] = (monotonic(), payload)
    return payload


@router.get("/health", tags=["system"])
async def api_health_check() -> dict[str, str]:
    """Return service health (mirrors root /health, useful for load-balancer path-based checks)."""
    return {"status": "ok", "service": "eduinsight-backend", "version": settings.app_version}


@router.get("/analytics/overview")
async def analytics_overview(db: DBSession) -> dict[str, int | float | None]:
    """Return top-level analytics from the DWH."""
    row = (
        (
            await db.execute(
                text(
                    """
                SELECT
                    COUNT(*)::INTEGER AS enrollment_count,
                    COUNT(*) FILTER (WHERE is_passed IS TRUE)::INTEGER AS passed_count,
                    COUNT(*) FILTER (WHERE is_passed IS FALSE)::INTEGER AS failed_count,
                    ROUND(AVG(final_grade), 2) AS average_grade
                FROM dwh.fact_enrollment_outcome
                """
                )
            )
        )
        .mappings()
        .one()
    )
    return dict(row)


@router.get("/analytics/trends")
async def analytics_trends(
    db: DBSession,
    course_id: int | None = None,
    program_id: int | None = None,
    cohort_id: int | None = None,
) -> list[dict]:
    """Return enrollment KPI trends grouped by semester, with optional filters."""
    where_clauses = []
    params: dict = {}
    if course_id is not None:
        where_clauses.append("f.course_id = :course_id")
        params["course_id"] = course_id
    if program_id is not None:
        where_clauses.append("ds.program_id = :program_id")
        params["program_id"] = program_id
    if cohort_id is not None:
        where_clauses.append("ds.cohort_id = :cohort_id")
        params["cohort_id"] = cohort_id

    join_student = "JOIN dwh.dim_student ds ON ds.student_id = f.student_id" if (program_id or cohort_id) else ""
    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f"""
        SELECT
            d_sem.semester_id,
            d_sem.code AS semester_code,
            d_sem.year,
            d_sem.term,
            COUNT(*)::INTEGER AS total_enrollments,
            COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::INTEGER AS passed_count,
            COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed_count,
            ROUND(AVG(f.final_grade), 2) AS avg_grade,
            ROUND(
                COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL
                / NULLIF(COUNT(*), 0) * 100, 2
            ) AS fail_rate_pct
        FROM dwh.fact_enrollment_outcome f
        JOIN dwh.dim_semester d_sem ON d_sem.semester_id = f.semester_id
        {join_student}
        {where_sql}
        GROUP BY d_sem.semester_id, d_sem.code, d_sem.year, d_sem.term
        ORDER BY d_sem.year DESC, d_sem.term DESC
    """
    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]


def _dashboard_filter_sql(
    *,
    semester_code: str | None = None,
    department_id: int | None = None,
    program_id: int | None = None,
    cohort_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[str, dict]:
    clauses: list[str] = []
    params: dict = {}
    if semester_code:
        clauses.append("dsem.code = :semester_code")
        params["semester_code"] = semester_code
    if department_id is not None:
        clauses.append("dp.department_id = :department_id")
        params["department_id"] = department_id
    if program_id is not None:
        clauses.append("ds.program_id = :program_id")
        params["program_id"] = program_id
    if cohort_id is not None:
        clauses.append("ds.cohort_id = :cohort_id")
        params["cohort_id"] = cohort_id
    if date_from:
        clauses.append("f.updated_at >= CAST(:date_from AS timestamptz)")
        params["date_from"] = _parse_dashboard_datetime(date_from, "date_from")
    if date_to:
        clauses.append("f.updated_at <= CAST(:date_to AS timestamptz)")
        params["date_to"] = _parse_dashboard_datetime(date_to, "date_to")
    return ("WHERE " + " AND ".join(clauses)) if clauses else "", params


async def _fetch_all(db: DBSession, sql: str, params: dict | None = None) -> list[dict]:
    result = await db.execute(text(sql), params or {})
    return [dict(row) for row in result.mappings().all()]


async def _fetch_one(db: DBSession, sql: str, params: dict | None = None) -> dict:
    row = (await db.execute(text(sql), params or {})).mappings().one()
    return dict(row)


async def _dashboard_meta(db: DBSession) -> dict:
    departments = await _fetch_all(
        db,
        """
        SELECT id, code, name
        FROM departments
        WHERE is_active IS TRUE
        ORDER BY name
        """,
    )
    programs = await _fetch_all(
        db,
        """
        SELECT id, code, name, department_id
        FROM programs
        WHERE is_active IS TRUE
        ORDER BY name
        """,
    )
    semesters = await _fetch_all(
        db,
        """
        SELECT id, code, name, year, term
        FROM semesters
        ORDER BY year, term
        """,
    )
    cohorts = await _fetch_all(
        db,
        """
        SELECT id, code, year_start
        FROM cohorts
        ORDER BY year_start, code
        """,
    )
    return {"departments": departments, "programs": programs, "semesters": semesters, "cohorts": cohorts}


@router.get("/analytics/dashboard/overview")
async def analytics_dashboard_overview(
    db: DBSession,
    semester_code: str | None = None,
    department_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Return pre-aggregated school dashboard metrics from the DWH."""
    cache_key = ("overview", semester_code, department_id, date_from, date_to)
    cached = _dashboard_cache_get(cache_key)
    if cached is not None:
        return cached

    where_sql, params = _dashboard_filter_sql(
        semester_code=semester_code,
        department_id=department_id,
        date_from=date_from,
        date_to=date_to,
    )
    scoped_program_clause = "WHERE dp.department_id = :department_id" if department_id is not None else ""
    scoped_student_clause = """
        JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
        WHERE ds.status = 'active' AND dp.department_id = :department_id
    """ if department_id is not None else "WHERE ds.status = 'active'"

    kpis = await _fetch_one(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, ds.program_id, ds.cohort_id, dp.department_id, dsem.code AS semester_code
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            (SELECT COUNT(*)::INTEGER FROM dwh.dim_student ds {scoped_student_clause}) AS total_active_students,
            (SELECT COUNT(*)::INTEGER FROM dwh.dim_program dp {scoped_program_clause}) AS program_count,
            COUNT(*)::INTEGER AS completed_enrollments,
            COUNT(*) FILTER (WHERE is_passed IS FALSE)::INTEGER AS failed_enrollments,
            COUNT(DISTINCT CASE WHEN is_passed IS FALSE THEN student_id END)::INTEGER AS risk_student_count,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1), 0)::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(final_grade), 2), 0)::FLOAT AS avg_grade
        FROM filtered
        """,
        params,
    )

    trend = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, dp.department_id, dsem.semester_id AS dim_semester_id, dsem.code, dsem.year, dsem.term
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            dim_semester_id AS id,
            code AS semester,
            year,
            term,
            COUNT(*)::INTEGER AS count,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1), 0)::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(final_grade), 2), 0)::FLOAT AS avg_grade
        FROM filtered
        GROUP BY dim_semester_id, code, year, term
        ORDER BY year, term
        """,
        params,
    )

    program_rows = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, ds.program_id, dp.department_id, dsem.code AS semester_code
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        ),
        worst_course AS (
            SELECT DISTINCT ON (program_id)
                program_id,
                dc.name AS worst_course,
                COUNT(*) FILTER (WHERE is_passed IS FALSE) AS failed_count
            FROM filtered f
            JOIN dwh.dim_course dc ON dc.course_id = f.course_id
            GROUP BY program_id, dc.course_id, dc.name
            ORDER BY program_id, failed_count DESC, dc.name
        )
        SELECT
            dp.program_id AS id,
            dp.code,
            dp.name,
            dep.name AS department,
            COUNT(DISTINCT ds.student_id)::INTEGER AS active_students,
            COUNT(DISTINCT f.section_id)::INTEGER AS sections,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1), 0)::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(f.final_grade), 2), 0)::FLOAT AS avg_grade,
            COUNT(DISTINCT CASE WHEN f.is_passed IS FALSE THEN f.student_id END)::INTEGER AS at_risk,
            COALESCE(wc.worst_course, 'Chưa có dữ liệu') AS worst_course
        FROM dwh.dim_program dp
        LEFT JOIN departments dep ON dep.id = dp.department_id
        LEFT JOIN dwh.dim_student ds ON ds.program_id = dp.program_id AND ds.status = 'active'
        LEFT JOIN filtered f ON f.student_id = ds.student_id
        LEFT JOIN worst_course wc ON wc.program_id = dp.program_id
        {scoped_program_clause}
        GROUP BY dp.program_id, dp.code, dp.name, dep.name, wc.worst_course
        ORDER BY at_risk DESC, pass_rate ASC, avg_grade ASC
        LIMIT 60
        """,
        params,
    )

    department_rows = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, dp.department_id
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            dep.id,
            dep.name,
            COUNT(*)::INTEGER AS count,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1), 0)::FLOAT AS pass_rate
        FROM departments dep
        LEFT JOIN filtered f ON f.department_id = dep.id
        WHERE dep.is_active IS TRUE
        GROUP BY dep.id, dep.name
        ORDER BY pass_rate ASC, count DESC
        """,
        params,
    )

    cohort_rows = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, ds.cohort_id
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            dc.cohort_id AS id,
            dc.code AS cohort,
            dc.year_start,
            COUNT(*)::INTEGER AS count,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1), 0)::FLOAT AS pass_rate,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1), 0)::FLOAT AS fail_rate
        FROM dwh.dim_cohort dc
        LEFT JOIN filtered f ON f.cohort_id = dc.cohort_id
        GROUP BY dc.cohort_id, dc.code, dc.year_start
        HAVING COUNT(*) > 0
        ORDER BY dc.year_start, dc.code
        """,
        params,
    )

    grade_distribution = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.final_grade
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            bucket AS name,
            COUNT(*)::INTEGER AS value
        FROM (
            SELECT CASE
                WHEN final_grade < 4 THEN 'Trượt nặng'
                WHEN final_grade < 5 THEN 'Cận trượt'
                WHEN final_grade < 6.5 THEN 'Trung bình'
                WHEN final_grade < 8 THEN 'Khá'
                ELSE 'Tốt'
            END AS bucket
            FROM filtered
            WHERE final_grade IS NOT NULL
        ) s
        GROUP BY bucket
        ORDER BY MIN(CASE bucket WHEN 'Trượt nặng' THEN 1 WHEN 'Cận trượt' THEN 2 WHEN 'Trung bình' THEN 3 WHEN 'Khá' THEN 4 ELSE 5 END)
        """,
        params,
    )

    heatmap = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, ds.program_id, dsem.semester_id AS dim_semester_id, dsem.code, dsem.year, dsem.term
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        ),
        top_programs AS (
            SELECT program_id
            FROM filtered
            GROUP BY program_id
            ORDER BY COUNT(*) FILTER (WHERE is_passed IS FALSE) DESC
            LIMIT 10
        )
        SELECT
            dp.program_id AS program_id,
            dp.name AS program_name,
            f.dim_semester_id AS semester_id,
            f.code AS semester,
            f.year,
            f.term,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 0), 0)::INTEGER AS pass_rate
        FROM filtered f
        JOIN top_programs tp ON tp.program_id = f.program_id
        JOIN dwh.dim_program dp ON dp.program_id = f.program_id
        GROUP BY dp.program_id, dp.name, f.dim_semester_id, f.code, f.year, f.term
        ORDER BY dp.name, f.year, f.term
        """,
        params,
    )

    meta = await _dashboard_meta(db)
    return _dashboard_cache_set(cache_key, {
        **meta,
        "kpis": kpis,
        "trend": trend,
        "program_rows": program_rows,
        "department_rows": department_rows,
        "cohort_rows": cohort_rows,
        "grade_distribution": grade_distribution,
        "heatmap": heatmap,
    })


async def prewarm_dashboard_cache() -> None:
    """Warm the most common aggregate dashboard after backend startup."""
    async with AsyncSessionLocal() as session:
        await analytics_dashboard_overview(session)


@router.get("/analytics/dashboard/departments")
async def analytics_dashboard_departments(
    db: DBSession,
    semester_code: str | None = None,
    department_id: int | None = None,
    program_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Return pre-aggregated department dashboard metrics from the DWH."""
    cache_key = ("departments", semester_code, department_id, program_id, date_from, date_to)
    cached = _dashboard_cache_get(cache_key)
    if cached is not None:
        return cached

    where_sql, params = _dashboard_filter_sql(
        semester_code=semester_code,
        department_id=department_id,
        program_id=program_id,
        date_from=date_from,
        date_to=date_to,
    )

    dept_stats = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, dp.department_id
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            dep.id,
            dep.name,
            REGEXP_REPLACE(REGEXP_REPLACE(dep.name, '^Khoa\\s+', '', 'i'), '^Bộ môn\\s+', '', 'i') AS short_name,
            COUNT(DISTINCT f.student_id)::INTEGER AS student_count,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1), 0)::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(f.final_grade), 2), 0)::FLOAT AS avg_grade,
            COUNT(DISTINCT CASE WHEN f.is_passed IS FALSE THEN f.student_id END)::INTEGER AS at_risk
        FROM departments dep
        LEFT JOIN filtered f ON f.department_id = dep.id
        WHERE dep.is_active IS TRUE
        GROUP BY dep.id, dep.name
        ORDER BY student_count DESC, pass_rate ASC
        """,
        params,
    )

    heatmap = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, dp.department_id, dsem.semester_id AS dim_semester_id, dsem.code, dsem.year, dsem.term
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            dep.id AS department_id,
            REGEXP_REPLACE(REGEXP_REPLACE(dep.name, '^Khoa\\s+', '', 'i'), '^Bộ môn\\s+', '', 'i') AS department,
            f.dim_semester_id AS semester_id,
            f.code AS semester,
            f.year,
            f.term,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 0), 0)::INTEGER AS pass_rate
        FROM filtered f
        JOIN departments dep ON dep.id = f.department_id
        GROUP BY dep.id, dep.name, f.dim_semester_id, f.code, f.year, f.term
        ORDER BY dep.name, f.year, f.term
        """,
        params,
    )

    drill_course_fail = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, dp.department_id
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            dc.course_id AS id,
            dc.name,
            COUNT(*)::INTEGER AS total,
            COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed,
            COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1), 0)::FLOAT AS rate
        FROM filtered f
        JOIN dwh.dim_course dc ON dc.course_id = f.course_id
        GROUP BY dc.course_id, dc.name
        HAVING COUNT(*) >= 5
        ORDER BY rate DESC, failed DESC
        LIMIT 10
        """,
        params,
    )

    drill_section_abnormal = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, dp.department_id, ds.program_id
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        ),
        section_stats AS (
            SELECT
                f.section_id,
                f.course_id,
                COUNT(*)::INTEGER AS total,
                COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed
            FROM filtered f
            GROUP BY f.section_id, f.course_id
            HAVING COUNT(*) >= 5
        ),
        course_stats AS (
            SELECT
                f.course_id,
                COUNT(*)::INTEGER AS total,
                COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed
            FROM filtered f
            GROUP BY f.course_id
        )
        SELECT
            ss.section_id AS id,
            dsec.section_code AS code,
            dc.name AS course_name,
            COALESCE(ROUND(ss.failed::DECIMAL / NULLIF(ss.total, 0) * 100, 1), 0)::FLOAT AS fail_rate,
            COALESCE(ROUND(cs.failed::DECIMAL / NULLIF(cs.total, 0) * 100, 1), 0)::FLOAT AS avg_fail,
            COALESCE(ROUND((ss.failed::DECIMAL / NULLIF(ss.total, 0) - cs.failed::DECIMAL / NULLIF(cs.total, 0)) * 100, 1), 0)::FLOAT AS diff
        FROM section_stats ss
        JOIN course_stats cs ON cs.course_id = ss.course_id
        JOIN dwh.dim_section dsec ON dsec.section_id = ss.section_id
        JOIN dwh.dim_course dc ON dc.course_id = ss.course_id
        WHERE (ss.failed::DECIMAL / NULLIF(ss.total, 0) - cs.failed::DECIMAL / NULLIF(cs.total, 0)) * 100 >= 15
        ORDER BY fail_rate DESC, diff DESC
        LIMIT 10
        """,
        params,
    )

    meta = await _dashboard_meta(db)
    return _dashboard_cache_set(cache_key, {
        **meta,
        "dept_stats": dept_stats,
        "heatmap": heatmap,
        "drill_course_fail": drill_course_fail,
        "drill_section_abnormal": drill_section_abnormal,
    })


@router.get("/analytics/dashboard/programs/{program_id}")
async def analytics_dashboard_program(
    program_id: int,
    db: DBSession,
    semester_code: str | None = None,
    cohort_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Return pre-aggregated program dashboard metrics from the DWH."""
    cache_key = ("program", program_id, semester_code, cohort_id, date_from, date_to)
    cached = _dashboard_cache_get(cache_key)
    if cached is not None:
        return cached

    where_sql, params = _dashboard_filter_sql(
        program_id=program_id,
        semester_code=semester_code,
        cohort_id=cohort_id,
        date_from=date_from,
        date_to=date_to,
    )

    program = (
        await db.execute(
            text(
                """
                SELECT program_id AS id, code, name, department_id
                FROM dwh.dim_program
                WHERE program_id = :program_id
                """
            ),
            {"program_id": program_id},
        )
    ).mappings().one_or_none()
    if program is None:
        program = (
            await db.execute(
                text(
                    """
                    SELECT id, code, name, department_id
                    FROM programs
                    WHERE id = :program_id AND is_active IS TRUE
                    """
                ),
                {"program_id": program_id},
            )
        ).mappings().one_or_none()
    if program is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    kpis = await _fetch_one(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, ds.cohort_id
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            (
                SELECT COUNT(*)::INTEGER
                FROM dwh.dim_student
                WHERE program_id = :program_id AND status = 'active'
            ) AS students,
            COUNT(*) FILTER (WHERE is_passed IS NOT NULL)::INTEGER AS completed_enrollments,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(final_grade), 2), 0)::FLOAT AS avg_grade,
            COUNT(DISTINCT CASE WHEN is_passed IS FALSE THEN student_id END)::INTEGER AS at_risk,
            COUNT(DISTINCT CASE WHEN is_passed IS FALSE THEN course_id END)::INTEGER AS bottlenecks
        FROM filtered
        """,
        params,
    )

    trend = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, dsem.semester_id AS dim_semester_id, dsem.code, dsem.year, dsem.term
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            dim_semester_id AS id,
            code AS semester,
            year,
            term,
            COUNT(*) FILTER (WHERE is_passed IS NOT NULL)::INTEGER AS count,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(final_grade), 2), 0)::FLOAT AS avg_grade
        FROM filtered
        WHERE is_passed IS NOT NULL
        GROUP BY dim_semester_id, code, year, term
        ORDER BY year, term
        """,
        params,
    )

    course_stats = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            dc.course_id AS id,
            dc.code,
            dc.name,
            CASE
                WHEN dc.credits <= 2 THEN 'Nhóm 1-2 tín chỉ'
                WHEN dc.credits = 3 THEN 'Nhóm 3 tín chỉ'
                ELSE 'Nhóm 4+ tín chỉ'
            END AS "group",
            COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS total,
            COUNT(*) FILTER (WHERE f.is_passed IS NULL)::INTEGER AS missing_result,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(f.final_grade), 2), 0)::FLOAT AS avg_grade,
            COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed,
            COUNT(*) FILTER (WHERE f.final_grade >= 4 AND f.final_grade < 5)::INTEGER AS near_fail
        FROM filtered f
        JOIN dwh.dim_course dc ON dc.course_id = f.course_id
        GROUP BY dc.course_id, dc.code, dc.name, dc.credits
        HAVING COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL) > 0
        ORDER BY pass_rate ASC, failed DESC
        LIMIT 80
        """,
        params,
    )

    groups = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            CASE
                WHEN dc.credits <= 2 THEN 'Nhóm 1-2 tín chỉ'
                WHEN dc.credits = 3 THEN 'Nhóm 3 tín chỉ'
                ELSE 'Nhóm 4+ tín chỉ'
            END AS name,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS pass_rate
        FROM filtered f
        JOIN dwh.dim_course dc ON dc.course_id = f.course_id
        GROUP BY 1
        HAVING COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL) > 0
        ORDER BY pass_rate ASC
        """,
        params,
    )

    distribution = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.final_grade
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT bucket AS name, COUNT(*)::INTEGER AS value
        FROM (
            SELECT CASE
                WHEN final_grade < 4 THEN 'Trượt nặng'
                WHEN final_grade < 5 THEN 'Cận trượt'
                WHEN final_grade < 6.5 THEN 'Trung bình'
                WHEN final_grade < 8 THEN 'Khá'
                ELSE 'Tốt'
            END AS bucket
            FROM filtered
            WHERE final_grade IS NOT NULL
        ) s
        GROUP BY bucket
        ORDER BY MIN(CASE bucket WHEN 'Trượt nặng' THEN 1 WHEN 'Cận trượt' THEN 2 WHEN 'Trung bình' THEN 3 WHEN 'Khá' THEN 4 ELSE 5 END)
        """,
        params,
    )

    cohort_heatmap = await _fetch_all(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*, ds.cohort_id, dsem.semester_id AS dim_semester_id, dsem.code, dsem.year, dsem.term
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            dc.cohort_id,
            dc.code AS cohort,
            f.dim_semester_id AS semester_id,
            f.code AS semester,
            f.year,
            f.term,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                    0
                ),
                0
            )::INTEGER AS pass_rate
        FROM filtered f
        JOIN dwh.dim_cohort dc ON dc.cohort_id = f.cohort_id
        GROUP BY dc.cohort_id, dc.code, f.dim_semester_id, f.code, f.year, f.term
        HAVING COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL) > 0
        ORDER BY dc.code, f.year, f.term
        """,
        params,
    )

    meta = await _dashboard_meta(db)
    return _dashboard_cache_set(cache_key, {
        **meta,
        "program": dict(program),
        "kpis": kpis,
        "trend": trend,
        "course_stats": course_stats,
        "groups": groups,
        "distribution": distribution,
        "cohort_heatmap": cohort_heatmap,
    })


@router.get("/analytics/refresh-status")
async def analytics_refresh_status(db: DBSession) -> dict:
    """Return the most recent DWH ETL run status."""
    row = (
        await db.execute(
            text(
                """
                SELECT id, status, started_at, completed_at, rows_processed, error_message
                FROM dwh.etl_run
                ORDER BY started_at DESC
                LIMIT 1
                """
            )
        )
    ).mappings().one_or_none()
    if row is None:
        return {"status": "never_run", "last_run": None}
    return dict(row)


@router.post("/admin/dwh/refresh", dependencies=[Depends(require_admin_access)])
async def trigger_dwh_refresh() -> dict[str, int | str]:
    """Run the idempotent OLTP-to-DWH refresh."""
    run_id = await refresh_dwh()
    _dashboard_cache.clear()
    return {"status": "completed", "etl_run_id": run_id}


@router.post("/admin/ml/train", dependencies=[Depends(require_admin_access)])
async def trigger_ml_train(model: str = Query(default="dropout")) -> dict[str, str | int | float]:
    """Train an ML model. Currently supports dropout classifier only."""
    if model != "dropout":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only model=dropout is supported",
        )
    try:
        result = await asyncio.to_thread(train_dropout_model)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {
        "status": "completed",
        "model": model,
        "model_run_id": result.model_run_id,
        "model_version": result.model_version,
        "selected_model": result.selected_model,
        "threshold": result.threshold,
    }


@router.post("/admin/ml/score-dropout", dependencies=[Depends(require_admin_access)])
async def trigger_dropout_score(model_run_id: int) -> dict[str, int | str]:
    """Batch-score active students for a completed dropout model run."""
    try:
        rows = await asyncio.to_thread(score_dropout_predictions, model_run_id)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"status": "completed", "rows_upserted": rows}


@router.post("/admin/ml/score", dependencies=[Depends(require_admin_access)])
async def trigger_ml_score(model_run_id: int) -> dict[str, int | str]:
    """Batch-score all enrollments for a completed model run and aggregate per student-semester."""
    rows = await aggregate_student_semester_predictions(model_run_id)
    return {"status": "completed", "rows_upserted": rows}


@router.post("/admin/ml/aggregate/{model_run_id}", dependencies=[Depends(require_admin_access)])
async def trigger_prediction_aggregation(model_run_id: int) -> dict[str, int | str]:
    """Aggregate enrollment predictions into expected student-semester credits."""
    rows = await aggregate_student_semester_predictions(model_run_id)
    return {"status": "completed", "rows_upserted": rows}


@router.get("/predictions/enrollments/{enrollment_id}")
async def get_enrollment_prediction(enrollment_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Return the latest prediction for an enrollment."""
    await _require_enrollment_scope(db, current_user, enrollment_id)
    row = (
        (
            await db.execute(
                text(
                    """
                SELECT p.*, r.model_name, r.model_version
                FROM ml.enrollment_prediction p
                JOIN ml.model_run r ON r.id = p.model_run_id
                WHERE p.enrollment_id = :enrollment_id
                ORDER BY p.scored_at DESC
                LIMIT 1
                """
                ),
                {"enrollment_id": enrollment_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")
    return dict(row)


@router.get("/predictions/students/{student_id}/semesters/{semester_id}")
async def get_student_semester_prediction(
    student_id: int,
    semester_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Return the latest expected-credit prediction for a student-semester."""
    await _require_student_scope(db, current_user, student_id)
    row = (
        (
            await db.execute(
                text(
                    """
                SELECT p.*, r.model_name, r.model_version
                FROM ml.student_semester_prediction p
                JOIN ml.model_run r ON r.id = p.model_run_id
                WHERE p.student_id = :student_id AND p.semester_id = :semester_id
                ORDER BY p.scored_at DESC
                LIMIT 1
                """
                ),
                {"student_id": student_id, "semester_id": semester_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")
    return dict(row)


@router.get("/predictions/students/{student_id}/semesters/{semester_id}/enrollments")
async def get_student_semester_enrollment_predictions(
    student_id: int,
    semester_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> list[dict]:
    """Return all enrollment-level predictions for a student in a semester."""
    await _require_student_scope(db, current_user, student_id)
    result = await db.execute(
        text(
            """
            SELECT p.*, r.model_name, r.model_version, e.section_id, sec.course_id, c.code AS course_code, c.name AS course_name, c.credits
            FROM ml.enrollment_prediction p
            JOIN ml.model_run r ON r.id = p.model_run_id
            JOIN public.enrollments e ON e.id = p.enrollment_id
            JOIN public.sections sec ON sec.id = e.section_id
            JOIN public.courses c ON c.id = sec.course_id
            WHERE e.student_id = :student_id AND sec.semester_id = :semester_id
            ORDER BY p.scored_at DESC
            """
        ),
        {"student_id": student_id, "semester_id": semester_id},
    )
    seen = set()
    latest_predictions = []
    for row in result.mappings().all():
        e_id = row["enrollment_id"]
        if e_id not in seen:
            seen.add(e_id)
            payload = dict(row)
            # convert decimal/float fields appropriately if needed
            payload["pass_probability"] = float(payload["pass_probability"])
            payload["fail_probability"] = float(payload["fail_probability"])
            latest_predictions.append(payload)
    return latest_predictions


@router.get("/predictions/students/{student_id}/dropout-risk")
async def get_student_dropout_risk(
    student_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Return the latest ML dropout-risk prediction for a student."""
    await _require_student_scope(db, current_user, student_id)
    row = (
        (
            await db.execute(
                text(
                    """
                SELECT
                    p.student_id,
                    p.dropout_probability,
                    p.risk_level,
                    p.top_factors,
                    p.scored_at,
                    r.model_name,
                    r.model_version
                FROM ml.student_dropout_prediction p
                JOIN ml.model_run r ON r.id = p.model_run_id
                WHERE p.student_id = :student_id AND r.status = 'completed'
                ORDER BY p.scored_at DESC
                LIMIT 1
                """
                ),
                {"student_id": student_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dropout prediction not found")
    payload = dict(row)
    payload["dropout_probability"] = float(payload["dropout_probability"])
    return payload


def _dropout_risk_payload(result: DropoutRiskResult) -> dict:
    """Serialize a dropout prediction for API consumers."""
    return {
        "student_id": result.student_id,
        "student_code": result.student_code,
        "dropout_probability": result.dropout_probability,
        "risk_level": result.risk_level,
        "top_factors": result.top_factors,
        "model_run_id": result.model_run_id,
        "model_name": result.model_name,
        "model_version": result.model_version,
        "scored_at": result.scored_at,
        "source": result.source,
    }


@router.post("/predictions/students/{student_id}/dropout-risk/predict")
async def predict_student_dropout_risk(
    student_id: int,
    db: DBSession,
    current_user: CurrentUser,
    model_run_id: int | None = Query(default=None, description="Optional model run; defaults to latest completed"),
    persist: bool = Query(default=False, description="Upsert result into ml.student_dropout_prediction"),
) -> dict:
    """Run live ML dropout inference for one student without a prior batch score."""
    await _require_student_scope(db, current_user, student_id)
    try:
        result = await asyncio.to_thread(
            predict_dropout_risk_for_student,
            student_id,
            model_run_id=model_run_id,
            persist=persist,
        )
    except DropoutStudentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DropoutModelNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return _dropout_risk_payload(result)


@router.post("/predictions/students/by-code/{student_code}/dropout-risk/predict")
async def predict_dropout_risk_by_student_code(
    student_code: str,
    db: DBSession,
    current_user: CurrentUser,
    model_run_id: int | None = Query(default=None, description="Optional model run; defaults to latest completed"),
    persist: bool = Query(default=False, description="Upsert result into ml.student_dropout_prediction"),
) -> dict:
    """Run live ML dropout inference using student_code (MSSV) instead of internal id."""
    student_id = (
        await db.execute(select(Student.id).where(Student.student_code == student_code.strip()))
    ).scalar_one_or_none()
    if student_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    await _require_student_scope(db, current_user, student_id)
    try:
        result = await asyncio.to_thread(
            predict_dropout_risk_for_student,
            student_id,
            model_run_id=model_run_id,
            persist=persist,
        )
    except DropoutStudentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DropoutModelNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return _dropout_risk_payload(result)


@router.get("/analytics/health/course/{course_id}", summary="Get Course Health Score")
async def read_course_health(course_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Lấy Health Score cho Môn học (dựa trên GPA, Pass Rate và CLO)."""
    await _require_course_scope(db, current_user, course_id)
    try:
        return await get_course_health_score(db, course_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/analytics/health/courses/batch", summary="Get Multiple Course Health Scores")
async def read_course_health_batch(
    db: DBSession,
    current_user: CurrentUser,
    course_ids: list[int] | None = Query(None)
) -> list[dict]:
    """Lấy Health Score cho nhiều Môn học."""
    if not course_ids:
        return []
    for course_id in course_ids or []:
        await _require_course_scope(db, current_user, course_id)
    try:
        return await get_course_health_batch(db, course_ids or [])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/analytics/health/program/{program_id}", summary="Get Program Health Score")
async def read_program_health(program_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Lấy Health Score cho Ngành đào tạo."""
    await _require_program_scope(db, current_user, program_id)
    try:
        return await get_program_health_score(db, program_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/analytics/health/department/{department_id}", summary="Get Department Health Score")
async def read_department_health(department_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Lấy Health Score cho Khoa."""
    await _require_department_scope(db, current_user, department_id)
    try:
        return await get_department_health_score(db, department_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

"""Analytics warehouse and prediction read/operation endpoints."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text

from app.access_control import (
    can_access_course,
    can_access_department,
    can_access_program,
    can_access_section,
    can_access_student,
    get_teacher_for_user,
    user_department_ids,
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
from app.ml.course_risk import score_course_failure_predictions
from app.ml.dropout import predict_dropout_risk_for_student, score_dropout_predictions, train_dropout_model
from app.ml.dropout.score import DropoutModelNotFoundError, DropoutStudentNotFoundError
from app.ml.dropout.types import DropoutRiskResult
from app.ml.scoring import aggregate_student_semester_predictions
from app.models.academic import Course, Program, Semester
from app.models.people import Student, User, UserRole
from app.models.teaching import Enrollment, Section

logger = logging.getLogger(__name__)

router = APIRouter()

settings = get_settings()
_DASHBOARD_CACHE_TTL_SECONDS = settings.dashboard_cache_ttl_seconds
_DASHBOARD_CACHE_MAX_ENTRIES = 512
_dashboard_cache: dict[tuple, tuple[float, dict]] = {}
_dashboard_meta_cache: tuple[float, dict] | None = None
SAFE_DASHBOARD_SQL_FRAGMENTS = frozenset(
    {
        "",
        "1 = 1",
        "dsem.code = :semester_code",
        "dp.department_id = :department_id",
        "ds.program_id = :program_id",
        "ds.cohort_id = :cohort_id",
        "ca.updated_at >= CAST(:date_from AS timestamptz)",
        "ca.updated_at <= CAST(:date_to AS timestamptz)",
        "f.updated_at >= CAST(:date_from AS timestamptz)",
        "f.updated_at <= CAST(:date_to AS timestamptz)",
        "AND p.id = :plo_id",
        "AND 1 = 0",
        "AND dsec.teacher_id = :scope_teacher_id",
        "AND pc.department_id = :scope_department_id",
        "dst.program_id = :program_id",
        "f.course_id = :course_id",
        "f.section_id = :section_id",
        "dsec.teacher_id = :teacher_id",
        "(LOWER(dsec.section_code) LIKE :search OR LOWER(dc.code) LIKE :search OR LOWER(dc.name) LIKE :search)",
        "WHERE risk_level = :risk_level",
        "risk_rank DESC, failed_count DESC, section_code",
        "pass_rate ASC, student_count DESC, section_code",
        "student_count DESC, section_code",
    }
)


def _safe_dashboard_sql_fragment(fragment: str) -> str:
    """Allow only internal SQL fragments; user values must stay bound params."""
    if fragment not in SAFE_DASHBOARD_SQL_FRAGMENTS:
        raise RuntimeError(f"Unsafe dashboard SQL fragment: {fragment!r}")
    return fragment


def _dashboard_where_clause(clauses: list[str], *, prefix: str = "WHERE") -> str:
    for clause in clauses:
        _safe_dashboard_sql_fragment(clause)
    if not clauses:
        return ""
    body = " AND ".join(clauses)
    return f"{prefix} {body}" if prefix else body


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


def _require_dashboard_role(user: CurrentUser) -> None:
    if user.role.value not in {"superadmin", "admin", "manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dashboard analytics are restricted to management roles",
        )


def _is_dashboard_role(user: CurrentUser) -> bool:
    return user.role.value in {"superadmin", "admin", "manager"}


def _is_lecturer_role(user: CurrentUser) -> bool:
    return user.role.value == "lecturer"


async def _scoped_department_filter(
    db: DBSession,
    user: CurrentUser,
    department_id: int | None,
) -> int:
    department_ids = await user_department_ids(db, user)
    if not department_ids:
        _deny_out_of_scope()
    if department_id is not None:
        if department_id not in department_ids:
            _deny_out_of_scope()
        return department_id
    if len(department_ids) == 1:
        return next(iter(department_ids))
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="department_id is required for scoped analytics",
    )


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
    if len(_dashboard_cache) >= _DASHBOARD_CACHE_MAX_ENTRIES:
        oldest_key = min(_dashboard_cache.items(), key=lambda item: item[1][0])[0]
        _dashboard_cache.pop(oldest_key, None)
    _dashboard_cache[key] = (monotonic(), payload)
    return payload


def _dashboard_cache_clear() -> None:
    global _dashboard_meta_cache
    _dashboard_cache.clear()
    _dashboard_meta_cache = None


def _clone_dashboard_meta(payload: dict) -> dict:
    return {
        "departments": [dict(row) for row in payload.get("departments", [])],
        "programs": [dict(row) for row in payload.get("programs", [])],
        "semesters": [dict(row) for row in payload.get("semesters", [])],
        "cohorts": [dict(row) for row in payload.get("cohorts", [])],
    }


@router.api_route("/health", methods=["GET", "HEAD"], tags=["system"])
async def api_health_check() -> dict[str, str]:
    """Return service health (mirrors root /health, useful for load-balancer path-based checks)."""
    return {"status": "ok", "service": "eduinsight-backend", "version": settings.app_version}


@router.get("/analytics/overview")
async def analytics_overview(db: DBSession, current_user: CurrentUser) -> dict[str, int | float | None]:
    """Return top-level analytics from the DWH."""
    _require_dashboard_role(current_user)
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
    current_user: CurrentUser,
    course_id: int | None = None,
    program_id: int | None = None,
    cohort_id: int | None = None,
) -> list[dict]:
    """Return enrollment KPI trends grouped by semester, with optional filters."""
    _require_dashboard_role(current_user)
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
    _validate_dashboard_date_range(date_from, date_to)
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
    return _dashboard_where_clause(clauses), params


def _validate_dashboard_date_range(date_from: str | None, date_to: str | None) -> None:
    """Reject inverted dashboard ranges before issuing an expensive query."""
    if not date_from or not date_to:
        return
    start = _parse_dashboard_datetime(date_from, "date_from")
    end = _parse_dashboard_datetime(date_to, "date_to")
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must be before or equal to date_to",
        )


async def _fetch_all(db: DBSession, sql: str, params: dict | None = None) -> list[dict]:
    result = await db.execute(text(sql), params or {})
    return [dict(row) for row in result.mappings().all()]


async def _fetch_one(db: DBSession, sql: str, params: dict | None = None) -> dict:
    row = (await db.execute(text(sql), params or {})).mappings().one()
    return dict(row)


async def _dashboard_meta(db: DBSession) -> dict:
    global _dashboard_meta_cache
    if _dashboard_meta_cache is not None:
        cached_at, cached_payload = _dashboard_meta_cache
        if monotonic() - cached_at <= _DASHBOARD_CACHE_TTL_SECONDS:
            return _clone_dashboard_meta(cached_payload)
        _dashboard_meta_cache = None

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
        SELECT
            s.id,
            s.code,
            s.name,
            s.year,
            s.term,
            COUNT(f.enrollment_id) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS completed_enrollments
        FROM semesters s
        LEFT JOIN dwh.fact_enrollment_outcome f ON f.semester_id = s.id
        GROUP BY s.id, s.code, s.name, s.year, s.term
        ORDER BY s.year, s.term
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
    payload = {"departments": departments, "programs": programs, "semesters": semesters, "cohorts": cohorts}
    _dashboard_meta_cache = (monotonic(), payload)
    return _clone_dashboard_meta(payload)


@router.get("/analytics/dashboard/overview")
async def analytics_dashboard_overview(
    db: DBSession,
    current_user: CurrentUser,
    semester_code: str | None = None,
    department_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Return pre-aggregated school dashboard metrics from the DWH."""
    _require_dashboard_role(current_user)
    if current_user.role.value == "manager":
        department_id = await _scoped_department_filter(db, current_user, department_id)
    # Payload depends only on the resolved filters (role scoping is folded into
    # department_id above), so entries are shared across users and can be
    # populated by the background prewarm worker.
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
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                    0
                ),
                0
            )::INTEGER AS pass_rate
        FROM filtered f
        JOIN top_programs tp ON tp.program_id = f.program_id
        JOIN dwh.dim_program dp ON dp.program_id = f.program_id
        GROUP BY dp.program_id, dp.name, f.dim_semester_id, f.code, f.year, f.term
        ORDER BY dp.name, f.year, f.term
        """,
        params,
    )

    meta = await _dashboard_meta(db)
    if department_id is not None:
        meta["departments"] = [item for item in meta["departments"] if item["id"] == department_id]
        meta["programs"] = [item for item in meta["programs"] if item["department_id"] == department_id]
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


_prewarm_task: asyncio.Task[None] | None = None


def _prewarm_user() -> User:
    """Synthetic superadmin that only satisfies role checks during prewarm."""
    user = User()
    user.id = "dashboard-prewarm"
    user.email = "prewarm@internal"
    user.full_name = "Dashboard Prewarm"
    user.role = UserRole.superadmin
    user.department_id = None
    user.is_active = True
    return user


def _evict_aging_dashboard_entries() -> None:
    """Retire entries before TTL expiry so the sweep, not a user, recomputes."""
    interval = settings.dashboard_prewarm_interval_seconds
    max_age = max(_DASHBOARD_CACHE_TTL_SECONDS - 2 * interval, interval)
    now = monotonic()
    for key, (cached_at, _) in list(_dashboard_cache.items()):
        if now - cached_at > max_age:
            _dashboard_cache.pop(key, None)


async def _prewarm_default_dashboards() -> None:
    from app.api.v1.endpoints.tree import prewarm_academic_tree

    user = _prewarm_user()
    _evict_aging_dashboard_entries()
    async with AsyncSessionLocal() as db:
        # The academic tree backs the landing page; force-refresh it every
        # sweep because it reads OLTP tables that CRUD edits change directly.
        await prewarm_academic_tree(db, user)
        # Unfiltered default views — what each dashboard page requests first.
        # Each call returns straight from cache when the entry is still warm.
        await analytics_dashboard_overview(db, user)
        await analytics_dashboard_departments(db, user)
        await analytics_dashboard_courses(db, user)
        await analytics_dashboard_sections(
            db, user, q=None, risk_level=None, sort="risk_desc", limit=50, offset=0
        )
        await analytics_dashboard_outcomes(db, user, min_evidence=30)


async def _dashboard_prewarm_loop() -> None:
    interval = settings.dashboard_prewarm_interval_seconds
    await asyncio.sleep(5)
    while True:
        started = monotonic()
        try:
            await _prewarm_default_dashboards()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning("Dashboard prewarm sweep failed", exc_info=True)
        elapsed = monotonic() - started
        await asyncio.sleep(max(interval - elapsed, 30))


async def prewarm_dashboard_cache() -> None:
    """Start the background worker that keeps the default dashboards warm.

    On the Render free instance the cold aggregations take 5–60s, so no user
    request should ever be the one that pays them.
    """
    global _prewarm_task
    if settings.dashboard_prewarm_interval_seconds <= 0:
        return
    if settings.app_env in {"test", "testing"}:
        return
    if settings.database_url.startswith("sqlite"):
        # DWH queries need PostgreSQL; dev SQLite would fail every sweep.
        return
    if _prewarm_task is None or _prewarm_task.done():
        _prewarm_task = asyncio.create_task(_dashboard_prewarm_loop())


async def stop_dashboard_prewarm() -> None:
    """Cancel the prewarm worker (application shutdown)."""
    global _prewarm_task
    if _prewarm_task is not None:
        _prewarm_task.cancel()
        try:
            await _prewarm_task
        except asyncio.CancelledError:
            pass
        _prewarm_task = None


@router.get("/analytics/dashboard/departments")
async def analytics_dashboard_departments(
    db: DBSession,
    current_user: CurrentUser,
    semester_code: str | None = None,
    department_id: int | None = None,
    program_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Return pre-aggregated department dashboard metrics from the DWH."""
    is_scoped_role = current_user.role.value in {"manager", "lecturer"}
    if is_scoped_role:
        department_id = await _scoped_department_filter(db, current_user, department_id)
        if program_id is not None:
            await _require_program_scope(db, current_user, program_id)
    elif not _is_dashboard_role(current_user):
        _require_dashboard_role(current_user)
    cache_key = (
        "departments",
        semester_code,
        department_id,
        program_id,
        date_from,
        date_to,
    )
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
    trend_where_sql, trend_params = _dashboard_filter_sql(
        department_id=department_id,
        program_id=program_id,
    )

    kpis = await _fetch_one(
        db,
        f"""
        WITH filtered AS (
            SELECT f.*
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        )
        SELECT
            COUNT(DISTINCT student_id)::INTEGER AS students,
            COUNT(*) FILTER (WHERE is_passed IS NOT NULL)::INTEGER AS completed_enrollments,
            COUNT(*) FILTER (WHERE is_passed IS TRUE)::INTEGER AS passed_enrollments,
            COUNT(*) FILTER (WHERE is_passed IS FALSE)::INTEGER AS failed_enrollments,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(final_grade) FILTER (WHERE final_grade IS NOT NULL), 2), 0)::FLOAT AS avg_grade,
            COUNT(DISTINCT student_id) FILTER (WHERE is_passed IS FALSE)::INTEGER AS at_risk,
            COALESCE(
                ROUND(
                    COUNT(DISTINCT student_id) FILTER (WHERE is_passed IS FALSE)::DECIMAL
                    / NULLIF(COUNT(DISTINCT student_id), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS at_risk_rate
        FROM filtered
        """,
        params,
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
            COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS enrollment_count,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(f.final_grade) FILTER (WHERE f.final_grade IS NOT NULL), 2), 0)::FLOAT AS avg_grade,
            COUNT(DISTINCT f.student_id) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS at_risk,
            COALESCE(
                ROUND(
                    COUNT(DISTINCT f.student_id) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL
                    / NULLIF(COUNT(DISTINCT f.student_id), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS at_risk_rate
        FROM filtered f
        JOIN departments dep ON dep.id = f.department_id
        WHERE dep.is_active IS TRUE
        GROUP BY dep.id, dep.name
        ORDER BY pass_rate ASC, student_count DESC
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
            {trend_where_sql}
        )
        SELECT
            dim_semester_id AS id,
            code AS semester,
            year,
            term,
            COUNT(*) FILTER (WHERE is_passed IS NOT NULL)::INTEGER AS count,
            COUNT(DISTINCT department_id)::INTEGER AS department_count,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS pass_rate,
            COALESCE(ROUND(AVG(final_grade) FILTER (WHERE final_grade IS NOT NULL), 2), 0)::FLOAT AS avg_grade
        FROM filtered
        GROUP BY dim_semester_id, code, year, term
        ORDER BY year, term
        """,
        trend_params,
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
            COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS total,
            COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed,
            COALESCE(
                ROUND(
                    COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                    1
                ),
                0
            )::FLOAT AS rate
        FROM filtered f
        JOIN dwh.dim_course dc ON dc.course_id = f.course_id
        GROUP BY dc.course_id, dc.name
        HAVING COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL) >= 20
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
                COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS total,
                COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed
            FROM filtered f
            GROUP BY f.section_id, f.course_id
            HAVING COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL) >= 10
        ),
        course_stats AS (
            SELECT
                f.course_id,
                COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS total,
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
    if is_scoped_role:
        meta["departments"] = [item for item in meta["departments"] if item["id"] == department_id]
        meta["programs"] = [item for item in meta["programs"] if item["department_id"] == department_id]
    return _dashboard_cache_set(cache_key, {
        **meta,
        "kpis": kpis,
        "dept_stats": dept_stats,
        "trend": trend,
        "heatmap": heatmap,
        "drill_course_fail": drill_course_fail,
        "drill_section_abnormal": drill_section_abnormal,
    })



@router.get("/analytics/dashboard/outcomes")
async def analytics_dashboard_outcomes(
    db: DBSession,
    current_user: CurrentUser,
    semester_code: str | None = None,
    department_id: int | None = None,
    program_id: int | None = None,
    plo_id: int | None = None,
    min_evidence: int = Query(default=30, ge=1, le=1000),
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Return CLO/PLO outcome assessment aggregates for managers and QA review."""
    _require_dashboard_role(current_user)
    if current_user.role.value == "manager":
        department_id = await _scoped_department_filter(db, current_user, department_id)
    if program_id is not None:
        await _require_program_scope(db, current_user, program_id)

    cache_key = (
        "outcomes",
        semester_code,
        department_id,
        program_id,
        plo_id,
        min_evidence,
        date_from,
        date_to,
    )
    cached = _dashboard_cache_get(cache_key)
    if cached is not None:
        return cached

    _validate_dashboard_date_range(date_from, date_to)
    clauses: list[str] = []
    trend_clauses: list[str] = []
    params: dict = {"min_evidence": min_evidence}
    if semester_code:
        clauses.append("dsem.code = :semester_code")
        params["semester_code"] = semester_code
    if department_id is not None:
        clauses.append("dp.department_id = :department_id")
        trend_clauses.append("dp.department_id = :department_id")
        params["department_id"] = department_id
    if program_id is not None:
        clauses.append("ds.program_id = :program_id")
        trend_clauses.append("ds.program_id = :program_id")
        params["program_id"] = program_id
    if date_from:
        clauses.append("ca.updated_at >= CAST(:date_from AS timestamptz)")
        trend_clauses.append("ca.updated_at >= CAST(:date_from AS timestamptz)")
        params["date_from"] = _parse_dashboard_datetime(date_from, "date_from")
    if date_to:
        clauses.append("ca.updated_at <= CAST(:date_to AS timestamptz)")
        trend_clauses.append("ca.updated_at <= CAST(:date_to AS timestamptz)")
        params["date_to"] = _parse_dashboard_datetime(date_to, "date_to")
    if plo_id is not None:
        params["plo_id"] = plo_id

    where_sql = _dashboard_where_clause(clauses)
    trend_where_sql = _dashboard_where_clause(trend_clauses)
    plo_filter_sql = _safe_dashboard_sql_fragment("AND p.id = :plo_id") if plo_id is not None else ""

    base_cte = f"""
        WITH filtered_clo AS (
            SELECT
                ca.*,
                ds.program_id,
                ds.cohort_id,
                dp.department_id,
                dsem.code AS semester,
                dsem.year,
                dsem.term
            FROM dwh.fact_clo_achievement ca
            JOIN dwh.dim_student ds ON ds.student_id = ca.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = ca.semester_id
            {where_sql}
        ),
        mapped AS (
            SELECT
                fc.*,
                p.id AS plo_id,
                p.code AS plo_code,
                p.name AS plo_name,
                cl.id AS mapped_clo_id,
                cl.code AS clo_code,
                cl.name AS clo_name,
                dc.code AS course_code,
                dc.name AS course_name,
                COALESCE(cpm.contribution, 1.0) AS contribution
            FROM filtered_clo fc
            JOIN clo_plo_mappings cpm ON cpm.clo_id = fc.clo_id
            JOIN plos p ON p.id = cpm.plo_id AND p.program_id = fc.program_id
            JOIN clos cl ON cl.id = fc.clo_id
            JOIN dwh.dim_course dc ON dc.course_id = fc.course_id
            WHERE cl.is_active IS TRUE
            {plo_filter_sql}
        )
    """

    trend_cte = f"""
        WITH filtered_clo AS (
            SELECT
                ca.*,
                ds.program_id,
                dp.department_id,
                dsem.code AS semester,
                dsem.year,
                dsem.term
            FROM dwh.fact_clo_achievement ca
            JOIN dwh.dim_student ds ON ds.student_id = ca.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = ca.semester_id
            {trend_where_sql}
        ),
        mapped AS (
            SELECT
                fc.*,
                p.id AS plo_id,
                p.code AS plo_code,
                p.name AS plo_name,
                COALESCE(cpm.contribution, 1.0) AS contribution
            FROM filtered_clo fc
            JOIN clo_plo_mappings cpm ON cpm.clo_id = fc.clo_id
            JOIN plos p ON p.id = cpm.plo_id AND p.program_id = fc.program_id
            JOIN clos cl ON cl.id = fc.clo_id
            WHERE cl.is_active IS TRUE
            {plo_filter_sql}
        )
    """

    kpis = await _fetch_one(
        db,
        f"""
        {base_cte}
        SELECT
            COUNT(DISTINCT program_id)::INTEGER AS programs_with_evidence,
            COUNT(DISTINCT plo_id)::INTEGER AS plos_with_evidence,
            COUNT(DISTINCT mapped_clo_id)::INTEGER AS clos_with_evidence,
            COUNT(DISTINCT course_id)::INTEGER AS courses_with_evidence,
            COUNT(*)::INTEGER AS evidence_count,
            COUNT(DISTINCT student_id)::INTEGER AS student_count,
            COALESCE(
                ROUND(SUM(CASE WHEN is_achieved IS TRUE THEN contribution ELSE 0 END)::DECIMAL
                    / NULLIF(SUM(contribution), 0) * 100, 1),
                0
            )::FLOAT AS attainment_pct,
            0::INTEGER AS plos_at_target
        FROM mapped
        """,
        params,
    )

    plo_rows = await _fetch_all(
        db,
        f"""
        {base_cte}
        SELECT
            d.id AS department_id,
            d.name AS department_name,
            dp.program_id,
            dp.code AS program_code,
            dp.name AS program_name,
            plo_id,
            plo_code,
            plo_name,
            COUNT(*)::INTEGER AS evidence_count,
            COUNT(DISTINCT student_id)::INTEGER AS student_count,
            COUNT(DISTINCT course_id)::INTEGER AS course_count,
            COUNT(DISTINCT semester_id)::INTEGER AS semester_count,
            ROUND(AVG(achievement_score), 2)::FLOAT AS avg_score,
            COALESCE(
                ROUND(SUM(CASE WHEN is_achieved IS TRUE THEN contribution ELSE 0 END)::DECIMAL
                    / NULLIF(SUM(contribution), 0) * 100, 1),
                0
            )::FLOAT AS attainment_pct
        FROM mapped m
        JOIN dwh.dim_program dp ON dp.program_id = m.program_id
        LEFT JOIN departments d ON d.id = dp.department_id
        GROUP BY d.id, d.name, dp.program_id, dp.code, dp.name, plo_id, plo_code, plo_name
        HAVING COUNT(*) >= :min_evidence
        ORDER BY attainment_pct ASC, evidence_count DESC, program_name, plo_code
        LIMIT 300
        """,
        params,
    )

    plo_trend = await _fetch_all(
        db,
        f"""
        {trend_cte}
        SELECT
            dp.program_id,
            dp.code AS program_code,
            dp.name AS program_name,
            plo_id,
            plo_code,
            plo_name,
            semester,
            year,
            term,
            COUNT(*)::INTEGER AS evidence_count,
            COALESCE(
                ROUND(SUM(CASE WHEN is_achieved IS TRUE THEN contribution ELSE 0 END)::DECIMAL
                    / NULLIF(SUM(contribution), 0) * 100, 1),
                0
            )::FLOAT AS attainment_pct
        FROM mapped m
        JOIN dwh.dim_program dp ON dp.program_id = m.program_id
        GROUP BY dp.program_id, dp.code, dp.name, plo_id, plo_code, plo_name, semester, year, term
        HAVING COUNT(*) >= :min_evidence
        ORDER BY year, term, program_name, plo_code
        LIMIT 800
        """,
        params,
    )

    driver_courses = await _fetch_all(
        db,
        f"""
        {base_cte}
        SELECT
            dp.program_id,
            dp.code AS program_code,
            dp.name AS program_name,
            plo_id,
            plo_code,
            plo_name,
            course_id,
            course_code,
            course_name,
            COUNT(*)::INTEGER AS evidence_count,
            COUNT(DISTINCT student_id)::INTEGER AS student_count,
            COALESCE(
                ROUND(SUM(CASE WHEN is_achieved IS TRUE THEN contribution ELSE 0 END)::DECIMAL
                    / NULLIF(SUM(contribution), 0) * 100, 1),
                0
            )::FLOAT AS attainment_pct
        FROM mapped m
        JOIN dwh.dim_program dp ON dp.program_id = m.program_id
        GROUP BY dp.program_id, dp.code, dp.name, plo_id, plo_code, plo_name, course_id, course_code, course_name
        HAVING COUNT(*) >= :min_evidence
        ORDER BY attainment_pct ASC, evidence_count DESC
        LIMIT 120
        """,
        params,
    )

    driver_clos = await _fetch_all(
        db,
        f"""
        {base_cte}
        SELECT
            dp.program_id,
            dp.code AS program_code,
            dp.name AS program_name,
            plo_id,
            plo_code,
            course_id,
            course_code,
            course_name,
            mapped_clo_id AS clo_id,
            clo_code,
            clo_name,
            COUNT(*)::INTEGER AS evidence_count,
            COALESCE(
                ROUND(SUM(CASE WHEN is_achieved IS TRUE THEN contribution ELSE 0 END)::DECIMAL
                    / NULLIF(SUM(contribution), 0) * 100, 1),
                0
            )::FLOAT AS attainment_pct
        FROM mapped m
        JOIN dwh.dim_program dp ON dp.program_id = m.program_id
        GROUP BY dp.program_id, dp.code, dp.name, plo_id, plo_code, course_id, course_code, course_name, mapped_clo_id, clo_code, clo_name
        HAVING COUNT(*) >= :min_evidence
        ORDER BY attainment_pct ASC, evidence_count DESC
        LIMIT 160
        """,
        params,
    )

    quality_rows = await _fetch_all(
        db,
        """
        WITH program_scope AS (
            SELECT dp.program_id, dp.code, dp.name, dp.department_id
            FROM dwh.dim_program dp
            WHERE (CAST(:department_id AS INTEGER) IS NULL OR dp.department_id = CAST(:department_id AS INTEGER))
              AND (CAST(:program_id AS INTEGER) IS NULL OR dp.program_id = CAST(:program_id AS INTEGER))
        ),
        plo_counts AS (
            SELECT ps.program_id, COUNT(DISTINCT p.id) AS plo_count, COUNT(DISTINCT cpm.clo_id) AS mapped_clo_count
            FROM program_scope ps
            LEFT JOIN plos p ON p.program_id = ps.program_id
            LEFT JOIN clo_plo_mappings cpm ON cpm.plo_id = p.id
            GROUP BY ps.program_id
        ),
        course_counts AS (
            SELECT ps.program_id,
                COUNT(DISTINCT pc.course_id) AS program_courses,
                COUNT(DISTINCT pc.course_id) FILTER (WHERE cl.id IS NOT NULL) AS courses_with_clo,
                COUNT(DISTINCT pc.course_id) FILTER (WHERE gccm.clo_id IS NOT NULL) AS courses_with_component_clo_mapping
            FROM program_scope ps
            LEFT JOIN program_courses pc ON pc.program_id = ps.program_id
            LEFT JOIN clos cl ON cl.course_id = pc.course_id AND cl.is_active IS TRUE
            LEFT JOIN grade_component_clo_mappings gccm ON gccm.clo_id = cl.id
            GROUP BY ps.program_id
        ),
        evidence_counts AS (
            SELECT ds.program_id,
                COUNT(*) AS evidence_count,
                COUNT(DISTINCT ca.course_id) AS courses_with_evidence,
                COUNT(DISTINCT ca.student_id) AS students_with_evidence,
                COUNT(DISTINCT ca.semester_id) AS semesters_with_evidence
            FROM dwh.fact_clo_achievement ca
            JOIN dwh.dim_student ds ON ds.student_id = ca.student_id
            JOIN program_scope ps ON ps.program_id = ds.program_id
            GROUP BY ds.program_id
        )
        SELECT
            d.id AS department_id,
            d.name AS department_name,
            ps.program_id,
            ps.code AS program_code,
            ps.name AS program_name,
            COALESCE(pc.plo_count, 0)::INTEGER AS plo_count,
            COALESCE(cc.program_courses, 0)::INTEGER AS program_courses,
            COALESCE(cc.courses_with_clo, 0)::INTEGER AS courses_with_clo,
            COALESCE(cc.courses_with_component_clo_mapping, 0)::INTEGER AS courses_with_component_clo_mapping,
            COALESCE(pc.mapped_clo_count, 0)::INTEGER AS mapped_clo_count,
            COALESCE(ec.evidence_count, 0)::INTEGER AS evidence_count,
            COALESCE(ec.courses_with_evidence, 0)::INTEGER AS courses_with_evidence,
            COALESCE(ec.students_with_evidence, 0)::INTEGER AS students_with_evidence,
            COALESCE(ec.semesters_with_evidence, 0)::INTEGER AS semesters_with_evidence,
            CASE
                WHEN COALESCE(pc.plo_count, 0) > 0
                  AND COALESCE(pc.mapped_clo_count, 0) > 0
                  AND COALESCE(ec.evidence_count, 0) >= :min_evidence THEN 'ready'
                WHEN COALESCE(pc.plo_count, 0) > 0
                  OR COALESCE(cc.courses_with_clo, 0) > 0
                  OR COALESCE(ec.evidence_count, 0) > 0 THEN 'partial'
                ELSE 'missing'
            END AS data_status
        FROM program_scope ps
        LEFT JOIN departments d ON d.id = ps.department_id
        LEFT JOIN plo_counts pc ON pc.program_id = ps.program_id
        LEFT JOIN course_counts cc ON cc.program_id = ps.program_id
        LEFT JOIN evidence_counts ec ON ec.program_id = ps.program_id
        ORDER BY data_status, evidence_count DESC, program_name
        """,
        {"department_id": department_id, "program_id": program_id, "min_evidence": min_evidence},
    )

    kpis["plos_at_target"] = len({
        (row["program_id"], row["plo_id"])
        for row in plo_rows
        if row["attainment_pct"] >= 70
    })

    meta = await _dashboard_meta(db)
    if department_id is not None:
        meta["departments"] = [item for item in meta["departments"] if item["id"] == department_id]
        meta["programs"] = [item for item in meta["programs"] if item["department_id"] == department_id]
    payload = {
        **meta,
        "kpis": kpis,
        "plo_rows": plo_rows,
        "plo_trend": plo_trend,
        "driver_courses": driver_courses,
        "driver_clos": driver_clos,
        "quality_rows": quality_rows,
        "data_status": "ready" if kpis["evidence_count"] else "partial",
        "warnings": [
            "CLO/PLO attainment is computed evidence from grade component mappings; use official review before academic conclusions.",
            "Programs with partial/missing quality rows need mapping or evidence completion before accreditation use.",
        ],
    }
    return _dashboard_cache_set(cache_key, payload)


@router.get("/analytics/dashboard/programs/{program_id}")
async def analytics_dashboard_program(
    program_id: int,
    db: DBSession,
    current_user: CurrentUser,
    semester_code: str | None = None,
    cohort_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Return pre-aggregated program dashboard metrics from the DWH."""
    if not (_is_dashboard_role(current_user) or _is_lecturer_role(current_user)):
        _require_dashboard_role(current_user)
    await _require_program_scope(db, current_user, program_id)
    cache_key = (
        "program",
        program_id,
        semester_code,
        cohort_id,
        date_from,
        date_to,
    )
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


async def _analytics_dashboard_courses_payload(
    db: DBSession,
    *,
    course_id: int | None = None,
    semester_code: str | None = None,
    department_id: int | None = None,
    program_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    section_ids: set[int] | None = None,
) -> dict:
    min_course_sample_size = 20
    where_sql, params = _dashboard_filter_sql(
        semester_code=semester_code,
        department_id=department_id,
        program_id=program_id,
        date_from=date_from,
        date_to=date_to,
    )
    trend_where_sql, trend_params = _dashboard_filter_sql(
        department_id=department_id,
        program_id=program_id,
        date_from=date_from,
        date_to=date_to,
    )
    if course_id is not None:
        params["course_id"] = course_id
        trend_params["course_id"] = course_id
    params["min_course_sample_size"] = min_course_sample_size

    course_filter = "WHERE cb.course_id = :course_id" if course_id is not None else ""
    clo_where_sql = where_sql.replace("f.updated_at", "ca.updated_at")
    trend_clo_where_sql = trend_where_sql.replace("f.updated_at", "ca.updated_at")
    if section_ids is not None:
        if section_ids:
            placeholders = []
            for index, section_id in enumerate(sorted(section_ids)):
                key = f"scope_section_{index}"
                placeholders.append(f":{key}")
                params[key] = section_id
                trend_params[key] = section_id
            values = ", ".join(placeholders)
            enrollment_scope = f"f.section_id IN ({values})"
            clo_scope = f"ca.section_id IN ({values})"
        else:
            enrollment_scope = "1 = 0"
            clo_scope = "1 = 0"
        where_sql = f"{where_sql} AND {enrollment_scope}" if where_sql else f"WHERE {enrollment_scope}"
        clo_where_sql = f"{clo_where_sql} AND {clo_scope}" if clo_where_sql else f"WHERE {clo_scope}"
        trend_where_sql = (
            f"{trend_where_sql} AND {enrollment_scope}" if trend_where_sql else f"WHERE {enrollment_scope}"
        )
        trend_clo_where_sql = (
            f"{trend_clo_where_sql} AND {clo_scope}" if trend_clo_where_sql else f"WHERE {clo_scope}"
        )
    filtered_cte = f"""
        WITH filtered AS (
            SELECT f.*, ds.program_id, dp.department_id, dsem.code AS semester_code
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            {where_sql}
        ),
        filtered_clo AS (
            SELECT ca.*, ds.program_id, dp.department_id, dsem.code AS semester_code
            FROM dwh.fact_clo_achievement ca
            JOIN dwh.dim_student ds ON ds.student_id = ca.student_id
            JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = ca.semester_id
            {clo_where_sql}
        ),
        course_base AS (
            SELECT
                f.course_id,
                COUNT(*)::INTEGER AS enrollment_count,
                COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS completed_enrollments,
                COUNT(*) FILTER (WHERE f.final_grade IS NULL OR f.is_passed IS NULL)::INTEGER AS missing_grade_count,
                COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::INTEGER AS passed_count,
                COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed_count,
                COUNT(*) FILTER (WHERE f.final_grade >= 4 AND f.final_grade < 5)::INTEGER AS near_fail_count,
                COUNT(DISTINCT f.section_id)::INTEGER AS section_count,
                COALESCE(ROUND(AVG(f.final_grade), 2), 0)::FLOAT AS avg_grade,
                COALESCE(
                    ROUND(
                        COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL
                        / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                        1
                    ),
                    0
                )::FLOAT AS pass_rate
            FROM filtered f
            GROUP BY f.course_id
            HAVING COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL) > 0
        ),
        clo_base AS (
            SELECT
                course_id,
                COUNT(*) FILTER (WHERE is_achieved IS NOT NULL)::INTEGER AS clo_evidence_count,
                ROUND(
                    COUNT(*) FILTER (WHERE is_achieved IS TRUE)::DECIMAL
                    / NULLIF(COUNT(*) FILTER (WHERE is_achieved IS NOT NULL), 0),
                    4
                )::FLOAT AS clo_attainment_rate
            FROM filtered_clo
            GROUP BY course_id
        )
    """

    course_rows = await _fetch_all(
        db,
        f"""
        {filtered_cte}
        SELECT
            dc.course_id AS id,
            dc.code,
            dc.name,
            dc.credits,
            cb.enrollment_count,
            cb.completed_enrollments,
            cb.missing_grade_count,
            cb.pass_rate,
            cb.avg_grade,
            cb.failed_count,
            cb.near_fail_count,
            cb.section_count,
            clo.clo_attainment_rate,
            COALESCE(clo.clo_evidence_count, 0)::INTEGER AS clo_evidence_count,
            CASE
                WHEN cb.completed_enrollments < :min_course_sample_size THEN 'insufficient_sample'
                WHEN COALESCE(clo.clo_evidence_count, 0) = 0 THEN 'missing_clo'
                ELSE 'ready'
            END AS data_status,
            CASE
                WHEN cb.completed_enrollments >= :min_course_sample_size
                    AND COALESCE(clo.clo_evidence_count, 0) > 0
                THEN ROUND(
                    (
                        (cb.avg_grade / 10.0 * 40)
                        + (cb.pass_rate / 100.0 * 30)
                        + (clo.clo_attainment_rate * 30)
                    )::NUMERIC,
                    1
                )::FLOAT
                ELSE NULL
            END AS health_score
        FROM course_base cb
        JOIN dwh.dim_course dc ON dc.course_id = cb.course_id
        LEFT JOIN clo_base clo ON clo.course_id = cb.course_id
        {course_filter}
        ORDER BY health_score ASC, cb.failed_count DESC, cb.pass_rate ASC, dc.name
        LIMIT 1000
        """,
        params,
    )

    selected_course = None
    if course_id is not None:
        course = (
            await db.execute(
                text(
                    """
                    SELECT course_id AS id, code, name, credits
                    FROM dwh.dim_course
                    WHERE course_id = :course_id
                    """
                ),
                {"course_id": course_id},
            )
        ).mappings().one_or_none()
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        selected_where = "WHERE cb.course_id = :course_id"
        kpis = await _fetch_one(
            db,
            f"""
            {filtered_cte}
            SELECT
                COALESCE(MAX(completed_enrollments), 0)::INTEGER AS completed_enrollments,
                COALESCE(MAX(enrollment_count), 0)::INTEGER AS enrollment_count,
                COALESCE(MAX(missing_grade_count), 0)::INTEGER AS missing_grade_count,
                COALESCE(MAX(pass_rate), 0)::FLOAT AS pass_rate,
                COALESCE(MAX(avg_grade), 0)::FLOAT AS avg_grade,
                COALESCE(MAX(section_count), 0)::INTEGER AS section_count,
                COALESCE(MAX(failed_count), 0)::INTEGER AS failed_count,
                COALESCE(MAX(near_fail_count), 0)::INTEGER AS near_fail_count,
                MAX(clo.clo_attainment_rate)::FLOAT AS clo_attainment_rate,
                COALESCE(MAX(clo.clo_evidence_count), 0)::INTEGER AS clo_evidence_count,
                CASE
                    WHEN COALESCE(MAX(completed_enrollments), 0) < :min_course_sample_size
                        THEN 'insufficient_sample'
                    WHEN COALESCE(MAX(clo.clo_evidence_count), 0) = 0 THEN 'missing_clo'
                    ELSE 'ready'
                END AS data_status,
                CASE
                    WHEN COALESCE(MAX(completed_enrollments), 0) >= :min_course_sample_size
                        AND COALESCE(MAX(clo.clo_evidence_count), 0) > 0
                    THEN ROUND(
                        (
                            (COALESCE(MAX(avg_grade), 0) / 10.0 * 40)
                            + (COALESCE(MAX(pass_rate), 0) / 100.0 * 30)
                            + (MAX(clo.clo_attainment_rate) * 30)
                        )::NUMERIC,
                        1
                    )::FLOAT
                    ELSE NULL
                END AS health_score
            FROM course_base cb
            LEFT JOIN clo_base clo ON clo.course_id = cb.course_id
            {selected_where}
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
                JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
                JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
                {trend_where_sql}
            )
            SELECT
                dim_semester_id AS id,
                code AS semester,
                year,
                term,
                COUNT(*) FILTER (WHERE is_passed IS NOT NULL)::INTEGER AS count,
                COUNT(*) FILTER (WHERE is_passed IS FALSE)::INTEGER AS failed_count,
                COUNT(*) FILTER (WHERE final_grade >= 4 AND final_grade < 5)::INTEGER AS near_fail_count,
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
            WHERE course_id = :course_id AND is_passed IS NOT NULL
            GROUP BY dim_semester_id, code, year, term
            ORDER BY year, term
            """,
            trend_params,
        )

        clo_trend = await _fetch_all(
            db,
            f"""
            WITH filtered AS (
                SELECT ca.*, dsem.code AS semester, dsem.year, dsem.term
                FROM dwh.fact_clo_achievement ca
                JOIN dwh.dim_student ds ON ds.student_id = ca.student_id
                JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
                JOIN dwh.dim_semester dsem ON dsem.semester_id = ca.semester_id
                {trend_clo_where_sql}
            )
            SELECT
                c.id AS clo_id,
                c.code AS clo_code,
                c.name AS clo_name,
                f.semester,
                f.year,
                f.term,
                COUNT(f.is_achieved)::INTEGER AS evidence_count,
                ROUND(
                    COUNT(*) FILTER (WHERE f.is_achieved IS TRUE)::DECIMAL
                    / NULLIF(COUNT(f.is_achieved), 0) * 100,
                    1
                )::FLOAT AS attainment_rate
            FROM filtered f
            JOIN clos c ON c.id = f.clo_id
            WHERE f.course_id = :course_id AND c.is_active IS TRUE
            GROUP BY c.id, c.code, c.name, c.sort_order, f.semester, f.year, f.term
            ORDER BY c.sort_order, c.code, f.year, f.term
            """,
            trend_params,
        )

        clo_rows = await _fetch_all(
            db,
            f"""
            {filtered_cte}
            SELECT
                c.id,
                c.code,
                c.name,
                COUNT(fc.is_achieved)::INTEGER AS evidence_count,
                ROUND(AVG(fc.achievement_score), 2)::FLOAT AS avg_score,
                ROUND(
                    COUNT(*) FILTER (WHERE fc.is_achieved IS TRUE)::DECIMAL
                    / NULLIF(COUNT(fc.is_achieved), 0) * 100,
                    1
                )::FLOAT AS attainment_rate
            FROM clos c
            LEFT JOIN filtered_clo fc ON fc.clo_id = c.id AND fc.course_id = c.course_id
            WHERE c.course_id = :course_id AND c.is_active IS TRUE
            GROUP BY c.id, c.code, c.name, c.sort_order
            ORDER BY c.sort_order, c.code
            """,
            params,
        )

        grade_distribution = await _fetch_all(
            db,
            f"""
            WITH filtered AS (
                SELECT f.course_id, f.final_grade
                FROM dwh.fact_enrollment_outcome f
                JOIN dwh.dim_student ds ON ds.student_id = f.student_id
                JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
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
                WHERE course_id = :course_id AND final_grade IS NOT NULL
            ) s
            GROUP BY bucket
            ORDER BY MIN(CASE bucket WHEN 'Trượt nặng' THEN 1 WHEN 'Cận trượt' THEN 2 WHEN 'Trung bình' THEN 3 WHEN 'Khá' THEN 4 ELSE 5 END)
            """,
            params,
        )

        section_rows = await _fetch_all(
            db,
            f"""
            WITH filtered AS (
                SELECT f.*, dsem.semester_id AS dim_semester_id, dsem.code AS semester_code, dsem.name AS semester_name, dsem.year, dsem.term
                FROM dwh.fact_enrollment_outcome f
                JOIN dwh.dim_student ds ON ds.student_id = f.student_id
                JOIN dwh.dim_program dp ON dp.program_id = ds.program_id
                JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
                {where_sql}
            ),
            course_avg AS (
                SELECT
                    COALESCE(
                        COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL
                        / NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) * 100,
                        0
                    ) AS pass_rate
                FROM filtered
                WHERE course_id = :course_id
            )
            SELECT
                f.section_id AS id,
                dsec.section_code,
                f.semester_id,
                f.semester_code,
                f.semester_name,
                COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS completed_enrollments,
                COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed_count,
                COALESCE(
                    ROUND(
                        COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL
                        / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                        1
                    ),
                    0
                )::FLOAT AS pass_rate,
                COALESCE(ROUND(AVG(f.final_grade), 2), 0)::FLOAT AS avg_grade,
                COALESCE(
                    ROUND(
                        (
                            COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL
                            / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100
                        ) - (SELECT pass_rate FROM course_avg),
                        1
                    ),
                    0
                )::FLOAT AS pass_rate_diff
            FROM filtered f
            JOIN dwh.dim_section dsec ON dsec.section_id = f.section_id
            WHERE f.course_id = :course_id
            GROUP BY f.section_id, dsec.section_code, f.semester_id, f.semester_code, f.semester_name
            HAVING COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL) > 0
            ORDER BY pass_rate ASC, failed_count DESC, f.semester_code DESC
            LIMIT 200
            """,
            params,
        )

        selected_course = {
            "course": dict(course),
            "kpis": kpis,
            "trend": trend,
            "clo_trend": clo_trend,
            "clo_rows": clo_rows,
            "grade_distribution": grade_distribution,
            "section_rows": section_rows,
        }

    meta = await _dashboard_meta(db)
    return {
        **meta,
        "filters": {
            "semester_code": semester_code,
            "department_id": department_id,
            "program_id": program_id,
            "course_id": course_id,
            "date_from": date_from,
            "date_to": date_to,
        },
        "course_rows": course_rows,
        "selected_course": selected_course,
    }


@router.get("/analytics/dashboard/courses")
async def analytics_dashboard_courses(
    db: DBSession,
    current_user: CurrentUser,
    semester_code: str | None = None,
    department_id: int | None = None,
    program_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Return DWH-backed aggregate metrics for course analytics."""
    if _is_lecturer_role(current_user):
        department_id = await _scoped_department_filter(db, current_user, department_id)
    elif current_user.role.value == "manager":
        department_id = await _scoped_department_filter(db, current_user, department_id)
    elif not _is_dashboard_role(current_user):
        _require_dashboard_role(current_user)
    if program_id is not None:
        await _require_program_scope(db, current_user, program_id)
    cache_key = ("courses-v3", semester_code, department_id, program_id, date_from, date_to)
    cached = _dashboard_cache_get(cache_key)
    if cached is not None:
        return cached
    payload = await _analytics_dashboard_courses_payload(
        db,
        semester_code=semester_code,
        department_id=department_id,
        program_id=program_id,
        date_from=date_from,
        date_to=date_to,
    )
    return _dashboard_cache_set(cache_key, payload)


@router.get("/analytics/dashboard/courses/{course_id}")
async def analytics_dashboard_course_detail(
    course_id: int,
    db: DBSession,
    current_user: CurrentUser,
    semester_code: str | None = None,
    department_id: int | None = None,
    program_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Return DWH-backed aggregate metrics for one course."""
    if not (_is_dashboard_role(current_user) or _is_lecturer_role(current_user)):
        _require_dashboard_role(current_user)
    await _require_course_scope(db, current_user, course_id)
    if _is_lecturer_role(current_user):
        department_id = await _scoped_department_filter(db, current_user, department_id)
    elif current_user.role.value == "manager":
        department_id = await _scoped_department_filter(db, current_user, department_id)
    if program_id is not None:
        await _require_program_scope(db, current_user, program_id)
    cache_key = (
        "course-detail-v3",
        course_id,
        semester_code,
        department_id,
        program_id,
        date_from,
        date_to,
    )
    cached = _dashboard_cache_get(cache_key)
    if cached is not None:
        return cached
    payload = await _analytics_dashboard_courses_payload(
        db,
        course_id=course_id,
        semester_code=semester_code,
        department_id=department_id,
        program_id=program_id,
        date_from=date_from,
        date_to=date_to,
    )
    return _dashboard_cache_set(cache_key, payload)


def _section_data_status(stats: dict | None) -> tuple[str, list[str]]:
    if not stats or int(stats.get("total_sections") or 0) == 0:
        return "empty", []
    warnings: list[str] = []
    if int(stats.get("missing_grade_count") or 0) > 0:
        warnings.append("Một số lớp còn thiếu điểm tổng kết.")
    if int(stats.get("low_coverage_sections") or 0) > 0:
        warnings.append("Độ phủ dự đoán ML chưa đạt 90%.")
    if int(stats.get("small_sections") or 0) > 0:
        warnings.append("Một số lớp có cỡ mẫu dưới 20 sinh viên.")
    return ("partial" if warnings else "ready"), warnings


async def _section_etl_warning(db: DBSession) -> tuple[bool, str | None]:
    rows = await _fetch_all(
        db,
        """
        SELECT completed_at
        FROM dwh.etl_run
        WHERE status = 'completed'
        ORDER BY completed_at DESC NULLS LAST
        LIMIT 1
        """,
    )
    if not rows:
        return True, "Chưa có lần ETL DWH hoàn tất."
    row = rows[0]
    completed_at = row.get("completed_at")
    if completed_at is None:
        return True, "Chưa có lần ETL DWH hoàn tất."
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=UTC)
    if datetime.now(UTC) - completed_at > timedelta(hours=24):
        return True, "Dữ liệu DWH đã quá 24 giờ; cần chạy refresh."
    return False, None


async def _section_scope_clause(
    db: DBSession,
    current_user: CurrentUser,
    department_id: int | None,
) -> tuple[str, dict]:
    if _is_lecturer_role(current_user):
        teacher = await get_teacher_for_user(db, current_user)
        if teacher is None:
            return "AND 1 = 0", {}
        if department_id is not None and department_id != teacher.department_id:
            _deny_out_of_scope()
        return "AND dsec.teacher_id = :scope_teacher_id", {"scope_teacher_id": teacher.id}
    if current_user.role.value == "manager":
        scoped_department = await _scoped_department_filter(db, current_user, department_id)
        return "AND pc.department_id = :scope_department_id", {"scope_department_id": scoped_department}
    _require_dashboard_role(current_user)
    if department_id is not None:
        await _require_department_scope(db, current_user, department_id)
        return "AND pc.department_id = :scope_department_id", {"scope_department_id": department_id}
    return "", {}


async def _require_section_filter_entities(
    db: DBSession,
    *,
    semester_code: str | None,
    program_id: int | None,
    course_id: int | None,
    section_id: int | None,
) -> None:
    checks = (
        (Semester, Semester.code, semester_code, "Semester"),
        (Program, Program.id, program_id, "Program"),
        (Course, Course.id, course_id, "Course"),
        (Section, Section.id, section_id, "Section"),
    )
    for model, column, value, label in checks:
        if value is None:
            continue
        exists = (await db.execute(select(model).where(column == value).limit(1))).scalar_one_or_none()
        if exists is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")


def _section_hierarchy_level(current_user: CurrentUser, department_id: int | None, program_id: int | None) -> str:
    """Choose the next useful drill-down dimension for the actor and current scope."""
    if _is_lecturer_role(current_user):
        return "course"
    if current_user.role.value == "manager":
        return "course" if program_id is not None else "program"
    if department_id is None:
        return "department"
    return "course" if program_id is not None else "program"


@router.get("/analytics/dashboard/sections")
async def analytics_dashboard_sections(
    db: DBSession,
    current_user: CurrentUser,
    semester_code: str | None = None,
    department_id: int | None = None,
    program_id: int | None = None,
    course_id: int | None = None,
    section_id: int | None = None,
    teacher_id: int | None = None,
    q: str | None = Query(default=None, max_length=100),
    date_from: str | None = None,
    date_to: str | None = None,
    risk_level: str | None = Query(default=None, pattern="^(high|watch|normal|pending)$"),
    sort: str = Query(default="risk_desc", pattern="^(risk_desc|pass_rate_asc|students_desc)$"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Return paginated DWH-backed section aggregates with ML coverage metadata."""
    _validate_dashboard_date_range(date_from, date_to)
    await _require_section_filter_entities(
        db, semester_code=semester_code, program_id=program_id, course_id=course_id, section_id=section_id
    )
    if program_id is not None:
        await _require_program_scope(db, current_user, program_id)
    if course_id is not None:
        await _require_course_scope(db, current_user, course_id)
    if section_id is not None and not await can_access_section(db, current_user, section_id):
        _deny_out_of_scope()
    scope_sql, scope_params = await _section_scope_clause(db, current_user, department_id)
    scope_sql = _safe_dashboard_sql_fragment(scope_sql)
    clauses = ["1 = 1"]
    params: dict = {**scope_params, "limit": limit, "offset": offset}
    if semester_code:
        clauses.append("dsem.code = :semester_code")
        params["semester_code"] = semester_code
    if program_id is not None:
        clauses.append("dst.program_id = :program_id")
        params["program_id"] = program_id
    if course_id is not None:
        clauses.append("f.course_id = :course_id")
        params["course_id"] = course_id
    if section_id is not None:
        clauses.append("f.section_id = :section_id")
        params["section_id"] = section_id
    if teacher_id is not None:
        clauses.append("dsec.teacher_id = :teacher_id")
        params["teacher_id"] = teacher_id
    if q and q.strip():
        clauses.append("(LOWER(dsec.section_code) LIKE :search OR LOWER(dc.code) LIKE :search OR LOWER(dc.name) LIKE :search)")
        params["search"] = f"%{q.strip().lower()}%"
    if date_from:
        clauses.append("f.updated_at >= CAST(:date_from AS timestamptz)")
        params["date_from"] = _parse_dashboard_datetime(date_from, "date_from")
    if date_to:
        clauses.append("f.updated_at <= CAST(:date_to AS timestamptz)")
        params["date_to"] = _parse_dashboard_datetime(date_to, "date_to")
    where_sql = _dashboard_where_clause(clauses, prefix="")
    order_sql = _safe_dashboard_sql_fragment({
        "risk_desc": "risk_rank DESC, failed_count DESC, section_code",
        "pass_rate_asc": "pass_rate ASC, student_count DESC, section_code",
        "students_desc": "student_count DESC, section_code",
    }[sort])
    risk_sql = ""
    if risk_level:
        risk_sql = _safe_dashboard_sql_fragment("WHERE risk_level = :risk_level")
        params["risk_level"] = risk_level
    # The visible rows depend on the role-resolved scope clause and the drill
    # hierarchy level, not on the user — key on those so entries are shared.
    scope_token = (scope_sql, tuple(sorted(scope_params.items())))
    hierarchy_level = _section_hierarchy_level(current_user, department_id, program_id)
    cache_key = ("sections-v4", scope_token, hierarchy_level, semester_code, department_id, program_id, course_id,
                 section_id, teacher_id, q, date_from, date_to, risk_level, sort, limit, offset)
    cached = _dashboard_cache_get(cache_key)
    if cached is not None:
        return cached
    rows = await _fetch_all(
        db,
        f"""
        WITH latest_dropout AS (
            SELECT DISTINCT ON (student_id) student_id, dropout_probability, risk_level, scored_at
            FROM ml.student_dropout_prediction
            ORDER BY student_id, scored_at DESC
        ), aggregated AS (
            SELECT
                f.section_id AS id,
                dsec.section_code,
                f.course_id,
                dc.code AS course_code,
                dc.name AS course_name,
                f.semester_id,
                dsem.code AS semester_code,
                dsem.name AS semester_name,
                dsec.teacher_id,
                t.full_name AS teacher_name,
                COUNT(DISTINCT f.student_id)::INTEGER AS student_count,
                COUNT(*) FILTER (WHERE f.final_grade IS NOT NULL)::INTEGER AS graded_count,
                COUNT(*) FILTER (WHERE f.final_grade IS NULL)::INTEGER AS missing_grade_count,
                COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed_count,
                COALESCE(ROUND(AVG(f.final_grade), 2), 0)::FLOAT AS avg_grade,
                COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL /
                    NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100, 1), 0)::FLOAT AS pass_rate,
                COALESCE(ROUND(COUNT(ld.student_id)::DECIMAL / NULLIF(COUNT(DISTINCT f.student_id), 0), 3), 0)::FLOAT AS prediction_coverage,
                MAX(ld.scored_at) AS prediction_scored_at,
                CASE
                    WHEN COUNT(*) FILTER (WHERE f.final_grade IS NULL) = COUNT(*) THEN 'pending'
                    WHEN COUNT(DISTINCT f.student_id) < 5 THEN 'watch'
                    WHEN COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) >= 0.30
                         OR COUNT(*) FILTER (WHERE ld.risk_level = 'high') > 0 THEN 'high'
                    WHEN COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) >= 0.15 THEN 'watch'
                    ELSE 'normal'
                END AS risk_level,
                CASE WHEN COUNT(*) FILTER (WHERE f.final_grade IS NULL) = COUNT(*) THEN 1
                     WHEN COUNT(DISTINCT f.student_id) < 5 THEN 3
                     WHEN COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) >= 0.30
                          OR COUNT(*) FILTER (WHERE ld.risk_level = 'high') > 0 THEN 4
                     WHEN COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) >= 0.15 THEN 3
                    ELSE 2 END AS risk_rank,
                CASE
                    WHEN COUNT(*) FILTER (WHERE f.final_grade IS NULL) > 0 THEN 'missing_grade'
                    WHEN COUNT(DISTINCT f.student_id) < 5 THEN 'small_sample'
                    WHEN COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) >= 0.30 THEN 'high_fail_rate'
                    WHEN COUNT(*) FILTER (WHERE ld.risk_level = 'high') > 0 THEN 'ml_high_risk'
                    WHEN COALESCE(ROUND(COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL /
                        NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100, 1), 0) < 70 THEN 'low_pass_rate'
                    WHEN COUNT(DISTINCT f.student_id) < 20 THEN 'small_sample'
                    ELSE 'normal'
                END AS primary_reason,
                CASE
                    WHEN COUNT(*) FILTER (WHERE f.final_grade IS NULL) = COUNT(*) THEN 'wait_for_grades'
                    WHEN COUNT(DISTINCT f.student_id) < 5 THEN 'monitor'
                    WHEN COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) >= 0.30
                         OR COUNT(*) FILTER (WHERE ld.risk_level = 'high') > 0 THEN 'intervene_now'
                    WHEN COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) >= 0.15
                         OR COUNT(DISTINCT f.student_id) < 20 THEN 'monitor'
                    ELSE 'no_action'
                END AS recommended_action,
                (
                    (CASE WHEN COUNT(*) FILTER (WHERE f.final_grade IS NULL) = COUNT(*) THEN 1
                          WHEN COUNT(DISTINCT f.student_id) < 5 THEN 3
                          WHEN COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) >= 0.30
                               OR COUNT(*) FILTER (WHERE ld.risk_level = 'high') > 0 THEN 4
                          WHEN COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) >= 0.15 THEN 3
                          ELSE 2 END) * 100
                    + COUNT(*) FILTER (WHERE f.is_passed IS FALSE) * 3
                    + COUNT(*) FILTER (WHERE f.final_grade IS NULL) * 2
                    + LEAST(COUNT(DISTINCT f.student_id), 60)
                )::INTEGER AS priority_score
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_section dsec ON dsec.section_id = f.section_id
            JOIN dwh.dim_course dc ON dc.course_id = f.course_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            JOIN dwh.dim_student dst ON dst.student_id = f.student_id
            JOIN public.courses pc ON pc.id = f.course_id
            LEFT JOIN public.teachers t ON t.id = dsec.teacher_id
            LEFT JOIN latest_dropout ld ON ld.student_id = f.student_id
            WHERE {where_sql} {scope_sql}
            GROUP BY f.section_id, dsec.section_code, f.course_id, dc.code, dc.name,
                     f.semester_id, dsem.code, dsem.name, dsec.teacher_id, t.full_name
        ), filtered AS (
            SELECT *, COUNT(*) OVER()::INTEGER AS total FROM aggregated {risk_sql}
        )
        SELECT * FROM filtered ORDER BY {order_sql} LIMIT :limit OFFSET :offset
        """,
        params,
    )
    total = int(rows[0]["total"]) if rows else 0
    items = [{key: value for key, value in row.items() if key not in {"total", "risk_rank"}} for row in rows]
    visual_cte = f"""
        WITH latest_dropout AS (
            SELECT DISTINCT ON (student_id) student_id, risk_level, scored_at
            FROM ml.student_dropout_prediction
            ORDER BY student_id, scored_at DESC
        ), facts AS (
            SELECT f.*, dsec.section_code, dsec.teacher_id, dc.code AS course_code, dc.name AS course_name,
                   dsem.code AS semester_code, dsem.name AS semester_name, dst.program_id,
                   dp.code AS program_code, dp.name AS program_name, pc.department_id,
                   dep.code AS department_code, dep.name AS department_name,
                   ld.student_id AS predicted_student_id, ld.risk_level AS dropout_risk_level, ld.scored_at
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_section dsec ON dsec.section_id = f.section_id
            JOIN dwh.dim_course dc ON dc.course_id = f.course_id
            JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
            JOIN dwh.dim_student dst ON dst.student_id = f.student_id
            JOIN dwh.dim_program dp ON dp.program_id = dst.program_id
            JOIN public.courses pc ON pc.id = f.course_id
            JOIN public.departments dep ON dep.id = pc.department_id
            LEFT JOIN latest_dropout ld ON ld.student_id = f.student_id
            WHERE {where_sql} {scope_sql}
        ), aggregated AS (
            SELECT section_id AS id, section_code, course_id, course_code, course_name,
                   semester_id, semester_code, semester_name, teacher_id,
                   COUNT(DISTINCT student_id)::INTEGER AS student_count,
                   COUNT(*) FILTER (WHERE final_grade IS NOT NULL)::INTEGER AS graded_count,
                   COUNT(*) FILTER (WHERE final_grade IS NULL)::INTEGER AS missing_grade_count,
                   COUNT(*) FILTER (WHERE is_passed IS FALSE)::INTEGER AS failed_count,
                   COALESCE(ROUND(AVG(final_grade), 2), 0)::FLOAT AS avg_grade,
                   COALESCE(ROUND(COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL /
                       NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) * 100, 1), 0)::FLOAT AS pass_rate,
                   COALESCE(ROUND(COUNT(predicted_student_id)::DECIMAL /
                        NULLIF(COUNT(DISTINCT student_id), 0), 3), 0)::FLOAT AS prediction_coverage,
                    MAX(scored_at) AS prediction_scored_at,
                    CASE WHEN COUNT(*) FILTER (WHERE final_grade IS NULL) = COUNT(*) THEN 'pending'
                         WHEN COUNT(DISTINCT student_id) < 5 THEN 'watch'
                         WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.30
                              OR COUNT(*) FILTER (WHERE dropout_risk_level = 'high') > 0 THEN 'high'
                         WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.15 THEN 'watch'
                         ELSE 'normal' END AS risk_level,
                    CASE WHEN COUNT(*) FILTER (WHERE final_grade IS NULL) = COUNT(*) THEN 1
                         WHEN COUNT(DISTINCT student_id) < 5 THEN 3
                         WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.30
                              OR COUNT(*) FILTER (WHERE dropout_risk_level = 'high') > 0 THEN 4
                         WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.15 THEN 3
                         ELSE 2 END AS risk_rank,
                    CASE WHEN COUNT(*) FILTER (WHERE final_grade IS NULL) > 0 THEN 'missing_grade'
                         WHEN COUNT(DISTINCT student_id) < 5 THEN 'small_sample'
                         WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.30 THEN 'high_fail_rate'
                         WHEN COUNT(*) FILTER (WHERE dropout_risk_level = 'high') > 0 THEN 'ml_high_risk'
                         WHEN COALESCE(ROUND(COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) * 100, 1), 0) < 70 THEN 'low_pass_rate'
                         WHEN COUNT(DISTINCT student_id) < 20 THEN 'small_sample'
                         ELSE 'normal' END AS primary_reason,
                    CASE WHEN COUNT(*) FILTER (WHERE final_grade IS NULL) = COUNT(*) THEN 'wait_for_grades'
                         WHEN COUNT(DISTINCT student_id) < 5 THEN 'monitor'
                         WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.30
                              OR COUNT(*) FILTER (WHERE dropout_risk_level = 'high') > 0 THEN 'intervene_now'
                         WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.15
                              OR COUNT(DISTINCT student_id) < 20 THEN 'monitor'
                         ELSE 'no_action' END AS recommended_action,
                    ((CASE WHEN COUNT(*) FILTER (WHERE final_grade IS NULL) = COUNT(*) THEN 1
                           WHEN COUNT(DISTINCT student_id) < 5 THEN 3
                           WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                                NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.30
                                OR COUNT(*) FILTER (WHERE dropout_risk_level = 'high') > 0 THEN 4
                          WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                               NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.15 THEN 3
                          ELSE 2 END) * 100
                    + COUNT(*) FILTER (WHERE is_passed IS FALSE) * 3
                    + COUNT(*) FILTER (WHERE final_grade IS NULL) * 2
                    + LEAST(COUNT(DISTINCT student_id), 60))::INTEGER AS priority_score
            FROM facts
            GROUP BY section_id, section_code, course_id, course_code, course_name,
                     semester_id, semester_code, semester_name, teacher_id
        )
    """
    summary = await _fetch_one(
        db,
        visual_cte + """
        SELECT
            (SELECT COUNT(*)::INTEGER FROM aggregated) AS total_sections,
            (SELECT COUNT(DISTINCT student_id)::INTEGER FROM facts) AS total_students,
            (SELECT COUNT(*)::INTEGER FROM aggregated WHERE risk_level IN ('high', 'watch', 'pending')) AS needs_action_sections,
            (SELECT COALESCE(ROUND(COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL /
                NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) * 100, 1), 0)::FLOAT FROM facts) AS average_pass_rate,
            (SELECT COUNT(*) FILTER (WHERE final_grade IS NULL)::INTEGER FROM facts) AS missing_grade_count,
            (SELECT COALESCE(ROUND(COUNT(DISTINCT predicted_student_id)::DECIMAL /
                NULLIF(COUNT(DISTINCT student_id), 0), 3), 0)::FLOAT FROM facts) AS prediction_coverage
        """,
        params,
    )
    risk_distribution = await _fetch_all(
        db,
        visual_cte + """
        SELECT risk_level, COUNT(*)::INTEGER AS value
        FROM aggregated
        GROUP BY risk_level
        ORDER BY CASE risk_level WHEN 'high' THEN 1 WHEN 'watch' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END
        """,
        params,
    )
    section_matrix = await _fetch_all(
        db,
        visual_cte + """
        SELECT id, section_code, course_id, course_code, course_name, student_count,
               pass_rate, avg_grade, risk_level, prediction_coverage, failed_count, missing_grade_count,
               priority_score, primary_reason, recommended_action
        FROM aggregated
        ORDER BY priority_score DESC, failed_count DESC, missing_grade_count DESC, section_code
        LIMIT 40
        """,
        params,
    )
    hierarchy_fields = {
        "department": ("department_id", "department_code", "department_name"),
        "program": ("program_id", "program_code", "program_name"),
        "course": ("course_id", "course_code", "course_name"),
    }[hierarchy_level]
    entity_id, entity_code, entity_name = hierarchy_fields
    hierarchy_items = await _fetch_all(
        db,
        visual_cte + f"""
        , entity_sections AS (
            SELECT {entity_id} AS id, {entity_code} AS code, {entity_name} AS name, section_id,
                   COUNT(DISTINCT student_id)::INTEGER AS student_count,
                   COUNT(*) FILTER (WHERE is_passed IS FALSE)::INTEGER AS failed_count,
                   COUNT(*) FILTER (WHERE final_grade IS NULL)::INTEGER AS missing_grade_count,
                   COUNT(*) FILTER (WHERE is_passed IS NOT NULL)::INTEGER AS graded_count,
                   COUNT(*) FILTER (WHERE is_passed IS TRUE)::INTEGER AS passed_count,
                   CASE WHEN COUNT(*) FILTER (WHERE final_grade IS NULL) = COUNT(*) THEN 'pending'
                         WHEN COUNT(DISTINCT student_id) < 5 THEN 'watch'
                         WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.30
                              OR COUNT(*) FILTER (WHERE dropout_risk_level = 'high') > 0 THEN 'high'
                         WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                              NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.15 THEN 'watch'
                         ELSE 'normal' END AS risk_level,
                   CASE WHEN COUNT(*) FILTER (WHERE final_grade IS NULL) > 0 THEN 'missing_grade'
                        WHEN COUNT(DISTINCT student_id) < 5 THEN 'small_sample'
                        WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                             NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.30 THEN 'high_fail_rate'
                        WHEN COUNT(*) FILTER (WHERE dropout_risk_level = 'high') > 0 THEN 'ml_high_risk'
                        WHEN COUNT(DISTINCT student_id) < 20 THEN 'small_sample'
                        ELSE 'normal' END AS primary_reason,
                   ((CASE WHEN COUNT(*) FILTER (WHERE final_grade IS NULL) = COUNT(*) THEN 1
                          WHEN COUNT(DISTINCT student_id) < 5 THEN 3
                          WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                               NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.30
                               OR COUNT(*) FILTER (WHERE dropout_risk_level = 'high') > 0 THEN 4
                          WHEN COUNT(*) FILTER (WHERE is_passed IS FALSE)::DECIMAL /
                               NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) >= 0.15 THEN 3
                          ELSE 2 END) * 100
                    + COUNT(*) FILTER (WHERE is_passed IS FALSE) * 3
                    + COUNT(*) FILTER (WHERE final_grade IS NULL) * 2
                    + LEAST(COUNT(DISTINCT student_id), 60))::INTEGER AS priority_score
            FROM facts
            GROUP BY {entity_id}, {entity_code}, {entity_name}, section_id
        )
        SELECT id, code, name, COUNT(DISTINCT section_id)::INTEGER AS section_count,
               SUM(student_count)::INTEGER AS student_count,
               COALESCE(ROUND(SUM(passed_count)::DECIMAL / NULLIF(SUM(graded_count), 0) * 100, 1), 0)::FLOAT AS pass_rate,
               COUNT(*) FILTER (WHERE risk_level = 'high')::INTEGER AS high_sections,
               COUNT(*) FILTER (WHERE risk_level = 'watch')::INTEGER AS watch_sections,
               COUNT(*) FILTER (WHERE risk_level = 'pending')::INTEGER AS pending_sections,
               COUNT(*) FILTER (WHERE risk_level = 'normal')::INTEGER AS normal_sections,
               COALESCE(ROUND(COUNT(*) FILTER (WHERE risk_level IN ('high', 'watch', 'pending'))::DECIMAL /
                   NULLIF(COUNT(DISTINCT section_id), 0) * 100, 1), 0)::FLOAT AS needs_action_rate,
               COALESCE(MAX(priority_score), 0)::INTEGER AS priority_score,
               (ARRAY_AGG(primary_reason ORDER BY priority_score DESC))[1] AS primary_reason
        FROM entity_sections
        GROUP BY id, code, name
        ORDER BY priority_score DESC, high_sections DESC, watch_sections DESC, pass_rate ASC, name
        LIMIT 16
        """,
        params,
    )
    status_stats = await _fetch_one(
        db,
        visual_cte + """
        SELECT
            COUNT(*)::INTEGER AS total_sections,
            COALESCE(SUM(missing_grade_count), 0)::INTEGER AS missing_grade_count,
            COUNT(*) FILTER (WHERE prediction_coverage < 0.9)::INTEGER AS low_coverage_sections,
            COUNT(*) FILTER (WHERE student_count < 20)::INTEGER AS small_sections
        FROM aggregated
        """,
        params,
    )
    data_status, warnings = _section_data_status(status_stats)
    stale, stale_warning = await _section_etl_warning(db)
    if stale and int((status_stats or {}).get("total_sections") or 0) > 0:
        data_status = "stale"
    if stale_warning:
        warnings.append(stale_warning)
    payload = {
        "filters": {"semester_code": semester_code, "department_id": department_id, "program_id": program_id,
                    "course_id": course_id, "section_id": section_id, "teacher_id": teacher_id, "q": q,
                    "date_from": date_from, "date_to": date_to, "risk_level": risk_level},
        "summary": summary,
        "hierarchy": {"level": hierarchy_level, "items": hierarchy_items},
        "risk_distribution": risk_distribution,
        "section_matrix": section_matrix,
        "items": items,
        "pagination": {"total": total, "limit": limit, "offset": offset, "has_more": offset + len(items) < total},
        "data_status": data_status,
        "warnings": warnings,
    }
    return _dashboard_cache_set(cache_key, payload)


@router.get("/analytics/dashboard/sections/{section_id}")
async def analytics_dashboard_section_detail(
    section_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Return one section aggregate using the same production contract."""
    if not await can_access_section(db, current_user, section_id):
        exists_row = await db.execute(select(Enrollment.id).where(Enrollment.section_id == section_id).limit(1))
        if exists_row.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
        _deny_out_of_scope()
    listing = await analytics_dashboard_sections(
        db=db,
        current_user=current_user,
        semester_code=None,
        department_id=None,
        program_id=None,
        course_id=None,
        section_id=section_id,
        teacher_id=None,
        q=None,
        date_from=None,
        date_to=None,
        risk_level=None,
        sort="risk_desc",
        limit=1,
        offset=0,
    )
    item = next((row for row in listing["items"] if row["id"] == section_id), None)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section has no analytics data")
    return {"item": item, "data_status": listing["data_status"], "warnings": listing["warnings"]}


@router.get("/analytics/dashboard/sections/{section_id}/students")
async def analytics_dashboard_section_students(
    section_id: int,
    db: DBSession,
    current_user: CurrentUser,
    risk_level: str | None = Query(default=None, pattern="^(high|watch|normal|pending)$"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Return paginated student evidence for a section; probabilities only come from ML."""
    if not await can_access_section(db, current_user, section_id):
        _deny_out_of_scope()
    cache_key = (
        "dashboard-section-students",
        section_id,
        risk_level,
        limit,
        offset,
    )
    cached = _dashboard_cache_get(cache_key)
    if cached:
        return cached
    params: dict = {"section_id": section_id, "limit": limit, "offset": offset}
    risk_sql = ""
    if risk_level:
        risk_sql = "WHERE risk_level = :risk_level"
        params["risk_level"] = risk_level
    rows = await _fetch_all(db, f"""
        WITH latest_dropout AS (
            SELECT DISTINCT ON (student_id) student_id, dropout_probability, risk_level, top_factors, scored_at
            FROM ml.student_dropout_prediction ORDER BY student_id, scored_at DESC
        ), evidence AS (
            SELECT f.student_id, ds.student_code, ds.full_name, f.final_grade::FLOAT AS final_grade, f.is_passed,
                   ld.dropout_probability::FLOAT, ld.risk_level AS dropout_risk_level,
                   ld.top_factors, ld.scored_at,
                   CASE WHEN f.final_grade IS NULL THEN 'pending'
                        WHEN f.is_passed IS FALSE OR ld.risk_level = 'high' THEN 'high'
                        WHEN f.final_grade < 5.5 OR ld.risk_level = 'medium' THEN 'watch'
                        ELSE 'normal' END AS risk_level
            FROM dwh.fact_enrollment_outcome f
            JOIN dwh.dim_student ds ON ds.student_id = f.student_id
            LEFT JOIN latest_dropout ld ON ld.student_id = f.student_id
            WHERE f.section_id = :section_id
        ), filtered AS (SELECT *, COUNT(*) OVER()::INTEGER AS total FROM evidence {risk_sql})
        SELECT * FROM filtered
        ORDER BY CASE risk_level WHEN 'high' THEN 1 WHEN 'watch' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END,
                 final_grade NULLS LAST, student_code
        LIMIT :limit OFFSET :offset
    """, params)
    total = int(rows[0]["total"]) if rows else 0
    items = [{key: value for key, value in row.items() if key != "total"} for row in rows]
    warnings = [] if all(item.get("dropout_probability") is not None for item in items) else ["Một số sinh viên chưa có dự đoán dropout ML."]
    payload = {
        "items": items,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(items) < total,
        },
        "data_status": "empty" if not items else "partial" if warnings else "ready",
        "warnings": warnings,
    }
    return _dashboard_cache_set(cache_key, payload)


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
    from app.api.v1.endpoints.tree import invalidate_tree_cache

    run_id = await refresh_dwh()
    _dashboard_cache_clear()
    invalidate_tree_cache()
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
    _dashboard_cache_clear()
    return {"status": "completed", "rows_upserted": rows}


@router.post("/admin/ml/score", dependencies=[Depends(require_admin_access)])
async def trigger_ml_score(model_run_id: int) -> dict[str, int | str]:
    """Batch-score all enrollments for a completed model run and aggregate per student-semester."""
    rows = await aggregate_student_semester_predictions(model_run_id)
    return {"status": "completed", "rows_upserted": rows}


@router.post("/admin/ml/score-course-risk", dependencies=[Depends(require_admin_access)])
async def trigger_course_risk_score() -> dict[str, int | str]:
    """Score course-failure risk for enrollments and aggregate expected credits."""
    try:
        result = await score_course_failure_predictions(aggregate=True)
        _dashboard_cache_clear()
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


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

"""Analytics warehouse and prediction read/operation endpoints."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.analytics.etl import refresh_dwh
from app.analytics.health_score import (
    get_course_health_score,
    get_program_health_score,
    get_department_health_score,
    get_course_health_batch
)
from app.config import get_settings
from app.dependencies import DBSession
from app.ml.scoring import aggregate_student_semester_predictions

router = APIRouter()

settings = get_settings()


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


@router.post("/admin/dwh/refresh")
async def trigger_dwh_refresh() -> dict[str, int | str]:
    """Run the idempotent OLTP-to-DWH refresh."""
    run_id = await refresh_dwh()
    return {"status": "completed", "etl_run_id": run_id}


@router.post("/admin/ml/train")
async def trigger_ml_train() -> dict[str, str]:
    """Train and evaluate the ML pass/fail prediction model.

    Full training pipeline is planned for M8. Returns 501 until implemented.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "ML training pipeline not yet implemented. "
            "Seed ml.model_run and ml.enrollment_prediction directly for now."
        ),
    )


@router.post("/admin/ml/score")
async def trigger_ml_score(model_run_id: int) -> dict[str, int | str]:
    """Batch-score all enrollments for a completed model run and aggregate per student-semester."""
    rows = await aggregate_student_semester_predictions(model_run_id)
    return {"status": "completed", "rows_upserted": rows}


@router.post("/admin/ml/aggregate/{model_run_id}")
async def trigger_prediction_aggregation(model_run_id: int) -> dict[str, int | str]:
    """Aggregate enrollment predictions into expected student-semester credits."""
    rows = await aggregate_student_semester_predictions(model_run_id)
    return {"status": "completed", "rows_upserted": rows}


@router.get("/predictions/enrollments/{enrollment_id}")
async def get_enrollment_prediction(enrollment_id: int, db: DBSession) -> dict:
    """Return the latest prediction for an enrollment."""
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
async def get_student_semester_prediction(student_id: int, semester_id: int, db: DBSession) -> dict:
    """Return the latest expected-credit prediction for a student-semester."""
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


@router.get("/analytics/health/course/{course_id}", summary="Get Course Health Score")
async def read_course_health(course_id: int, db: DBSession) -> dict:
    """Lấy Health Score cho Môn học (dựa trên GPA, Pass Rate và CLO)."""
    try:
        return await get_course_health_score(db, course_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import Query
@router.get("/analytics/health/courses/batch", summary="Get Multiple Course Health Scores")
async def read_course_health_batch(
    db: DBSession,
    course_ids: list[int] | None = Query(None)
) -> list[dict]:
    """Lấy Health Score cho nhiều Môn học."""
    try:
        return await get_course_health_batch(db, course_ids or [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/health/program/{program_id}", summary="Get Program Health Score")
async def read_program_health(program_id: int, db: DBSession) -> dict:
    """Lấy Health Score cho Ngành đào tạo."""
    try:
        return await get_program_health_score(db, program_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/health/department/{department_id}", summary="Get Department Health Score")
async def read_department_health(department_id: int, db: DBSession) -> dict:
    """Lấy Health Score cho Khoa."""
    try:
        return await get_department_health_score(db, department_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

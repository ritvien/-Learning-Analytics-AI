"""Analytics warehouse and prediction read/operation endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text

from app.analytics.etl import refresh_dwh
from app.analytics.health_score import (
    get_course_health_score,
    get_program_health_score,
    get_department_health_score,
    get_course_health_batch
)
from app.analytics.outcomes import (
    get_course_clo_attainment,
    get_outcome_gaps,
    get_program_plo_attainment,
    get_student_outcome_profile,
    recalculate_outcomes,
)
from app.config import get_settings
from app.dependencies import DBSession, get_current_user, require_write_access
from app.ml.scoring import aggregate_student_semester_predictions

router = APIRouter(dependencies=[Depends(get_current_user)])

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
                    CAST(COUNT(*) AS INTEGER) AS enrollment_count,
                    CAST(COUNT(*) FILTER (WHERE is_passed IS TRUE) AS INTEGER) AS passed_count,
                    CAST(COUNT(*) FILTER (WHERE is_passed IS FALSE) AS INTEGER) AS failed_count,
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
            CAST(COUNT(*) AS INTEGER) AS total_enrollments,
            CAST(COUNT(*) FILTER (WHERE f.is_passed IS TRUE) AS INTEGER) AS passed_count,
            CAST(COUNT(*) FILTER (WHERE f.is_passed IS FALSE) AS INTEGER) AS failed_count,
            ROUND(AVG(f.final_grade), 2) AS avg_grade,
            ROUND(
                CAST(COUNT(*) FILTER (WHERE f.is_passed IS FALSE) AS DECIMAL)
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


@router.post("/analytics/outcomes/recalculate", dependencies=[Depends(require_write_access)])
async def recalculate_outcome_metrics(db: DBSession, threshold: float = Query(50.0, ge=0, le=100)) -> dict:
    """Recalculate deterministic CLO and PLO achievement caches."""
    try:
        return await recalculate_outcomes(db, threshold)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/outcomes/program/{program_id}/plos")
async def read_program_plo_attainment(program_id: int, db: DBSession) -> list[dict]:
    """Return PLO attainment for one program."""
    try:
        return await get_program_plo_attainment(db, program_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/outcomes/course/{course_id}/clos")
async def read_course_clo_attainment(
    course_id: int,
    db: DBSession,
    section_id: int | None = None,
) -> list[dict]:
    """Return CLO attainment for one course, optionally scoped to a section."""
    try:
        return await get_course_clo_attainment(db, course_id, section_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/outcomes/student/{student_id}")
async def read_student_outcome_profile(student_id: int, db: DBSession) -> dict:
    """Return student-level PLO profile and weakest CLO evidence."""
    try:
        profile = await get_student_outcome_profile(db, student_id)
        if profile["student"] is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        return profile
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/outcomes/gaps")
async def read_outcome_gaps(
    db: DBSession,
    program_id: int | None = None,
    limit: int = Query(10, ge=1, le=50),
) -> dict:
    """Return weakest PLO and CLO aggregates for prioritizing interventions."""
    try:
        return await get_outcome_gaps(db, program_id, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/brief")
async def get_daily_brief(db: DBSession) -> dict:
    """Return a prioritised list of items that need attention today.

    Aggregates insights across departments, programs, courses and students
    from the DWH. Each item carries enough context for the UI to offer
    drill-down, ask-agent, and create-task actions.
    """
    items: list[dict] = []

    # 1. Departments with fail rate > 10 % in the most recent semester
    # dim_course has no department_id — join through OLTP courses table
    dept_rows = (
        await db.execute(
            text(
                """
                SELECT
                    d.id               AS scope_id,
                    d.name             AS scope_label,
                    COUNT(*)           AS total,
                    COUNT(*) FILTER (WHERE f.is_passed IS FALSE) AS failed,
                    ROUND(
                        CAST(COUNT(*) FILTER (WHERE f.is_passed IS FALSE) AS DECIMAL)
                        / NULLIF(COUNT(*), 0) * 100, 1
                    ) AS fail_rate
                FROM dwh.fact_enrollment_outcome f
                JOIN courses c ON c.id = f.course_id
                JOIN departments d ON d.id = c.department_id
                WHERE f.semester_id = (
                    SELECT semester_id FROM dwh.dim_semester ORDER BY year DESC, term DESC LIMIT 1
                )
                GROUP BY d.id, d.name
                HAVING COUNT(*) >= 10
                ORDER BY fail_rate DESC NULLS LAST
                LIMIT 5
                """
            )
        )
    ).mappings().all()

    for row in dept_rows:
        fail_rate = float(row["fail_rate"] or 0)
        severity = "high" if fail_rate >= 25 else "medium" if fail_rate >= 15 else "low"
        if fail_rate < 10:
            continue
        items.append({
            "id": f"dept-fail-{row['scope_id']}",
            "severity": severity,
            "title": f"{row['scope_label']} có tỷ lệ trượt {fail_rate:.1f}%",
            "scope_type": "department",
            "scope_id": row["scope_id"],
            "scope_label": row["scope_label"],
            "metric_key": "fail_rate",
            "value": fail_rate,
            "delta": None,
            "formula": "Số enrollment trượt / tổng enrollment có kết quả × 100",
            "sample_size": int(row["total"]),
            "actions": ["drill_down", "ask_agent", "create_task"],
        })

    # 2. Programs where average GPA < 5.5 (out of 10)
    prog_rows = (
        await db.execute(
            text(
                """
                SELECT
                    p.id               AS scope_id,
                    p.name             AS scope_label,
                    COUNT(*)           AS total,
                    ROUND(AVG(f.final_grade), 2) AS avg_gpa
                FROM dwh.fact_enrollment_outcome f
                JOIN dwh.dim_student ds ON ds.student_id = f.student_id
                JOIN programs p ON p.id = ds.program_id
                WHERE f.semester_id = (
                    SELECT semester_id FROM dwh.dim_semester ORDER BY year DESC, term DESC LIMIT 1
                )
                  AND f.final_grade IS NOT NULL
                GROUP BY p.id, p.name
                HAVING COUNT(*) >= 20
                ORDER BY avg_gpa ASC NULLS LAST
                LIMIT 5
                """
            )
        )
    ).mappings().all()

    for row in prog_rows:
        avg_gpa = float(row["avg_gpa"] or 0)
        if avg_gpa >= 6.0:
            continue
        severity = "high" if avg_gpa < 5.0 else "medium"
        items.append({
            "id": f"prog-gpa-{row['scope_id']}",
            "severity": severity,
            "title": f"Ngành {row['scope_label']} có GPA trung bình thấp ({avg_gpa:.2f}/10)",
            "scope_type": "program",
            "scope_id": row["scope_id"],
            "scope_label": row["scope_label"],
            "metric_key": "gpa_avg",
            "value": avg_gpa,
            "delta": None,
            "formula": "Trung bình điểm tổng kết của tất cả enrollment trong kỳ",
            "sample_size": int(row["total"]),
            "actions": ["drill_down", "ask_agent", "create_task"],
        })

    # 3. Students with GPA cumulative < 4.0 (high risk)
    risk_row = (
        await db.execute(
            text(
                """
                SELECT COUNT(*) AS cnt
                FROM students
                WHERE gpa_cumulative IS NOT NULL AND gpa_cumulative < 4.0 AND status = 'active'
                """
            )
        )
    ).scalar_one_or_none()

    risk_count = int(risk_row or 0)
    if risk_count > 0:
        severity = "high" if risk_count >= 20 else "medium"
        items.append({
            "id": "students-high-risk",
            "severity": severity,
            "title": f"{risk_count} sinh viên đang hoạt động có GPA tích lũy dưới 4.0",
            "scope_type": "school",
            "scope_id": None,
            "scope_label": "Toàn trường",
            "metric_key": "student_risk_count",
            "value": risk_count,
            "delta": None,
            "formula": "Số sinh viên active có gpa_cumulative < 4.0",
            "sample_size": risk_count,
            "actions": ["drill_down", "ask_agent", "create_task"],
        })

    # 4. Sections missing grade data (no enrollments with final_grade)
    missing_grade_row = (
        await db.execute(
            text(
                """
                SELECT COUNT(DISTINCT s.id) AS cnt
                FROM sections s
                WHERE s.is_active = TRUE
                  AND NOT EXISTS (
                    SELECT 1 FROM enrollments e
                    WHERE e.section_id = s.id AND e.final_grade IS NOT NULL
                  )
                  AND EXISTS (
                    SELECT 1 FROM enrollments e2 WHERE e2.section_id = s.id
                  )
                """
            )
        )
    ).scalar_one_or_none()

    missing_count = int(missing_grade_row or 0)
    if missing_count > 0:
        items.append({
            "id": "sections-missing-grades",
            "severity": "medium",
            "title": f"{missing_count} lớp học phần chưa có dữ liệu điểm",
            "scope_type": "school",
            "scope_id": None,
            "scope_label": "Toàn trường",
            "metric_key": "sections_missing_grades",
            "value": missing_count,
            "delta": None,
            "formula": "Lớp active có enrollment nhưng không có final_grade nào",
            "sample_size": missing_count,
            "actions": ["drill_down", "create_task"],
        })

    # Sort: high → medium → low
    order = {"high": 0, "medium": 1, "low": 2}
    items.sort(key=lambda x: order.get(x["severity"], 9))

    from datetime import datetime, timezone
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "role": "manager",
        "items": items,
    }

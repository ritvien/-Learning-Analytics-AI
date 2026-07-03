"""Rule-based generation for operational alerts."""

from __future__ import annotations

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import Course
from app.models.ops import OpsAlert, OpsTask
from app.models.people import Student, User
from app.models.teaching import Section
from app.schemas.ops import AlertCreate
from app.services.notification_service import add_task_event, notify_task_assignee
from app.services.task_service import OPEN_TASK_STATUSES

ACTIVE_ALERT_STATUSES = {"new", "acknowledged", "converted"}


def _dedupe(prefix: str, *parts: object) -> str:
    return ":".join([prefix, *(str(part) for part in parts if part is not None)])


async def _pg_relation_exists(db: AsyncSession, relation_name: str) -> bool:
    if db.get_bind().dialect.name != "postgresql":
        return False
    return (await db.scalar(text("SELECT to_regclass(:relation_name)"), {"relation_name": relation_name})) is not None


async def create_alert_if_new(db: AsyncSession, payload: AlertCreate) -> OpsAlert | None:
    dedupe_key = payload.dedupe_key or _dedupe(payload.alert_type, payload.scope_type, payload.scope_id)
    existing = await db.scalar(
        select(OpsAlert.id).where(OpsAlert.dedupe_key == dedupe_key, OpsAlert.status.in_(ACTIVE_ALERT_STATUSES))
    )
    if existing is not None:
        return None
    alert = OpsAlert(
        alert_type=payload.alert_type,
        severity=payload.severity,
        scope_type=payload.scope_type,
        scope_id=payload.scope_id,
        title=payload.title,
        message=payload.message,
        source=payload.source,
        evidence_json=jsonable_encoder(payload.evidence_json),
        status="new",
        dedupe_key=dedupe_key,
        expires_at=payload.expires_at,
    )
    db.add(alert)
    await db.flush()
    return alert


async def _get_active_alert_by_dedupe(db: AsyncSession, dedupe_key: str) -> OpsAlert | None:
    return await db.scalar(
        select(OpsAlert).where(OpsAlert.dedupe_key == dedupe_key, OpsAlert.status.in_(ACTIVE_ALERT_STATUSES))
    )


async def _open_task_exists_for_alert(db: AsyncSession, alert_id: int) -> bool:
    return (
        await db.scalar(
            select(OpsTask.id).where(OpsTask.source_alert_id == alert_id, OpsTask.status.in_(OPEN_TASK_STATUSES))
        )
    ) is not None


async def _user_role_value(db: AsyncSession, user_id: str) -> str:
    user = await db.get(User, user_id)
    return user.role.value if user is not None else "lecturer"


async def _create_student_task_from_alert(
    db: AsyncSession,
    *,
    alert: OpsAlert,
    actor: User,
    assignee_user_id: str,
    evidence: dict,
) -> bool:
    if await _open_task_exists_for_alert(db, alert.id):
        return False
    task = OpsTask(
        task_type="contact_student",
        priority="high",
        status="assigned",
        title=alert.title,
        description=alert.message,
        scope_type="student",
        scope_id=alert.scope_id,
        source_alert_id=alert.id,
        assignee_user_id=assignee_user_id,
        assignee_role=await _user_role_value(db, assignee_user_id),
        created_by_user_id=actor.id,
        metadata_json=jsonable_encoder({"alert": evidence, "source": alert.source}),
    )
    db.add(task)
    await db.flush()
    alert.status = "converted"
    await add_task_event(
        db,
        task_id=task.id,
        actor_user_id=actor.id,
        event_type="auto_assigned_from_student_risk",
        payload={"alert_id": alert.id, "assignee_user_id": assignee_user_id},
    )
    await notify_task_assignee(db, task, actor)
    return True


async def _create_section_task_from_alert(
    db: AsyncSession,
    *,
    alert: OpsAlert,
    actor: User,
    assignee_user_id: str,
    evidence: dict,
) -> bool:
    if await _open_task_exists_for_alert(db, alert.id):
        return False
    task = OpsTask(
        task_type="review_section",
        priority="high",
        status="assigned",
        title=alert.title,
        description=alert.message,
        scope_type="section",
        scope_id=alert.scope_id,
        source_alert_id=alert.id,
        assignee_user_id=assignee_user_id,
        assignee_role=await _user_role_value(db, assignee_user_id),
        created_by_user_id=actor.id,
        metadata_json=jsonable_encoder({"alert": evidence, "source": alert.source}),
    )
    db.add(task)
    await db.flush()
    alert.status = "converted"
    await add_task_event(
        db,
        task_id=task.id,
        actor_user_id=actor.id,
        event_type="auto_assigned_from_section_risk",
        payload={"alert_id": alert.id, "assignee_user_id": assignee_user_id},
    )
    await notify_task_assignee(db, task, actor)
    return True


async def generate_student_risk_alerts(db: AsyncSession, *, actor: User | None = None, limit: int = 50) -> int:
    rows = []
    if db.get_bind().dialect.name == "postgresql":
        if not await _pg_relation_exists(db, "dwh.fact_enrollment_outcome"):
            return 0
        dropout_join = ""
        dropout_select = "NULL::NUMERIC AS dropout_probability, NULL::TEXT AS risk_level"
        dropout_where = ""
        if await _pg_relation_exists(db, "ml.student_dropout_prediction"):
            dropout_join = """
                    LEFT JOIN (
                        SELECT DISTINCT ON (student_id) student_id, dropout_probability, risk_level, scored_at
                        FROM ml.student_dropout_prediction
                        ORDER BY student_id, scored_at DESC
                    ) d ON d.student_id = s.id
            """
            dropout_select = "d.dropout_probability, d.risk_level"
            dropout_where = "OR d.dropout_probability >= 0.7"
        rows = (
            await db.execute(
                text(
                    f"""
                    WITH fail_counts AS (
                        SELECT student_id,
                               COUNT(*) FILTER (WHERE is_passed IS FALSE)::INTEGER AS fail_count
                        FROM dwh.fact_enrollment_outcome
                        GROUP BY student_id
                    ), latest_risk_section AS (
                        SELECT DISTINCT ON (f.student_id)
                               f.student_id, f.section_id, sec.section_code, teacher_user.id AS section_assignee_user_id
                        FROM dwh.fact_enrollment_outcome f
                        JOIN sections sec ON sec.id = f.section_id
                        LEFT JOIN teachers teacher ON teacher.id = sec.teacher_id
                        LEFT JOIN users teacher_user ON teacher_user.id = teacher.user_id AND teacher_user.is_active IS TRUE
                        WHERE f.is_passed IS FALSE OR f.final_grade < 5.5
                        ORDER BY f.student_id, f.semester_id DESC, f.section_id DESC
                    )
                    SELECT s.id, s.student_code, s.full_name, s.gpa_cumulative,
                           COALESCE(f.fail_count, 0) AS fail_count,
                           hteacher_user.id AS homeroom_assignee_user_id,
                           latest_risk_section.section_id,
                           latest_risk_section.section_code,
                           latest_risk_section.section_assignee_user_id,
                           {dropout_select}
                    FROM students s
                    LEFT JOIN fail_counts f ON f.student_id = s.id
                    LEFT JOIN homeroom_assignments ha ON ha.class_code = s.class_code AND ha.is_active IS TRUE
                    LEFT JOIN teachers hteacher ON hteacher.id = ha.teacher_id
                    LEFT JOIN users hteacher_user ON hteacher_user.id = hteacher.user_id AND hteacher_user.is_active IS TRUE
                    LEFT JOIN latest_risk_section ON latest_risk_section.student_id = s.id
                    {dropout_join}
                    WHERE s.is_active IS TRUE
                      AND (
                        s.gpa_cumulative < 2.0
                        OR COALESCE(f.fail_count, 0) >= 3
                        {dropout_where}
                      )
                    ORDER BY COALESCE(dropout_probability, 0) DESC, COALESCE(f.fail_count, 0) DESC
                    LIMIT :limit
                    """
                ),
                {"limit": limit},
            )
        ).mappings().all()
    else:
        rows = (
            await db.execute(
                select(Student.id, Student.student_code, Student.full_name, Student.gpa_cumulative)
                .where(Student.is_active == True, Student.gpa_cumulative < 2.0)  # noqa: E712
                .limit(limit)
            )
        ).mappings().all()
    created = 0
    for row in rows:
        evidence = dict(row)
        dedupe_key = _dedupe("student_risk", row["id"])
        alert = await create_alert_if_new(
            db,
            AlertCreate(
                alert_type="student_risk",
                severity="high",
                scope_type="student",
                scope_id=str(row["id"]),
                title=f"Sinh viên {row['student_code']} cần hỗ trợ",
                message="Sinh viên có tín hiệu học vụ/dropout cần giảng viên hoặc cố vấn kiểm tra.",
                source="ml+academic_rule",
                evidence_json=evidence,
                dedupe_key=dedupe_key,
            ),
        )
        task_source_alert = alert or await _get_active_alert_by_dedupe(db, dedupe_key)
        if task_source_alert is not None and actor is not None:
            assignee_user_id = row.get("homeroom_assignee_user_id") or row.get("section_assignee_user_id")
            if assignee_user_id:
                await _create_student_task_from_alert(
                    db,
                    alert=task_source_alert,
                    actor=actor,
                    assignee_user_id=str(assignee_user_id),
                    evidence=evidence,
                )
        created += 1 if alert is not None else 0
    return created


async def generate_section_risk_alerts(db: AsyncSession, *, actor: User | None = None, limit: int = 50) -> int:
    if not await _pg_relation_exists(db, "dwh.fact_enrollment_outcome"):
        return 0
    rows = (
        await db.execute(
            text(
                """
                SELECT f.section_id, sec.section_code, c.name AS course_name,
                       teacher_user.id AS section_assignee_user_id,
                       COUNT(*)::INTEGER AS completed_enrollments,
                       COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed_count,
                       COUNT(*) FILTER (WHERE f.final_grade >= 4 AND f.final_grade < 5.5)::INTEGER AS near_fail_count,
                       ROUND(COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*), 0), 4)::FLOAT AS fail_rate
                FROM dwh.fact_enrollment_outcome f
                JOIN sections sec ON sec.id = f.section_id
                JOIN courses c ON c.id = f.course_id
                LEFT JOIN teachers teacher ON teacher.id = sec.teacher_id
                LEFT JOIN users teacher_user ON teacher_user.id = teacher.user_id AND teacher_user.is_active IS TRUE
                WHERE f.is_passed IS NOT NULL
                GROUP BY f.section_id, sec.section_code, c.name, teacher_user.id
                HAVING COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*), 0) >= 0.30
                   OR COUNT(*) FILTER (WHERE f.final_grade >= 4 AND f.final_grade < 5.5) >= 5
                ORDER BY fail_rate DESC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        )
    ).mappings().all()
    created = 0
    for row in rows:
        evidence = dict(row)
        dedupe_key = _dedupe("section_risk", row["section_id"])
        alert = await create_alert_if_new(
            db,
            AlertCreate(
                alert_type="section_risk",
                severity="high",
                scope_type="section",
                scope_id=str(row["section_id"]),
                title=f"Lớp {row['section_code']} có nhiều sinh viên rủi ro",
                message="Lớp học phần có fail rate hoặc nhóm cận trượt vượt ngưỡng.",
                source="dwh",
                evidence_json=evidence,
                dedupe_key=dedupe_key,
            ),
        )
        task_source_alert = alert or await _get_active_alert_by_dedupe(db, dedupe_key)
        if task_source_alert is not None and actor is not None and row.get("section_assignee_user_id"):
            await _create_section_task_from_alert(
                db,
                alert=task_source_alert,
                actor=actor,
                assignee_user_id=str(row["section_assignee_user_id"]),
                evidence=evidence,
            )
        created += 1 if alert is not None else 0
    return created


async def generate_course_risk_alerts(db: AsyncSession, *, limit: int = 50) -> int:
    if not await _pg_relation_exists(db, "dwh.fact_enrollment_outcome"):
        return 0
    rows = (
        await db.execute(
            text(
                """
                WITH per_semester AS (
                    SELECT f.course_id, c.code, c.name, dsem.code AS semester_code,
                           dsem.year, dsem.term,
                           COUNT(*)::INTEGER AS completed_enrollments,
                           COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed_count,
                           ROUND(COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*), 0), 4)::FLOAT AS fail_rate,
                           ROUND(AVG(f.final_grade)::NUMERIC, 2)::FLOAT AS avg_grade
                    FROM dwh.fact_enrollment_outcome f
                    JOIN courses c ON c.id = f.course_id
                    JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
                    WHERE f.is_passed IS NOT NULL
                    GROUP BY f.course_id, c.code, c.name, dsem.code, dsem.year, dsem.term
                ), latest_qualified AS (
                    SELECT DISTINCT ON (course_id) *
                    FROM per_semester
                    WHERE completed_enrollments >= 20
                    ORDER BY course_id, year DESC, term DESC
                ), historical AS (
                    SELECT f.course_id,
                           COUNT(*)::INTEGER AS historical_completed_enrollments,
                           COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS historical_failed_count,
                           ROUND(COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL / NULLIF(COUNT(*), 0), 4)::FLOAT AS historical_fail_rate
                    FROM dwh.fact_enrollment_outcome f
                    WHERE f.is_passed IS NOT NULL
                    GROUP BY f.course_id
                )
                SELECT l.course_id, l.code, l.name, l.semester_code,
                       l.completed_enrollments, l.failed_count, l.fail_rate, l.avg_grade,
                       h.historical_completed_enrollments, h.historical_failed_count, h.historical_fail_rate,
                       CASE
                         WHEN l.fail_rate >= 0.35 THEN 'current'
                         WHEN h.historical_fail_rate >= 0.35 THEN 'historical'
                         ELSE 'normal'
                       END AS bottleneck_window
                FROM latest_qualified l
                JOIN historical h ON h.course_id = l.course_id
                WHERE (l.completed_enrollments >= 20 AND l.fail_rate >= 0.35)
                   OR (h.historical_completed_enrollments >= 20 AND h.historical_fail_rate >= 0.35)
                ORDER BY
                    CASE WHEN l.fail_rate >= 0.35 THEN 0 ELSE 1 END,
                    GREATEST(l.fail_rate, h.historical_fail_rate) DESC,
                    h.historical_completed_enrollments DESC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        )
    ).mappings().all()
    created = 0
    for row in rows:
        window = row["bottleneck_window"]
        is_current = window == "current"
        severity = "high" if is_current else "medium"
        title = (
            f"Môn {row['code']} đang là điểm nghẽn"
            if is_current
            else f"Môn {row['code']} từng là điểm nghẽn"
        )
        message = (
            f"Kỳ đủ mẫu gần nhất {row['semester_code']} có fail rate {row['fail_rate']:.1%}, cần rà soát ngay."
            if is_current
            else (
                f"Lịch sử nhiều kỳ có fail rate {row['historical_fail_rate']:.1%}; "
                f"kỳ đủ mẫu gần nhất {row['semester_code']} là {row['fail_rate']:.1%}, cần theo dõi cải tiến."
            )
        )
        evidence = dict(row)
        alert = await create_alert_if_new(
            db,
            AlertCreate(
                alert_type="course_bottleneck",
                severity=severity,
                scope_type="course",
                scope_id=str(row["course_id"]),
                title=title,
                message=message,
                source="dwh",
                evidence_json=evidence,
                dedupe_key=_dedupe("course_bottleneck", window, row["course_id"], row["semester_code"]),
            ),
        )
        created += 1 if alert is not None else 0
    return created


async def generate_outcome_alerts(db: AsyncSession, *, limit: int = 50) -> int:
    if not await _pg_relation_exists(db, "dwh.v_dashboard_outcome_plo"):
        return 0
    rows = (
        await db.execute(
            text(
                """
                SELECT program_id, program_code, program_name, plo_id, plo_code,
                       evidence_count, attainment_pct
                FROM dwh.v_dashboard_outcome_plo
                WHERE attainment_pct < 60 AND evidence_count > 0
                ORDER BY attainment_pct ASC, evidence_count DESC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        )
    ).mappings().all()
    created = 0
    for row in rows:
        alert = await create_alert_if_new(
            db,
            AlertCreate(
                alert_type="outcome_gap",
                severity="medium",
                scope_type="program",
                scope_id=str(row["program_id"]),
                title=f"Chuẩn đầu ra {row['plo_code']} dưới ngưỡng",
                message="PLO/CLO attainment thấp, cần rà soát mapping và kế hoạch cải tiến.",
                source="dwh",
                evidence_json=dict(row),
                dedupe_key=_dedupe("outcome_gap", row["program_id"], row["plo_id"]),
            ),
        )
        created += 1 if alert is not None else 0
    return created


async def generate_data_quality_alerts(db: AsyncSession, *, limit: int = 50) -> int:
    rows = (
        await db.execute(
            select(Section.id, Section.section_code)
            .where(Section.teacher_id.is_(None), Section.is_active == True)  # noqa: E712
            .limit(limit)
        )
    ).mappings().all()
    created = 0
    for row in rows:
        alert = await create_alert_if_new(
            db,
            AlertCreate(
                alert_type="data_quality",
                severity="medium",
                scope_type="section",
                scope_id=str(row["id"]),
                title=f"Lớp {row['section_code']} chưa gán giảng viên",
                message="Lớp học phần thiếu teacher_id nên lecturer workflow và cảnh báo có thể không đúng.",
                source="data_quality",
                evidence_json=dict(row),
                dedupe_key=_dedupe("data_quality", "missing_teacher", row["id"]),
            ),
        )
        created += 1 if alert is not None else 0
    course_rows = (
        await db.execute(
            select(Course.id, Course.code, Course.name)
            .outerjoin(Course.clos)
            .group_by(Course.id, Course.code, Course.name)
            .having(text("COUNT(clos.id) = 0"))
            .limit(limit)
        )
    ).mappings().all()
    for row in course_rows:
        alert = await create_alert_if_new(
            db,
            AlertCreate(
                alert_type="data_quality",
                severity="low",
                scope_type="course",
                scope_id=str(row["id"]),
                title=f"Môn {row['code']} thiếu CLO",
                message="Môn học chưa có CLO nên outcome analytics/report cần gắn cảnh báo dữ liệu.",
                source="data_quality",
                evidence_json=dict(row),
                dedupe_key=_dedupe("data_quality", "missing_clo", row["id"]),
            ),
        )
        created += 1 if alert is not None else 0
    return created


async def generate_system_alerts(db: AsyncSession) -> int:
    if not await _pg_relation_exists(db, "dwh.etl_run"):
        return 0
    rows = (
        await db.execute(
            text(
                """
                SELECT id, status, error_message, started_at
                FROM dwh.etl_run
                WHERE status = 'failed'
                ORDER BY started_at DESC
                LIMIT 1
                """
            )
        )
    ).mappings().all()
    created = 0
    for row in rows:
        alert = await create_alert_if_new(
            db,
            AlertCreate(
                alert_type="system",
                severity="critical",
                scope_type="system",
                scope_id="etl",
                title="ETL DWH thất bại",
                message="Lần refresh DWH gần nhất thất bại, dashboard có thể dùng dữ liệu cũ.",
                source="observability",
                evidence_json=dict(row),
                dedupe_key=_dedupe("system", "etl_failed", row["id"]),
            ),
        )
        created += 1 if alert is not None else 0
    return created

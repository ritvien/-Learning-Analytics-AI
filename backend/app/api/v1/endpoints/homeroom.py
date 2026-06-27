"""Administrative-class homeroom/advisor assignment and observation APIs."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text

from app.access_control import get_teacher_for_user, is_admin, require_department_scope
from app.dependencies import CurrentUser, DBSession, require_write_access
from app.models.academic import Program
from app.models.people import Cohort, HomeroomAssignment, Student, Teacher, UserRole
from app.models.teaching import Enrollment
from app.schemas.people import HomeroomAssignmentCreate, HomeroomAssignmentResponse

router = APIRouter()

HIGH_RISK_STATUSES = {"expelled", "suspended", "dropout", "inactive"}
STATUS_LABELS = {
    "expelled": "buộc thôi học",
    "suspended": "tạm đình chỉ",
    "dropout": "đã thôi học",
    "inactive": "không hoạt động",
}


def _academic_risk(
    *,
    status_value: str,
    cumulative_gpa: float | None,
    failed_courses: int,
    near_fail_courses: int = 0,
    latest_gpa: float | None = None,
    gpa_delta: float | None = None,
) -> dict:
    """Build one deterministic advisor signal shared by class and student views."""
    reasons: list[str] = []
    recommendations: list[str] = []
    normalized_status = status_value.lower()
    high = False
    watch = False
    if normalized_status in HIGH_RISK_STATUSES:
        high = True
        reasons.append(f"Trạng thái học vụ: {STATUS_LABELS.get(normalized_status, status_value)}")
        recommendations.append("Kiểm tra hồ sơ học vụ và tình trạng tiếp tục học")
    if cumulative_gpa is None:
        watch = True
        reasons.append("Chưa có GPA tích lũy")
        recommendations.append("Kiểm tra tình trạng đồng bộ và kết quả học tập")
    elif cumulative_gpa < 2:
        high = True
        reasons.append("GPA tích lũy dưới 2.0")
        recommendations.append("Ưu tiên trao đổi cá nhân và lập kế hoạch cải thiện GPA")
    elif cumulative_gpa < 2.5:
        watch = True
        reasons.append("GPA tích lũy dưới 2.5")
        recommendations.append("Theo dõi tiến độ học tập trong học kỳ tiếp theo")
    if failed_courses >= 3:
        high = True
        reasons.append(f"Có {failed_courses} lượt học phần chưa đạt")
        recommendations.append("Rà soát học phần cần học lại và lịch đăng ký")
    elif failed_courses > 0:
        watch = True
        reasons.append(f"Có {failed_courses} lượt học phần chưa đạt")
        recommendations.append("Theo dõi kế hoạch học lại")
    if latest_gpa is not None and latest_gpa < 2:
        high = True
        reasons.append("GPA học kỳ gần nhất dưới 2.0")
        recommendations.append("Hẹn trao đổi về khó khăn trong học kỳ gần nhất")
    if gpa_delta is not None and gpa_delta <= -0.5:
        high = True
        reasons.append(f"GPA học kỳ giảm {abs(gpa_delta):.2f} điểm")
        recommendations.append("Xác định nguyên nhân suy giảm kết quả gần đây")
    elif gpa_delta is not None and gpa_delta <= -0.25:
        watch = True
        reasons.append(f"GPA học kỳ giảm {abs(gpa_delta):.2f} điểm")
    if near_fail_courses > 0:
        watch = True
    level = "high" if high else "watch" if watch else "normal"
    if not recommendations:
        recommendations.append("Duy trì theo dõi định kỳ")
    return {
        "level": level,
        "reasons": reasons,
        "recommendations": list(dict.fromkeys(recommendations)),
    }


async def _visible_assignments(db: DBSession, user: CurrentUser) -> list[HomeroomAssignment]:
    query = select(HomeroomAssignment).where(HomeroomAssignment.is_active == True)  # noqa: E712
    if is_admin(user):
        pass
    elif user.role == UserRole.lecturer:
        teacher = await get_teacher_for_user(db, user)
        if teacher is None:
            return []
        query = query.where(HomeroomAssignment.teacher_id == teacher.id)
    else:
        department_ids = await require_department_scope(db, user)
        query = query.join(Teacher, Teacher.id == HomeroomAssignment.teacher_id).where(
            Teacher.department_id.in_(department_ids)
        )
    return list((await db.execute(query.order_by(HomeroomAssignment.class_code))).scalars().all())


async def _assignment_or_404(
    db: DBSession,
    user: CurrentUser,
    *,
    assignment_id: int | None = None,
    class_code: str | None = None,
) -> HomeroomAssignment:
    assignments = await _visible_assignments(db, user)
    assignment = next(
        (
            item
            for item in assignments
            if (assignment_id is not None and item.id == assignment_id)
            or (class_code is not None and item.class_code == class_code)
        ),
        None,
    )
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Homeroom class not found")
    return assignment


async def _visible_homeroom_student(
    db: DBSession,
    user: CurrentUser,
    student_id: int,
) -> tuple[Student, HomeroomAssignment]:
    """Resolve a student only through a homeroom assignment visible to the actor."""
    student = await db.get(Student, student_id)
    if student is None or not student.class_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Homeroom student not found")
    assignment = await _assignment_or_404(db, user, class_code=student.class_code)
    return student, assignment


async def _class_summary(db: DBSession, assignment: HomeroomAssignment) -> dict:
    row = (
        await db.execute(
            select(
                func.count(Student.id).label("student_count"),
                func.count(Student.id).filter(Student.is_active == True).label("active_students"),  # noqa: E712
                func.avg(Student.gpa_cumulative).label("avg_gpa"),
                func.count(Student.id).filter(Student.gpa_cumulative < 2).label("low_gpa_count"),
            ).where(Student.class_code == assignment.class_code)
        )
    ).one()
    teacher = await db.get(Teacher, assignment.teacher_id)
    return {
        "assignment_id": assignment.id,
        "class_code": assignment.class_code,
        "teacher_id": assignment.teacher_id,
        "teacher_name": teacher.full_name if teacher else None,
        "student_count": int(row.student_count or 0),
        "active_students": int(row.active_students or 0),
        "avg_gpa": round(float(row.avg_gpa), 2) if row.avg_gpa is not None else None,
        "low_gpa_count": int(row.low_gpa_count or 0),
    }


async def _class_academic_analytics(db: DBSession, class_code: str) -> dict:
    """Return class-level DWH signals; SQLite tests receive an OLTP-safe fallback."""
    if db.get_bind().dialect.name != "postgresql":
        return {"student_signals": {}, "trend": [], "weak_courses": []}

    signal_rows = (
        await db.execute(
            text(
                """
                WITH semester_stats AS (
                    SELECT
                        f.student_id,
                        dsem.semester_id,
                        dsem.code AS semester,
                        dsem.year,
                        dsem.term,
                        SUM(f.grade_4 * f.credits) FILTER (WHERE f.grade_4 IS NOT NULL)
                            / NULLIF(SUM(f.credits) FILTER (WHERE f.grade_4 IS NOT NULL), 0) AS gpa_4,
                        COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS completed,
                        COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed,
                        COUNT(*) FILTER (WHERE f.final_grade >= 4 AND f.final_grade < 5)::INTEGER AS near_fail
                    FROM dwh.fact_enrollment_outcome f
                    JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
                    JOIN students s ON s.id = f.student_id
                    WHERE s.class_code = :class_code
                    GROUP BY f.student_id, dsem.semester_id, dsem.code, dsem.year, dsem.term
                ),
                ranked AS (
                    SELECT *, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY year DESC, term DESC) AS rn
                    FROM semester_stats
                    WHERE completed > 0
                ),
                totals AS (
                    SELECT
                        f.student_id,
                        COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed_courses,
                        COUNT(*) FILTER (WHERE f.final_grade >= 4 AND f.final_grade < 5)::INTEGER AS near_fail_courses,
                        COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS completed_enrollments,
                        COALESCE(SUM(f.credits) FILTER (WHERE f.is_passed IS TRUE), 0)::INTEGER AS earned_credits,
                        COALESCE(
                            ARRAY_AGG(DISTINCT f.course_id) FILTER (WHERE f.is_passed IS FALSE),
                            ARRAY[]::INTEGER[]
                        ) AS failed_course_ids
                    FROM dwh.fact_enrollment_outcome f
                    JOIN students s ON s.id = f.student_id
                    WHERE s.class_code = :class_code
                    GROUP BY f.student_id
                )
                SELECT
                    t.*,
                    latest.semester AS latest_semester,
                    latest.gpa_4::FLOAT AS latest_gpa,
                    previous.gpa_4::FLOAT AS previous_gpa,
                    CASE
                        WHEN latest.gpa_4 IS NOT NULL AND previous.gpa_4 IS NOT NULL
                        THEN ROUND((latest.gpa_4 - previous.gpa_4)::NUMERIC, 2)::FLOAT
                    END AS gpa_delta
                FROM totals t
                LEFT JOIN ranked latest ON latest.student_id = t.student_id AND latest.rn = 1
                LEFT JOIN ranked previous ON previous.student_id = t.student_id AND previous.rn = 2
                """
            ),
            {"class_code": class_code},
        )
    ).mappings().all()

    trend = [
        dict(row)
        for row in (
            await db.execute(
                text(
                    """
                    WITH student_semester AS (
                        SELECT
                            f.student_id,
                            dsem.semester_id,
                            dsem.code AS semester,
                            dsem.year,
                            dsem.term,
                            SUM(f.grade_4 * f.credits) FILTER (WHERE f.grade_4 IS NOT NULL)
                                / NULLIF(SUM(f.credits) FILTER (WHERE f.grade_4 IS NOT NULL), 0) AS gpa_4,
                            COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS completed,
                            COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::INTEGER AS passed,
                            COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed
                        FROM dwh.fact_enrollment_outcome f
                        JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
                        JOIN students s ON s.id = f.student_id
                        WHERE s.class_code = :class_code
                        GROUP BY f.student_id, dsem.semester_id, dsem.code, dsem.year, dsem.term
                    )
                    SELECT
                        semester_id AS id,
                        semester,
                        year,
                        term,
                        COUNT(*) FILTER (WHERE completed > 0)::INTEGER AS student_count,
                        SUM(completed)::INTEGER AS completed_enrollments,
                        SUM(failed)::INTEGER AS failed_enrollments,
                        ROUND(AVG(gpa_4) FILTER (WHERE gpa_4 IS NOT NULL), 2)::FLOAT AS avg_gpa,
                        COALESCE(ROUND(SUM(passed)::DECIMAL / NULLIF(SUM(completed), 0) * 100, 1), 0)::FLOAT AS pass_rate
                    FROM student_semester
                    GROUP BY semester_id, semester, year, term
                    HAVING SUM(completed) > 0
                    ORDER BY year, term
                    """
                ),
                {"class_code": class_code},
            )
        ).mappings().all()
    ]

    weak_courses = [
        dict(row)
        for row in (
            await db.execute(
                text(
                    """
                    SELECT
                        f.course_id AS id,
                        dc.code,
                        dc.name,
                        COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS attempts,
                        COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed,
                        COALESCE(
                            ROUND(
                                COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::DECIMAL
                                / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                                1
                            ),
                            0
                        )::FLOAT AS fail_rate,
                        ROUND(AVG(f.final_grade) FILTER (WHERE f.final_grade IS NOT NULL), 2)::FLOAT AS avg_grade
                    FROM dwh.fact_enrollment_outcome f
                    JOIN dwh.dim_course dc ON dc.course_id = f.course_id
                    JOIN students s ON s.id = f.student_id
                    WHERE s.class_code = :class_code
                    GROUP BY f.course_id, dc.code, dc.name
                    HAVING COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL) >= 10
                    ORDER BY fail_rate DESC, failed DESC
                    LIMIT 10
                    """
                ),
                {"class_code": class_code},
            )
        ).mappings().all()
    ]
    return {
        "student_signals": {int(row["student_id"]): dict(row) for row in signal_rows},
        "trend": trend,
        "weak_courses": weak_courses,
    }


@router.get("/classes")
async def list_homeroom_classes(db: DBSession, current_user: CurrentUser) -> list[dict]:
    """Return only administrative classes assigned inside the current actor's scope."""
    assignments = await _visible_assignments(db, current_user)
    return [await _class_summary(db, assignment) for assignment in assignments]


@router.get("/classes/{class_code}")
async def get_homeroom_class(class_code: str, db: DBSession, current_user: CurrentUser) -> dict:
    """Return students and risk signals for one assigned administrative class."""
    assignment = await _assignment_or_404(db, current_user, class_code=class_code)
    student_rows = (
        await db.execute(
            select(Student, Program.name.label("program_name"))
            .join(Program, Program.id == Student.program_id)
            .where(Student.class_code == assignment.class_code)
            .order_by(Student.gpa_cumulative.asc().nulls_last(), Student.student_code)
        )
    ).all()
    student_ids = [student.id for student, _ in student_rows]
    academic = await _class_academic_analytics(db, assignment.class_code)
    signals: dict[int, dict] = academic["student_signals"]
    failed_by_student: dict[int, int] = {}
    if student_ids and not signals:
        failed_rows = (
            await db.execute(
                select(Enrollment.student_id, func.count(Enrollment.id))
                .where(Enrollment.student_id.in_(student_ids), Enrollment.is_passed == False)  # noqa: E712
                .group_by(Enrollment.student_id)
            )
        ).all()
        failed_by_student = {student_id: int(count) for student_id, count in failed_rows}
    students = []
    for student, program_name in student_rows:
        signal = signals.get(student.id, {})
        failed_count = int(signal.get("failed_courses", failed_by_student.get(student.id, 0)) or 0)
        near_fail_count = int(signal.get("near_fail_courses", 0) or 0)
        cumulative_gpa = float(student.gpa_cumulative) if student.gpa_cumulative is not None else None
        risk = _academic_risk(
            status_value=student.status,
            cumulative_gpa=cumulative_gpa,
            failed_courses=failed_count,
            near_fail_courses=near_fail_count,
            latest_gpa=signal.get("latest_gpa"),
            gpa_delta=signal.get("gpa_delta"),
        )
        students.append(
            {
                "id": student.id,
                "student_code": student.student_code,
                "full_name": student.full_name,
                "program_name": program_name,
                "gpa_cumulative": cumulative_gpa,
                "failed_courses": failed_count,
                "near_fail_courses": near_fail_count,
                "completed_enrollments": int(signal.get("completed_enrollments", 0) or 0),
                "earned_credits": int(signal.get("earned_credits", 0) or 0),
                "failed_course_ids": list(signal.get("failed_course_ids", []) or []),
                "latest_semester": signal.get("latest_semester"),
                "latest_gpa": signal.get("latest_gpa"),
                "gpa_delta": signal.get("gpa_delta"),
                "status": student.status,
                "risk_level": risk["level"],
                "risk_reasons": risk["reasons"],
            }
        )
    summary = await _class_summary(db, assignment)
    risk_counts = {
        level: sum(1 for item in students if item["risk_level"] == level)
        for level in ("high", "watch", "normal")
    }
    return {
        **summary,
        "risk_counts": risk_counts,
        "trend": academic["trend"],
        "weak_courses": academic["weak_courses"],
        "students": students,
    }


@router.get("/students/{student_id}/analytics")
async def get_homeroom_student_analytics(
    student_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Return DWH-backed detail for a student in an assigned administrative class."""
    student, assignment = await _visible_homeroom_student(db, current_user, student_id)
    profile_row = (
        await db.execute(
            select(
                Program.name.label("program_name"),
                Program.code.label("program_code"),
                Cohort.code.label("cohort_code"),
            )
            .join(Student, Student.program_id == Program.id)
            .join(Cohort, Cohort.id == Student.cohort_id)
            .where(Student.id == student.id)
        )
    ).one()

    kpis = dict(
        (
            await db.execute(
                text(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE is_passed IS NOT NULL)::INTEGER AS completed_enrollments,
                        COUNT(*) FILTER (WHERE is_passed IS TRUE)::INTEGER AS passed_courses,
                        COUNT(*) FILTER (WHERE is_passed IS FALSE)::INTEGER AS failed_courses,
                        COUNT(*) FILTER (WHERE final_grade >= 4 AND final_grade < 5)::INTEGER AS near_fail_courses,
                        COALESCE(ROUND(AVG(final_grade) FILTER (WHERE final_grade IS NOT NULL), 2), 0)::FLOAT AS avg_grade,
                        COALESCE(
                            ROUND(
                                COUNT(*) FILTER (WHERE is_passed IS TRUE)::DECIMAL
                                / NULLIF(COUNT(*) FILTER (WHERE is_passed IS NOT NULL), 0) * 100,
                                1
                            ),
                            0
                        )::FLOAT AS pass_rate,
                        COALESCE(SUM(credits) FILTER (WHERE is_passed IS TRUE), 0)::INTEGER AS earned_credits,
                        COALESCE(SUM(credits) FILTER (WHERE is_passed IS NOT NULL), 0)::INTEGER AS attempted_credits
                    FROM dwh.fact_enrollment_outcome
                    WHERE student_id = :student_id
                    """
                ),
                {"student_id": student.id},
            )
        ).mappings().one()
    )

    trend = [
        dict(row)
        for row in (
            await db.execute(
                text(
                    """
                    WITH student_semester AS (
                        SELECT
                            f.semester_id,
                            COALESCE(SUM(f.credits), 0)::INTEGER AS registered_credits,
                            COALESCE(SUM(f.credits) FILTER (WHERE f.is_passed IS TRUE), 0)::INTEGER AS passed_credits,
                            COALESCE(SUM(f.credits) FILTER (WHERE f.is_passed IS FALSE), 0)::INTEGER AS failed_credits,
                            COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS attempted_course_count,
                            COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::INTEGER AS passed_course_count,
                            COUNT(*) FILTER (WHERE f.is_passed IS FALSE)::INTEGER AS failed_course_count,
                            ROUND(
                                SUM(f.grade_4 * f.credits) FILTER (WHERE f.grade_4 IS NOT NULL)
                                / NULLIF(SUM(f.credits) FILTER (WHERE f.grade_4 IS NOT NULL), 0),
                                2
                            )::FLOAT AS gpa_semester,
                            COALESCE(ROUND(AVG(f.final_grade) FILTER (WHERE f.final_grade IS NOT NULL), 2), 0)::FLOAT AS avg_grade
                        FROM dwh.fact_enrollment_outcome f
                        WHERE f.student_id = :student_id
                        GROUP BY f.semester_id
                    ),
                    class_student_semester AS (
                        SELECT
                            f.student_id,
                            f.semester_id,
                            SUM(f.grade_4 * f.credits) FILTER (WHERE f.grade_4 IS NOT NULL)
                                / NULLIF(SUM(f.credits) FILTER (WHERE f.grade_4 IS NOT NULL), 0) AS gpa_4,
                            COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL)::INTEGER AS completed,
                            COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::INTEGER AS passed
                        FROM dwh.fact_enrollment_outcome f
                        JOIN students s ON s.id = f.student_id
                        WHERE s.class_code = :class_code
                        GROUP BY f.student_id, f.semester_id
                    ),
                    class_semester AS (
                        SELECT
                            semester_id,
                            ROUND(AVG(gpa_4) FILTER (WHERE gpa_4 IS NOT NULL), 2)::FLOAT AS class_avg_gpa,
                            COALESCE(ROUND(SUM(passed)::DECIMAL / NULLIF(SUM(completed), 0) * 100, 1), 0)::FLOAT AS class_pass_rate
                        FROM class_student_semester
                        GROUP BY semester_id
                    )
                    SELECT
                        dsem.semester_id AS id,
                        dsem.code AS semester,
                        dsem.name AS semester_name,
                        dsem.year,
                        dsem.term,
                        ss.registered_credits,
                        ss.passed_credits,
                        ss.failed_credits,
                        ss.attempted_course_count,
                        ss.passed_course_count,
                        ss.failed_course_count,
                        ss.gpa_semester,
                        ss.avg_grade,
                        cs.class_avg_gpa,
                        cs.class_pass_rate,
                        COALESCE(
                            ROUND(
                                ss.passed_course_count::DECIMAL
                                / NULLIF(ss.attempted_course_count, 0) * 100,
                                1
                            ),
                            0
                        )::FLOAT AS pass_rate
                    FROM student_semester ss
                    JOIN dwh.dim_semester dsem ON dsem.semester_id = ss.semester_id
                    LEFT JOIN class_semester cs ON cs.semester_id = ss.semester_id
                    WHERE ss.attempted_course_count > 0
                    ORDER BY dsem.year, dsem.term
                    """
                ),
                {"student_id": student.id, "class_code": assignment.class_code},
            )
        ).mappings().all()
    ]

    course_results = [
        dict(row)
        for row in (
            await db.execute(
                text(
                    """
                    WITH class_course AS (
                        SELECT
                            f.course_id,
                            ROUND(AVG(f.final_grade) FILTER (WHERE f.final_grade IS NOT NULL), 2)::FLOAT AS class_avg_grade,
                            COALESCE(
                                ROUND(
                                    COUNT(*) FILTER (WHERE f.is_passed IS TRUE)::DECIMAL
                                    / NULLIF(COUNT(*) FILTER (WHERE f.is_passed IS NOT NULL), 0) * 100,
                                    1
                                ),
                                0
                            )::FLOAT AS class_pass_rate
                        FROM dwh.fact_enrollment_outcome f
                        JOIN students s ON s.id = f.student_id
                        WHERE s.class_code = :class_code
                        GROUP BY f.course_id
                    )
                    SELECT
                        f.enrollment_id AS id,
                        f.course_id,
                        dc.code AS course_code,
                        dc.name AS course_name,
                        f.credits,
                        f.section_id,
                        dsem.semester_id,
                        dsem.code AS semester,
                        dsem.year,
                        dsem.term,
                        f.final_grade::FLOAT AS final_grade,
                        f.grade_4::FLOAT AS grade_4,
                        f.is_passed,
                        f.attempt_number,
                        f.status,
                        cc.class_avg_grade,
                        cc.class_pass_rate,
                        CASE
                            WHEN f.final_grade IS NOT NULL AND cc.class_avg_grade IS NOT NULL
                            THEN ROUND((f.final_grade - cc.class_avg_grade)::NUMERIC, 2)::FLOAT
                        END AS grade_gap
                    FROM dwh.fact_enrollment_outcome f
                    JOIN dwh.dim_course dc ON dc.course_id = f.course_id
                    JOIN dwh.dim_semester dsem ON dsem.semester_id = f.semester_id
                    LEFT JOIN class_course cc ON cc.course_id = f.course_id
                    WHERE f.student_id = :student_id
                    ORDER BY dsem.year DESC, dsem.term DESC, dc.name
                    """
                ),
                {"student_id": student.id, "class_code": assignment.class_code},
            )
        ).mappings().all()
    ]

    competencies = [
        dict(row)
        for row in (
            await db.execute(
                text(
                    """
                    WITH student_plo AS (
                        SELECT
                            p.id,
                            p.code,
                            p.name,
                            p.sort_order,
                            COUNT(*)::INTEGER AS evidence_count,
                            ROUND(AVG(ca.achievement_score), 1)::FLOAT AS score,
                            COALESCE(
                                ROUND(
                                    COUNT(*) FILTER (WHERE ca.is_achieved IS TRUE)::DECIMAL
                                    / NULLIF(COUNT(*) FILTER (WHERE ca.is_achieved IS NOT NULL), 0) * 100,
                                    1
                                ),
                                0
                            )::FLOAT AS attainment_rate
                        FROM dwh.fact_clo_achievement ca
                        JOIN clo_plo_mappings mapping ON mapping.clo_id = ca.clo_id
                        JOIN plos p ON p.id = mapping.plo_id
                        WHERE ca.student_id = :student_id AND p.program_id = :program_id
                        GROUP BY p.id, p.code, p.name, p.sort_order
                    ),
                    class_plo AS (
                        SELECT
                            p.id,
                            ROUND(AVG(ca.achievement_score), 1)::FLOAT AS class_score,
                            COALESCE(
                                ROUND(
                                    COUNT(*) FILTER (WHERE ca.is_achieved IS TRUE)::DECIMAL
                                    / NULLIF(COUNT(*) FILTER (WHERE ca.is_achieved IS NOT NULL), 0) * 100,
                                    1
                                ),
                                0
                            )::FLOAT AS class_attainment_rate
                        FROM dwh.fact_clo_achievement ca
                        JOIN students class_student ON class_student.id = ca.student_id
                        JOIN clo_plo_mappings mapping ON mapping.clo_id = ca.clo_id
                        JOIN plos p ON p.id = mapping.plo_id
                        WHERE class_student.class_code = :class_code AND p.program_id = :program_id
                        GROUP BY p.id
                    )
                    SELECT
                        student_plo.id,
                        student_plo.code,
                        student_plo.name,
                        student_plo.evidence_count,
                        student_plo.score,
                        student_plo.attainment_rate,
                        class_plo.class_score,
                        class_plo.class_attainment_rate
                    FROM student_plo
                    LEFT JOIN class_plo ON class_plo.id = student_plo.id
                    ORDER BY student_plo.sort_order, student_plo.code
                    """
                ),
                {
                    "student_id": student.id,
                    "program_id": student.program_id,
                    "class_code": assignment.class_code,
                },
            )
        ).mappings().all()
    ]

    graded_results = [row for row in course_results if row["final_grade"] is not None]
    weak_courses = sorted(
        graded_results,
        key=lambda row: (
            0 if row["is_passed"] is False else 1,
            row["grade_gap"] if row["grade_gap"] is not None else 999,
            row["final_grade"],
        ),
    )[:6]

    class_stats = (
        await db.execute(
            select(
                func.count(Student.id).label("class_size"),
                func.count(Student.gpa_cumulative).label("students_with_gpa"),
                func.avg(Student.gpa_cumulative).label("avg_gpa"),
            ).where(Student.class_code == assignment.class_code)
        )
    ).one()
    gpa_value = float(student.gpa_cumulative) if student.gpa_cumulative is not None else None
    gpa_rank = None
    if gpa_value is not None:
        students_above = await db.scalar(
            select(func.count(Student.id)).where(
                Student.class_code == assignment.class_code,
                Student.gpa_cumulative > gpa_value,
            )
        )
        gpa_rank = int(students_above or 0) + 1
    latest = trend[-1] if trend else None
    previous = trend[-2] if len(trend) > 1 else None
    latest_gpa = latest["gpa_semester"] if latest else None
    previous_gpa = previous["gpa_semester"] if previous else None
    gpa_delta = (
        round(float(latest_gpa) - float(previous_gpa), 2)
        if latest_gpa is not None and previous_gpa is not None
        else None
    )
    risk = _academic_risk(
        status_value=student.status,
        cumulative_gpa=gpa_value,
        failed_courses=int(kpis["failed_courses"] or 0),
        near_fail_courses=int(kpis["near_fail_courses"] or 0),
        latest_gpa=latest_gpa,
        gpa_delta=gpa_delta,
    )

    return {
        "profile": {
            "id": student.id,
            "student_code": student.student_code,
            "full_name": student.full_name,
            "class_code": student.class_code,
            "program_name": profile_row.program_name,
            "program_code": profile_row.program_code,
            "cohort_code": profile_row.cohort_code,
            "status": student.status,
            "gpa_cumulative": gpa_value,
            "email": student.email,
            "phone": student.phone,
        },
        "class_benchmark": {
            "class_code": assignment.class_code,
            "class_size": int(class_stats.class_size or 0),
            "students_with_gpa": int(class_stats.students_with_gpa or 0),
            "avg_gpa": round(float(class_stats.avg_gpa), 2) if class_stats.avg_gpa is not None else None,
            "gpa_rank": gpa_rank,
        },
        "kpis": kpis,
        "trend": trend,
        "course_results": course_results,
        "weak_courses": weak_courses,
        "competencies": competencies,
        "risk": risk,
    }


@router.get("/assignments", response_model=list[HomeroomAssignmentResponse])
async def list_homeroom_assignments(db: DBSession, current_user: CurrentUser) -> list[HomeroomAssignment]:
    return await _visible_assignments(db, current_user)


@router.post(
    "/assignments",
    response_model=HomeroomAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_homeroom_assignment(
    payload: HomeroomAssignmentCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> HomeroomAssignment:
    teacher = await db.get(Teacher, payload.teacher_id)
    if teacher is None or not teacher.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    department_ids = {teacher.department_id} if is_admin(current_user) else await require_department_scope(db, current_user)
    if teacher.department_id not in department_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher scope is outside your permissions")
    class_departments = set(
        (
            await db.execute(
                select(Program.department_id)
                .join(Student, Student.program_id == Program.id)
                .where(Student.class_code == payload.class_code.strip())
                .distinct()
            )
        ).scalars().all()
    )
    if not class_departments:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Administrative class not found")
    if class_departments != {teacher.department_id}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class and teacher must belong to one department")
    existing = (
        await db.execute(
            select(HomeroomAssignment).where(
                HomeroomAssignment.class_code == payload.class_code.strip(),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.teacher_id = teacher.id
        existing.is_active = True
        await db.flush()
        await db.refresh(existing)
        return existing
    assignment = HomeroomAssignment(teacher_id=teacher.id, class_code=payload.class_code.strip())
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return assignment


@router.delete(
    "/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_write_access)],
)
async def delete_homeroom_assignment(
    assignment_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> None:
    assignment = await _assignment_or_404(db, current_user, assignment_id=assignment_id)
    assignment.is_active = False
    await db.flush()

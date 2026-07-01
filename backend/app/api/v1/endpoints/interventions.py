"""Learning-support intervention APIs for at-risk students and contact history."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, exists, func, select, text
from sqlalchemy.orm import selectinload

from app.access_control import (
    can_access_section,
    can_access_student,
    get_teacher_for_user,
    is_admin,
    require_department_scope,
)
from app.dependencies import CurrentUser, DBSession
from app.models.academic import Course, Program, Semester, program_courses
from app.models.intervention import (
    InterventionCampaign,
    InterventionCase,
    InterventionCaseEvent,
    InterventionMessage,
    StudentInterventionContact,
)
from app.models.people import Cohort, HomeroomAssignment, Student, Teacher, UserRole
from app.models.teaching import Enrollment, Section
from app.schemas.intervention import (
    InterventionBulkNotifyRequest,
    InterventionContactCreate,
    InterventionDraftRequest,
    InterventionScopeSummaryRequest,
)

router = APIRouter()

HIGH_RISK_STATUSES = {"expelled", "suspended", "dropout", "inactive", "withdrawn"}


def require_intervention_actor(user: CurrentUser) -> None:
    """Only scoped lecturers/advisors may contact students."""
    if user.role != UserRole.lecturer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the responsible lecturer or advisor may contact students",
        )


def _float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _int(value: Any) -> int:
    return int(value or 0)


def _iso(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else str(value) if value else None


def _course_explanation(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _signal_payloads(
    *,
    student: Student,
    fail_count: int,
    near_fail_count: int,
    current_grade: float | None = None,
    dropout: dict | None = None,
    course_prediction: dict | None = None,
) -> list[dict]:
    signals: list[dict] = []
    academic_reasons = []
    gpa = _float(student.gpa_cumulative)
    if gpa is None:
        academic_reasons.append("Chưa có GPA tích lũy")
    elif gpa < 2:
        academic_reasons.append("GPA tích lũy dưới 2.0")
    elif gpa < 2.5:
        academic_reasons.append("GPA tích lũy dưới 2.5")
    if fail_count:
        academic_reasons.append(f"Có {fail_count} lượt học phần chưa đạt")
    if near_fail_count:
        academic_reasons.append(f"Có {near_fail_count} lượt học phần cận ngưỡng trượt")
    if current_grade is not None and current_grade < 5.5:
        academic_reasons.append("Điểm lớp học phần hiện tại dưới hoặc sát ngưỡng đạt")
    if academic_reasons:
        signals.append(
            {
                "type": "academic_rule",
                "level": "high" if (gpa is not None and gpa < 2) or fail_count >= 3 or (current_grade is not None and current_grade < 5) else "watch",
                "label": "Học vụ",
                "reason": "; ".join(academic_reasons),
                "probability": None,
                "model_name": None,
                "model_version": None,
                "scored_at": None,
                "top_factors": [],
            }
        )
    dropout = dropout or {}
    dropout_probability = _float(dropout.get("dropout_probability"))
    if dropout_probability is not None:
        dropout_level = str(dropout.get("risk_level") or "normal")
        signals.append(
            {
                "type": "dropout_ml",
                "level": "high" if dropout_level == "high" or dropout_probability >= 0.7 else "watch" if dropout_level == "medium" or dropout_probability >= 0.4 else "normal",
                "label": "Dropout ML",
                "reason": "Tín hiệu nguy cơ gián đoạn học tập từ mô hình dropout",
                "probability": dropout_probability,
                "model_name": dropout.get("model_name"),
                "model_version": dropout.get("model_version"),
                "scored_at": _iso(dropout.get("scored_at")),
                "top_factors": dropout.get("top_factors") or [],
            }
        )
    course_prediction = course_prediction or {}
    fail_probability = _float(course_prediction.get("fail_probability"))
    if fail_probability is not None:
        explanation = _course_explanation(course_prediction.get("explanation"))
        reasons = explanation.get("reasons") or []
        signals.append(
            {
                "type": "course_failure_rule",
                "level": "high" if fail_probability >= 0.6 else "watch" if fail_probability >= 0.3 else "normal",
                "label": "Ước tính nguy cơ theo quy tắc",
                "reason": "; ".join(str(reason) for reason in reasons[:2]) or "Tín hiệu nguy cơ chưa đạt học phần",
                "probability": fail_probability,
                "model_name": course_prediction.get("model_name"),
                "model_version": course_prediction.get("model_version"),
                "model_type": explanation.get("model_type", "transparent_rule_baseline"),
                "source": "course_failure_rule",
                "availability": explanation.get("availability", "ready"),
                "component_weight_coverage": explanation.get("component_weight_coverage"),
                "scored_at": _iso(course_prediction.get("scored_at")),
                "top_factors": [],
            }
        )
    return signals


def _confidence(signals: list[dict], *, expected_prediction_types: int = 2) -> dict:
    prediction_signals = [
        signal for signal in signals if signal["type"] in {"dropout_ml", "course_failure_rule"}
    ]
    scored_times = [signal["scored_at"] for signal in prediction_signals if signal.get("scored_at")]
    stale = False
    for value in scored_times:
        try:
            scored_at = datetime.fromisoformat(value)
            if scored_at.tzinfo is None:
                scored_at = scored_at.replace(tzinfo=UTC)
            stale = stale or (datetime.now(UTC) - scored_at).days > 90
        except ValueError:
            stale = True
    coverage = min(1.0, len(prediction_signals) / expected_prediction_types) if expected_prediction_types else 1.0
    level = "low" if not prediction_signals or stale else "high" if coverage >= 1 else "medium"
    return {
        "level": level,
        "prediction_coverage": coverage,
        "ml_coverage": coverage,
        "is_stale": stale,
        "latest_scored_at": max(scored_times) if scored_times else None,
        "warning": "Score đã cũ; cần chạy lại pipeline trước quyết định." if stale else "Tín hiệu hỗ trợ, không phải kết luận học vụ.",
    }


def _risk_from_signals(
    *,
    status_value: str,
    cumulative_gpa: float | None,
    fail_count: int,
    near_fail_count: int = 0,
    current_grade: float | None = None,
    dropout_probability: float | None = None,
    dropout_level: str | None = None,
    course_fail_probability: float | None = None,
) -> dict:
    reasons: list[str] = []
    actions: list[str] = []
    score = 0

    if status_value.lower() in HIGH_RISK_STATUSES:
        score += 40
        reasons.append(f"Trạng thái học vụ cần chú ý: {status_value}")
        actions.append("Xác minh tình trạng học vụ và khả năng tiếp tục học")
    if cumulative_gpa is None:
        score += 15
        reasons.append("Chưa có GPA tích lũy")
        actions.append("Kiểm tra dữ liệu điểm và tình trạng đồng bộ")
    elif cumulative_gpa < 2:
        score += 40
        reasons.append("GPA tích lũy dưới 2.0")
        actions.append("Hẹn trao đổi cá nhân và lập kế hoạch cải thiện GPA")
    elif cumulative_gpa < 2.5:
        score += 20
        reasons.append("GPA tích lũy dưới 2.5")
        actions.append("Theo dõi tiến độ học tập trong học kỳ hiện tại")

    if fail_count >= 3:
        score += 35
        reasons.append(f"Có {fail_count} lượt học phần chưa đạt")
        actions.append("Rà soát học phần cần học lại và lịch đăng ký phù hợp")
    elif fail_count > 0:
        score += 18
        reasons.append(f"Có {fail_count} lượt học phần chưa đạt")
        actions.append("Trao đổi về kế hoạch học lại hoặc củng cố kiến thức")

    if near_fail_count > 0:
        score += min(15, near_fail_count * 5)
        reasons.append(f"Có {near_fail_count} lượt học phần cận ngưỡng trượt")

    if current_grade is not None and current_grade < 5:
        score += 25
        reasons.append("Điểm lớp học phần hiện tại dưới ngưỡng đạt")
        actions.append("Ưu tiên hỗ trợ học phần đang có nguy cơ trượt")
    elif current_grade is not None and current_grade < 5.5:
        score += 12
        reasons.append("Điểm lớp học phần hiện tại sát ngưỡng đạt")

    if dropout_probability is not None:
        if dropout_probability >= 0.7 or dropout_level == "high":
            score += 35
            reasons.append(f"ML dropout risk cao ({dropout_probability:.0%})")
            actions.append("Ưu tiên trao đổi sớm và ghi nhận kế hoạch hỗ trợ")
        elif dropout_probability >= 0.4 or dropout_level == "medium":
            score += 18
            reasons.append(f"ML dropout risk cần theo dõi ({dropout_probability:.0%})")

    if course_fail_probability is not None:
        if course_fail_probability >= 0.6:
            score += 28
            reasons.append(f"Nguy cơ trượt học phần cao ({course_fail_probability:.0%})")
            actions.append("Rà soát điểm thành phần và hỗ trợ học phần này trước")
        elif course_fail_probability >= 0.3:
            score += 14
            reasons.append(f"Nguy cơ trượt học phần cần theo dõi ({course_fail_probability:.0%})")

    level = "high" if score >= 60 else "watch" if score >= 20 else "normal"
    if not actions:
        actions.append("Duy trì theo dõi định kỳ")
    return {
        "risk_level": level,
        "risk_score": min(100, score),
        "reasons": list(dict.fromkeys(reasons)),
        "recommended_actions": list(dict.fromkeys(actions)),
    }


async def _require_homeroom_scope(db: DBSession, user: CurrentUser, class_code: str) -> HomeroomAssignment:
    query = select(HomeroomAssignment).where(
        HomeroomAssignment.class_code == class_code,
        HomeroomAssignment.is_active == True,  # noqa: E712
    )
    if is_admin(user):
        pass
    elif user.role == UserRole.lecturer:
        teacher = await get_teacher_for_user(db, user)
        if teacher is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Homeroom class not found")
        query = query.where(HomeroomAssignment.teacher_id == teacher.id)
    else:
        department_ids = await require_department_scope(db, user)
        query = query.join(Teacher, Teacher.id == HomeroomAssignment.teacher_id).where(
            Teacher.department_id.in_(department_ids)
        )
    assignment = (await db.execute(query)).scalar_one_or_none()
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Homeroom class not found")
    return assignment


async def _dropout_predictions(db: DBSession, student_ids: list[int]) -> dict[int, dict]:
    if not student_ids or db.get_bind().dialect.name != "postgresql":
        return {}
    rows = (
        await db.execute(
            text(
                """
                SELECT DISTINCT ON (p.student_id)
                    p.student_id,
                    p.dropout_probability,
                    p.risk_level,
                    p.top_factors,
                    p.scored_at,
                    r.model_name,
                    r.model_version
                FROM ml.student_dropout_prediction p
                JOIN ml.model_run r ON r.id = p.model_run_id
                WHERE p.student_id = ANY(:student_ids) AND r.status = 'completed'
                ORDER BY p.student_id, p.scored_at DESC
                """
            ),
            {"student_ids": student_ids},
        )
    ).mappings().all()
    return {int(row["student_id"]): dict(row) for row in rows}


async def _course_failure_predictions(db: DBSession, enrollment_ids: list[int]) -> dict[int, dict]:
    if not enrollment_ids or db.get_bind().dialect.name != "postgresql":
        return {}
    rows = (
        await db.execute(
            text(
                """
                SELECT DISTINCT ON (p.enrollment_id)
                    p.enrollment_id,
                    p.pass_probability,
                    p.fail_probability,
                    p.predicted_status,
                    p.explanation,
                    p.scored_at,
                    r.model_name,
                    r.model_version
                FROM ml.enrollment_prediction p
                JOIN ml.model_run r ON r.id = p.model_run_id
                JOIN public.enrollments e ON e.id = p.enrollment_id
                WHERE p.enrollment_id = ANY(:enrollment_ids)
                  AND r.status = 'completed'
                  AND e.status = 'enrolled'
                  AND e.completed_at IS NULL
                  AND e.final_grade IS NULL
                  AND e.is_passed IS NULL
                ORDER BY p.enrollment_id, p.scored_at DESC
                """
            ),
            {"enrollment_ids": enrollment_ids},
        )
    ).mappings().all()
    result = {}
    for row in rows:
        payload = dict(row)
        explanation = _course_explanation(payload.get("explanation"))
        payload["explanation"] = explanation
        payload["model_type"] = explanation.get("model_type", "transparent_rule_baseline")
        payload["source"] = "course_failure_rule"
        result[int(row["enrollment_id"])] = payload
    return result


async def _contact_counts(db: DBSession, student_ids: list[int], *, section_id: int | None = None, class_code: str | None = None) -> dict[int, dict]:
    if not student_ids:
        return {}
    query = (
        select(
            StudentInterventionContact.student_id,
            func.count(StudentInterventionContact.id).label("contact_count"),
            func.max(StudentInterventionContact.created_at).label("last_contacted_at"),
        )
        .where(StudentInterventionContact.student_id.in_(student_ids))
        .group_by(StudentInterventionContact.student_id)
    )
    if section_id is not None:
        query = query.where(StudentInterventionContact.section_id == section_id)
    if class_code is not None:
        query = query.where(StudentInterventionContact.class_code == class_code)
    rows = (await db.execute(query)).all()
    return {
        int(student_id): {"contact_count": int(count or 0), "last_contacted_at": last_contacted_at}
        for student_id, count, last_contacted_at in rows
    }


async def _global_failure_counts(db: DBSession, student_ids: list[int]) -> dict[int, dict]:
    if not student_ids:
        return {}
    rows = (
        await db.execute(
            select(
                Enrollment.student_id,
                func.count(Enrollment.id).filter(Enrollment.is_passed == False).label("fail_count"),  # noqa: E712
                func.count(Enrollment.id)
                .filter(Enrollment.final_grade >= 4, Enrollment.final_grade < 5)
                .label("near_fail_count"),
            )
            .where(Enrollment.student_id.in_(student_ids))
            .group_by(Enrollment.student_id)
        )
    ).all()
    return {
        int(student_id): {"fail_count": _int(fail_count), "near_fail_count": _int(near_fail_count)}
        for student_id, fail_count, near_fail_count in rows
    }


def _summary(rows: list[dict]) -> dict:
    return {
        "total": len(rows),
        "high": sum(1 for row in rows if row["risk_level"] == "high"),
        "watch": sum(1 for row in rows if row["risk_level"] == "watch"),
        "normal": sum(1 for row in rows if row["risk_level"] == "normal"),
        "contacted": sum(1 for row in rows if row.get("contact_count", 0) > 0),
    }


def _workflow_actions(scope_type: str) -> list[dict]:
    label = "lớp học phần" if scope_type == "section" else "lớp cố vấn"
    return [
        {
            "id": "review_priority",
            "label": "Rà soát danh sách ưu tiên",
            "description": f"Xem nhóm high/watch trong {label} và kiểm tra lý do cảnh báo.",
            "endpoint": f"/api/v1/interventions/{'sections/{section_id}' if scope_type == 'section' else 'homeroom/{class_code}'}/at-risk-students",
        },
        {
            "id": "draft_messages",
            "label": "Soạn thông điệp hỗ trợ",
            "description": "Tạo draft email/tin nhắn theo tín hiệu học vụ, giảng viên/cố vấn duyệt trước khi gửi.",
            "endpoint": "/api/v1/intervention-campaigns",
        },
        {
            "id": "log_contact",
            "label": "Ghi nhận trao đổi",
            "description": "Lưu lịch sử liên hệ, cuộc hẹn, hoặc ghi chú cố vấn vào hồ sơ sinh viên.",
            "endpoint": "/api/v1/interventions/contact",
        },
    ]


async def _campaign_summary(
    db: DBSession,
    *,
    section_id: int | None = None,
    class_code: str | None = None,
) -> dict:
    query = select(
        InterventionCampaign.status,
        func.count(InterventionCampaign.id).label("campaign_count"),
    ).group_by(InterventionCampaign.status)
    if section_id is not None:
        query = query.where(InterventionCampaign.section_id == section_id)
    if class_code:
        query = query.where(InterventionCampaign.class_code == class_code)
    status_counts = {
        status_value: int(count or 0)
        for status_value, count in (await db.execute(query)).all()
    }
    message_query = select(
        InterventionMessage.status,
        func.count(InterventionMessage.id).label("message_count"),
    ).join(InterventionCampaign, InterventionCampaign.id == InterventionMessage.campaign_id).group_by(
        InterventionMessage.status
    )
    if section_id is not None:
        message_query = message_query.where(InterventionCampaign.section_id == section_id)
    if class_code:
        message_query = message_query.where(InterventionCampaign.class_code == class_code)
    message_counts = {
        status_value: int(count or 0)
        for status_value, count in (await db.execute(message_query)).all()
    }
    recent_rows = (
        await db.execute(

                select(InterventionCampaign)
                .where(InterventionCampaign.section_id == section_id if section_id is not None else True)
                .where(InterventionCampaign.class_code == class_code if class_code else True)
                .order_by(desc(InterventionCampaign.created_at), desc(InterventionCampaign.id))
                .limit(5)

        )
    ).scalars().all()
    return {
        "campaign_status_counts": status_counts,
        "message_status_counts": message_counts,
        "recent_campaigns": [
            {
                "id": campaign.id,
                "title": campaign.title,
                "status": campaign.status,
                "objective": campaign.objective,
                "created_at": campaign.created_at,
                "updated_at": campaign.updated_at,
            }
            for campaign in recent_rows
        ],
    }


async def _latest_semester_predictions(db: DBSession, student_ids: list[int]) -> dict[int, dict]:
    if not student_ids or db.get_bind().dialect.name != "postgresql":
        return {}
    rows = (
        await db.execute(
            text(
                """
                SELECT DISTINCT ON (p.student_id)
                    p.student_id,
                    p.semester_id,
                    sem.code AS semester_code,
                    p.registered_credits,
                    p.expected_passed_credits,
                    p.expected_failed_credits,
                    p.high_risk_failed_credits,
                    p.risk_level,
                    p.scored_at,
                    r.model_name,
                    r.model_version
                FROM ml.student_semester_prediction p
                JOIN ml.model_run r ON r.id = p.model_run_id
                JOIN public.semesters sem ON sem.id = p.semester_id
                WHERE p.student_id = ANY(:student_ids) AND r.status = 'completed'
                ORDER BY p.student_id, p.scored_at DESC
                """
            ),
            {"student_ids": student_ids},
        )
    ).mappings().all()
    return {int(row["student_id"]): dict(row) for row in rows}


def _bulk_message(student: dict, template: str | None = None) -> str:
    if template:
        return (
            template.replace("{full_name}", str(student.get("full_name") or ""))
            .replace("{student_code}", str(student.get("student_code") or ""))
            .replace("{reasons}", "; ".join(student.get("reasons") or []))
            .replace("{actions}", "; ".join(student.get("recommended_actions") or []))
        )
    reasons = student.get("reasons") or ["cần trao đổi định kỳ về tình hình học tập"]
    actions = student.get("recommended_actions") or ["Duy trì theo dõi định kỳ"]
    lines = [
        f"Chào {student.get('full_name')},",
        "",
        "Thầy/cô muốn trao đổi với em về tình hình học tập hiện tại để cùng tìm cách hỗ trợ phù hợp.",
        "Một số tín hiệu cần chú ý:",
        *[f"- {reason}" for reason in reasons[:4]],
        "",
        "Đề xuất bước tiếp theo:",
        *[f"- {action}" for action in actions[:3]],
        "",
        "Em phản hồi thời gian thuận tiện để thầy/cô hẹn trao đổi ngắn trong tuần này nhé.",
        "",
        "Trân trọng.",
    ]
    return "\n".join(lines)


async def _scope_payload_for_bulk(
    db: DBSession,
    user: CurrentUser,
    payload: InterventionBulkNotifyRequest,
) -> tuple[dict, int | None, str | None]:
    if payload.scope_type == "section":
        if payload.scope_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="scope_id is required for section")
        return await _section_at_risk_payload(db, user, payload.scope_id), payload.scope_id, None
    if not payload.class_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="class_code is required for homeroom")
    return await _homeroom_at_risk_payload(db, user, payload.class_code), None, payload.class_code


def _bulk_candidates(data: dict, payload: InterventionBulkNotifyRequest) -> list[dict]:
    selected_ids = set(payload.student_ids or [])
    if selected_ids:
        return [row for row in data["students"] if row["student_id"] in selected_ids][: payload.max_students]
    return [
        row
        for row in data["students"]
        if row["risk_level"] in {"high", "watch"}
    ][: payload.max_students]


async def _section_at_risk_payload(db: DBSession, user: CurrentUser, section_id: int) -> dict:
    if not await can_access_section(db, user, section_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    section_row = (
        await db.execute(
            select(
                Section.id,
                Section.section_code,
                Course.name.label("course_name"),
                Course.code.label("course_code"),
                Semester.code.label("semester_code"),
            )
            .join(Course, Course.id == Section.course_id)
            .join(Semester, Semester.id == Section.semester_id)
            .where(Section.id == section_id)
        )
    ).one_or_none()
    if section_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    enrollment_rows = (
        await db.execute(
            select(Enrollment, Student, Program.name.label("program_name"))
            .join(Student, Student.id == Enrollment.student_id)
            .join(Program, Program.id == Student.program_id)
            .where(Enrollment.section_id == section_id)
            .order_by(Student.gpa_cumulative.asc().nulls_last(), Student.student_code)
        )
    ).all()
    student_ids = [student.id for _, student, _ in enrollment_rows]
    enrollment_ids = [enrollment.id for enrollment, _, _ in enrollment_rows]
    failures = await _global_failure_counts(db, student_ids)
    predictions = await _dropout_predictions(db, student_ids)
    course_predictions = await _course_failure_predictions(db, enrollment_ids)
    contacts = await _contact_counts(db, student_ids, section_id=section_id)

    rows = []
    for enrollment, student, program_name in enrollment_rows:
        signal = failures.get(student.id, {})
        prediction = predictions.get(student.id, {})
        course_prediction = course_predictions.get(enrollment.id, {})
        dropout_probability = _float(prediction.get("dropout_probability"))
        course_fail_probability = _float(course_prediction.get("fail_probability"))
        current_grade = _float(enrollment.final_grade)
        risk = _risk_from_signals(
            status_value=student.status,
            cumulative_gpa=_float(student.gpa_cumulative),
            fail_count=_int(signal.get("fail_count")),
            near_fail_count=_int(signal.get("near_fail_count")),
            current_grade=current_grade,
            dropout_probability=dropout_probability,
            dropout_level=prediction.get("risk_level"),
            course_fail_probability=course_fail_probability,
        )
        signals = _signal_payloads(
            student=student,
            fail_count=_int(signal.get("fail_count")),
            near_fail_count=_int(signal.get("near_fail_count")),
            current_grade=current_grade,
            dropout=prediction,
            course_prediction=course_prediction,
        )
        contact = contacts.get(student.id, {})
        rows.append(
            {
                "student_id": student.id,
                "student_code": student.student_code,
                "full_name": student.full_name,
                "program_name": program_name,
                "class_code": student.class_code,
                "email": student.email,
                "phone": student.phone,
                "status": student.status,
                "gpa_cumulative": _float(student.gpa_cumulative),
                "section_id": section_id,
                "current_grade": current_grade,
                "current_is_passed": enrollment.is_passed,
                "fail_count": _int(signal.get("fail_count")),
                "near_fail_count": _int(signal.get("near_fail_count")),
                "dropout_probability": dropout_probability,
                "dropout_risk_level": prediction.get("risk_level"),
                "course_fail_probability": course_fail_probability,
                "course_predicted_status": course_prediction.get("predicted_status"),
                "top_factors": prediction.get("top_factors") or [],
                "last_contacted_at": contact.get("last_contacted_at"),
                "contact_count": contact.get("contact_count", 0),
                "support_priority": risk["risk_level"],
                "signals": signals,
                "data_confidence": _confidence(signals),
                **risk,
            }
        )
    rows.sort(key=lambda row: (-row["risk_score"], row["gpa_cumulative"] is None, row["gpa_cumulative"] or 99))
    return {
        "scope": {
            "type": "section",
            "id": section_row.id,
            "code": section_row.section_code,
            "course_code": section_row.course_code,
            "course_name": section_row.course_name,
            "semester_code": section_row.semester_code,
        },
        "summary": _summary(rows),
        "students": rows,
    }


async def _homeroom_at_risk_payload(db: DBSession, user: CurrentUser, class_code: str) -> dict:
    assignment = await _require_homeroom_scope(db, user, class_code)
    student_rows = (
        await db.execute(
            select(Student, Program.name.label("program_name"), Cohort.code.label("cohort_code"))
            .join(Program, Program.id == Student.program_id)
            .join(Cohort, Cohort.id == Student.cohort_id)
            .where(Student.class_code == assignment.class_code)
            .order_by(Student.gpa_cumulative.asc().nulls_last(), Student.student_code)
        )
    ).all()
    student_ids = [student.id for student, _, _ in student_rows]
    failures = await _global_failure_counts(db, student_ids)
    predictions = await _dropout_predictions(db, student_ids)
    contacts = await _contact_counts(db, student_ids, class_code=assignment.class_code)

    rows = []
    for student, program_name, cohort_code in student_rows:
        signal = failures.get(student.id, {})
        prediction = predictions.get(student.id, {})
        dropout_probability = _float(prediction.get("dropout_probability"))
        risk = _risk_from_signals(
            status_value=student.status,
            cumulative_gpa=_float(student.gpa_cumulative),
            fail_count=_int(signal.get("fail_count")),
            near_fail_count=_int(signal.get("near_fail_count")),
            dropout_probability=dropout_probability,
            dropout_level=prediction.get("risk_level"),
        )
        signals = _signal_payloads(
            student=student,
            fail_count=_int(signal.get("fail_count")),
            near_fail_count=_int(signal.get("near_fail_count")),
            dropout=prediction,
        )
        contact = contacts.get(student.id, {})
        rows.append(
            {
                "student_id": student.id,
                "student_code": student.student_code,
                "full_name": student.full_name,
                "program_name": program_name,
                "cohort_code": cohort_code,
                "class_code": student.class_code,
                "email": student.email,
                "phone": student.phone,
                "status": student.status,
                "gpa_cumulative": _float(student.gpa_cumulative),
                "fail_count": _int(signal.get("fail_count")),
                "near_fail_count": _int(signal.get("near_fail_count")),
                "dropout_probability": dropout_probability,
                "dropout_risk_level": prediction.get("risk_level"),
                "top_factors": prediction.get("top_factors") or [],
                "last_contacted_at": contact.get("last_contacted_at"),
                "contact_count": contact.get("contact_count", 0),
                "support_priority": risk["risk_level"],
                "signals": signals,
                "data_confidence": _confidence(signals, expected_prediction_types=1),
                **risk,
            }
        )
    rows.sort(key=lambda row: (-row["risk_score"], row["gpa_cumulative"] is None, row["gpa_cumulative"] or 99))
    teacher = await db.get(Teacher, assignment.teacher_id)
    return {
        "scope": {
            "type": "homeroom",
            "id": assignment.id,
            "code": assignment.class_code,
            "teacher_name": teacher.full_name if teacher else None,
        },
        "summary": _summary(rows),
        "students": rows,
    }


async def _require_contact_scope(
    db: DBSession,
    user: CurrentUser,
    *,
    student_id: int,
    section_id: int | None = None,
    class_code: str | None = None,
) -> None:
    if section_id is not None:
        if not await can_access_section(db, user, section_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Section is outside your scope")
        enrolled = await db.scalar(
            select(func.count(Enrollment.id)).where(
                Enrollment.student_id == student_id,
                Enrollment.section_id == section_id,
            )
        )
        if not enrolled:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student is not enrolled in section")
        return
    if class_code:
        await _require_homeroom_scope(db, user, class_code)
        in_class = await db.scalar(select(func.count(Student.id)).where(Student.id == student_id, Student.class_code == class_code))
        if not in_class:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student is not in homeroom class")
        return
    if not await can_access_student(db, user, student_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student is outside your scope")


def _contact_payload(contact: StudentInterventionContact, actor_name: str | None = None) -> dict:
    actor = contact.__dict__.get("actor")
    return {
        "id": contact.id,
        "case_id": contact.case_id,
        "actor_user_id": contact.actor_user_id,
        "actor_name": actor_name if actor_name is not None else actor.full_name if actor else None,
        "student_id": contact.student_id,
        "section_id": contact.section_id,
        "class_code": contact.class_code,
        "channel": contact.channel,
        "status": contact.status,
        "subject": contact.subject,
        "message": contact.message,
        "note": contact.note,
        "metadata_json": contact.metadata_json or {},
        "created_at": contact.created_at,
        "updated_at": contact.updated_at,
    }


@router.get("/sections/worklist")
async def get_section_intervention_worklist(
    db: DBSession,
    current_user: CurrentUser,
    semester_code: str | None = None,
    department_id: int | None = None,
    program_id: int | None = None,
    course_id: int | None = None,
    limit: int = Query(default=500, ge=1, le=2000),
) -> dict:
    """Return a batch, ML-enriched section worklist within the authenticated actor scope."""
    if current_user.role not in {UserRole.superadmin, UserRole.admin, UserRole.manager, UserRole.lecturer}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role cannot access intervention worklists")
    query = (
        select(
            Section.id,
            Section.section_code,
            Section.course_id,
            Section.semester_id,
            Course.code.label("course_code"),
            Course.name.label("course_name"),
            Course.department_id,
            Semester.code.label("semester_code"),
            Semester.name.label("semester_name"),
            Teacher.full_name.label("teacher_name"),
        )
        .join(Course, Course.id == Section.course_id)
        .join(Semester, Semester.id == Section.semester_id)
        .outerjoin(Teacher, Teacher.id == Section.teacher_id)
        .where(Section.is_active == True)  # noqa: E712
    )
    if current_user.role == UserRole.lecturer:
        teacher = await get_teacher_for_user(db, current_user)
        if teacher is None:
            return {"summary": {}, "sections": []}
        query = query.where(Section.teacher_id == teacher.id)
    elif current_user.role == UserRole.manager:
        department_ids = await require_department_scope(db, current_user)
        query = query.where(Course.department_id.in_(department_ids))
    if semester_code:
        query = query.where(Semester.code == semester_code)
    if department_id is not None:
        if not is_admin(current_user) and department_id not in await require_department_scope(db, current_user):
            raise HTTPException(status_code=403, detail="Department is outside your scope")
        query = query.where(Course.department_id == department_id)
    if program_id is not None:
        query = query.where(
            exists().where(program_courses.c.course_id == Course.id, program_courses.c.program_id == program_id)
        )
    if course_id is not None:
        query = query.where(Course.id == course_id)
    section_rows = (await db.execute(query.order_by(desc(Semester.year), desc(Semester.term), Section.id).limit(limit))).mappings().all()
    section_ids = [int(row["id"]) for row in section_rows]
    if not section_ids:
        return {
            "summary": {"total_sections": 0, "needs_action": 0, "students_with_signals": 0, "open_cases": 0},
            "sections": [],
        }
    enrollment_rows = (
        await db.execute(
            select(Enrollment, Student)
            .join(Student, Student.id == Enrollment.student_id)
            .where(Enrollment.section_id.in_(section_ids))
        )
    ).all()
    student_ids = list({student.id for _, student in enrollment_rows})
    enrollment_ids = [enrollment.id for enrollment, _ in enrollment_rows]
    failures = await _global_failure_counts(db, student_ids)
    dropout_predictions = await _dropout_predictions(db, student_ids)
    course_predictions = await _course_failure_predictions(db, enrollment_ids)
    enrollments_by_section: dict[int, list[tuple[Enrollment, Student]]] = defaultdict(list)
    for enrollment, student in enrollment_rows:
        enrollments_by_section[enrollment.section_id].append((enrollment, student))

    case_rows = (
        await db.execute(select(InterventionCase).where(InterventionCase.section_id.in_(section_ids)))
    ).scalars().all()
    cases_by_section: dict[int, list[InterventionCase]] = defaultdict(list)
    for item in case_rows:
        if item.section_id is not None:
            cases_by_section[item.section_id].append(item)

    rows = []
    for section in section_rows:
        section_id = int(section["id"])
        enrollments = enrollments_by_section.get(section_id, [])
        valid = [enrollment for enrollment, _ in enrollments if enrollment.is_passed is not None]
        graded = [enrollment for enrollment, _ in enrollments if enrollment.final_grade is not None]
        failed_count = sum(enrollment.is_passed is False for enrollment in valid)
        student_priorities = []
        signal_counts = {"academic_rule": 0, "dropout_ml": 0, "course_failure_rule": 0}
        dropout_covered = 0
        course_covered = 0
        latest_scored_at: list[str] = []
        for enrollment, student in enrollments:
            failure = failures.get(student.id, {})
            dropout = dropout_predictions.get(student.id, {})
            course_prediction = course_predictions.get(enrollment.id, {})
            current_grade = _float(enrollment.final_grade)
            risk = _risk_from_signals(
                status_value=student.status,
                cumulative_gpa=_float(student.gpa_cumulative),
                fail_count=_int(failure.get("fail_count")),
                near_fail_count=_int(failure.get("near_fail_count")),
                current_grade=current_grade,
                dropout_probability=_float(dropout.get("dropout_probability")),
                dropout_level=dropout.get("risk_level"),
                course_fail_probability=_float(course_prediction.get("fail_probability")),
            )
            student_priorities.append(risk["risk_level"])
            signals = _signal_payloads(
                student=student,
                fail_count=_int(failure.get("fail_count")),
                near_fail_count=_int(failure.get("near_fail_count")),
                current_grade=current_grade,
                dropout=dropout,
                course_prediction=course_prediction,
            )
            for signal in signals:
                if signal["level"] != "normal":
                    signal_counts[signal["type"]] += 1
                if signal.get("scored_at"):
                    latest_scored_at.append(signal["scored_at"])
            dropout_covered += int(bool(dropout))
            course_covered += int(bool(course_prediction))
        total = len(enrollments)
        high_students = sum(level == "high" for level in student_priorities)
        watch_students = sum(level == "watch" for level in student_priorities)
        support_priority = "high" if high_students else "watch" if watch_students else "normal"
        cases = cases_by_section.get(section_id, [])
        open_cases = [item for item in cases if item.status not in {"resolved", "closed"}]
        overdue_cases = sum(bool(item.follow_up_at and item.follow_up_at < datetime.now(UTC)) for item in open_cases)
        coverage = ((dropout_covered + course_covered) / (2 * total)) if total else 0
        latest_score = max(latest_scored_at) if latest_scored_at else None
        stale = False
        if latest_score:
            scored_at = datetime.fromisoformat(latest_score)
            if scored_at.tzinfo is None:
                scored_at = scored_at.replace(tzinfo=UTC)
            stale = (datetime.now(UTC) - scored_at).days > 90
        confidence_level = "low" if stale else "high" if coverage >= 0.9 else "medium" if coverage >= 0.5 else "low"
        rows.append(
            {
                **dict(section),
                "student_count": total,
                "graded_count": len(graded),
                "failed_count": failed_count,
                "pass_rate": ((len(valid) - failed_count) / len(valid) * 100) if valid else None,
                "avg_grade": (sum(_float(item.final_grade) or 0 for item in graded) / len(graded)) if graded else None,
                "support_priority": support_priority,
                "high_students": high_students,
                "watch_students": watch_students,
                "students_with_signals": high_students + watch_students,
                "signals": [
                    {
                        "type": signal_type,
                        "level": "high" if support_priority == "high" else "watch",
                        "label": {"academic_rule": "Học vụ", "dropout_ml": "Dropout ML", "course_failure_rule": "Nguy cơ theo quy tắc"}[signal_type],
                        "reason": f"{count} sinh viên có tín hiệu",
                        "probability": None,
                        "model_name": None,
                        "model_version": None,
                        "scored_at": max(latest_scored_at) if latest_scored_at else None,
                        "top_factors": [],
                        "count": count,
                    }
                    for signal_type, count in signal_counts.items()
                    if count
                ],
                "case_summary": {
                    "new": sum(item.status == "new" for item in cases),
                    "monitoring": sum(item.status == "monitoring" for item in cases),
                    "open": len(open_cases),
                    "overdue": overdue_cases,
                },
                "data_confidence": {
                    "level": confidence_level,
                    "ml_coverage": coverage,
                    "dropout_coverage": dropout_covered / total if total else 0,
                    "course_risk_coverage": course_covered / total if total else 0,
                    "is_stale": stale,
                    "latest_scored_at": latest_score,
                    "warning": "Score đã cũ; cần chạy lại pipeline." if stale else "Tín hiệu hỗ trợ, không phải kết luận học vụ.",
                },
            }
        )
    rows.sort(key=lambda row: ({"high": 0, "watch": 1, "normal": 2}[row["support_priority"]], -row["students_with_signals"]))
    return {
        "summary": {
            "total_sections": len(rows),
            "needs_action": sum(row["support_priority"] in {"high", "watch"} for row in rows),
            "students_with_signals": sum(row["students_with_signals"] for row in rows),
            "open_cases": sum(row["case_summary"]["open"] for row in rows),
        },
        "sections": rows,
    }


async def _case_context(
    db: DBSession,
    user: CurrentUser,
    *,
    section_id: int | None = None,
    class_code: str | None = None,
    student_id: int | None = None,
) -> dict:
    query = select(InterventionCase)
    if section_id is not None:
        query = query.where(InterventionCase.section_id == section_id)
    if class_code is not None:
        query = query.where(InterventionCase.class_code == class_code)
    if student_id is not None:
        query = query.where(InterventionCase.student_id == student_id)
    cases = (await db.execute(query.order_by(desc(InterventionCase.updated_at)).limit(100))).scalars().all()
    open_cases = [item for item in cases if item.status not in {"resolved", "closed"}]
    return {
        "case_summary": {
            "total": len(cases),
            "open": len(open_cases),
            "new": sum(item.status == "new" for item in cases),
            "monitoring": sum(item.status == "monitoring" for item in cases),
            "resolved": sum(item.status in {"resolved", "closed"} for item in cases),
        },
        "cases": [
            {
                "id": item.id,
                "student_id": item.student_id,
                "status": item.status,
                "priority": item.priority,
                "assignee_user_id": item.assignee_user_id,
                "follow_up_at": item.follow_up_at,
            }
            for item in cases
        ],
        "permissions": {
            "can_create_case": user.role in {UserRole.manager, UserRole.lecturer},
            "can_assign": user.role == UserRole.manager,
            "can_contact": user.role == UserRole.lecturer,
            "can_view_private_timeline": user.role in {UserRole.manager, UserRole.lecturer} or is_admin(user),
        },
    }


@router.get("/sections/{section_id}/at-risk-students")
async def list_section_at_risk_students(section_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Return at-risk students in one teaching section visible to the actor."""
    return await _section_at_risk_payload(db, current_user, section_id)


@router.get("/sections/{section_id}/workspace")
async def get_section_intervention_workspace(section_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Return a UI-ready intervention workspace for one teaching section."""
    data = await _section_at_risk_payload(db, current_user, section_id)
    history_rows = (
        await db.execute(
            select(StudentInterventionContact)
            .options(selectinload(StudentInterventionContact.actor))
            .where(StudentInterventionContact.section_id == section_id)
            .order_by(desc(StudentInterventionContact.created_at), desc(StudentInterventionContact.id))
            .limit(20)
        )
    ).scalars().all()
    case_context = await _case_context(db, current_user, section_id=section_id)
    prediction_count = sum(row.get("dropout_probability") is not None for row in data["students"])
    return {
        **data,
        **case_context,
        "data_confidence": {
            "level": "high" if prediction_count == len(data["students"]) else "medium",
            "prediction_coverage": prediction_count / len(data["students"]) if data["students"] else 0,
            "message": "Tín hiệu hỗ trợ, không phải kết luận học vụ.",
        },
        "next_action": "Ưu tiên tạo hoặc phân công ca mức cao" if data["summary"]["high"] else "Theo dõi định kỳ",
        "support": {
            "scope_type": "section",
            "section_id": section_id,
            "history": [_contact_payload(row) for row in history_rows],
            "campaigns": await _campaign_summary(db, section_id=section_id),
            "workflow_actions": _workflow_actions("section"),
            "email_delivery_endpoint": "/api/v1/intervention-campaigns/delivery-status",
        },
    }


@router.get("/homeroom/{class_code}/at-risk-students")
async def list_homeroom_at_risk_students(class_code: str, db: DBSession, current_user: CurrentUser) -> dict:
    """Return at-risk students in one advisor/homeroom class visible to the actor."""
    return await _homeroom_at_risk_payload(db, current_user, class_code)


@router.get("/homeroom/{class_code}/workspace")
async def get_homeroom_intervention_workspace(class_code: str, db: DBSession, current_user: CurrentUser) -> dict:
    """Return a UI-ready intervention workspace for one advisor/homeroom class."""
    data = await _homeroom_at_risk_payload(db, current_user, class_code)
    student_ids = [row["student_id"] for row in data["students"]]
    semester_predictions = await _latest_semester_predictions(db, student_ids)
    for row in data["students"]:
        prediction = semester_predictions.get(row["student_id"])
        row["credit_progress_prediction"] = prediction
        if prediction:
            row["signals"].append(
                {
                    "type": "credit_progress_ml",
                    "level": "high" if prediction.get("risk_level") == "high" else "watch" if prediction.get("risk_level") == "medium" else "normal",
                    "label": "Tiến độ tín chỉ",
                    "reason": f"Dự kiến {float(prediction['expected_failed_credits']):.1f} tín chỉ có rủi ro",
                    "probability": None,
                    "model_name": prediction.get("model_name"),
                    "model_version": prediction.get("model_version"),
                    "scored_at": _iso(prediction.get("scored_at")),
                    "top_factors": [],
                }
            )
            row["data_confidence"] = _confidence(row["signals"], expected_prediction_types=2)
        if prediction and prediction.get("risk_level") in {"high", "medium"}:
            row["reasons"].append(
                f"Tiến độ tín chỉ dự kiến mức {prediction['risk_level']} "
                f"({float(prediction['expected_failed_credits']):.1f} tín chỉ rủi ro)"
            )
    history_rows = (
        await db.execute(
            select(StudentInterventionContact)
            .options(selectinload(StudentInterventionContact.actor))
            .where(StudentInterventionContact.class_code == class_code)
            .order_by(desc(StudentInterventionContact.created_at), desc(StudentInterventionContact.id))
            .limit(20)
        )
    ).scalars().all()
    case_context = await _case_context(db, current_user, class_code=class_code)
    prediction_count = sum(row.get("dropout_probability") is not None for row in data["students"])
    return {
        **data,
        **case_context,
        "summary": _summary(data["students"]),
        "data_confidence": {
            "level": "high" if prediction_count == len(data["students"]) else "medium",
            "prediction_coverage": prediction_count / len(data["students"]) if data["students"] else 0,
            "message": "Tín hiệu hỗ trợ, không phải kết luận học vụ.",
        },
        "next_action": "Ưu tiên tạo hoặc phân công ca mức cao" if any(row["risk_level"] == "high" for row in data["students"]) else "Theo dõi định kỳ",
        "support": {
            "scope_type": "homeroom",
            "class_code": class_code,
            "history": [_contact_payload(row) for row in history_rows],
            "campaigns": await _campaign_summary(db, class_code=class_code),
            "workflow_actions": _workflow_actions("homeroom"),
            "email_delivery_endpoint": "/api/v1/intervention-campaigns/delivery-status",
        },
    }


@router.get("/students/{student_id}/history")
async def list_student_intervention_history(
    student_id: int,
    db: DBSession,
    current_user: CurrentUser,
    section_id: int | None = Query(default=None),
    class_code: str | None = Query(default=None),
) -> list[dict]:
    """Return contact history for a visible student, optionally narrowed to one scope."""
    await _require_contact_scope(db, current_user, student_id=student_id, section_id=section_id, class_code=class_code)
    query = (
        select(StudentInterventionContact)
        .options(selectinload(StudentInterventionContact.actor))
        .where(StudentInterventionContact.student_id == student_id)
        .order_by(desc(StudentInterventionContact.created_at), desc(StudentInterventionContact.id))
    )
    if section_id is not None:
        query = query.where(StudentInterventionContact.section_id == section_id)
    if class_code:
        query = query.where(StudentInterventionContact.class_code == class_code)
    return [_contact_payload(row) for row in (await db.execute(query)).scalars().all()]


@router.get("/students/{student_id}/support-profile")
async def get_student_support_profile(
    student_id: int,
    db: DBSession,
    current_user: CurrentUser,
    section_id: int | None = Query(default=None),
    class_code: str | None = Query(default=None),
) -> dict:
    """Return a complete support profile for student-detail/capability pages."""
    await _require_contact_scope(db, current_user, student_id=student_id, section_id=section_id, class_code=class_code)
    student_row = (
        await db.execute(
            select(
                Student.id,
                Student.student_code,
                Student.full_name,
                Student.class_code,
                Student.email,
                Student.phone,
                Student.status,
                Student.gpa_cumulative,
                Program.code.label("program_code"),
                Program.name.label("program_name"),
                Cohort.code.label("cohort_code"),
            )
            .join(Program, Program.id == Student.program_id)
            .join(Cohort, Cohort.id == Student.cohort_id)
            .where(Student.id == student_id)
        )
    ).mappings().one_or_none()
    if student_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    failures = await _global_failure_counts(db, [student_id])
    dropout = (await _dropout_predictions(db, [student_id])).get(student_id)
    credit_progress = (await _latest_semester_predictions(db, [student_id])).get(student_id)
    course_predictions: list[dict] = []
    if db.get_bind().dialect.name == "postgresql":
        course_filter = "AND e.section_id = :section_id" if section_id is not None else ""
        course_rows = (
            await db.execute(
                text(
                    f"""
                    SELECT DISTINCT ON (p.enrollment_id)
                        p.enrollment_id,
                        e.section_id,
                        sec.section_code,
                        c.id AS course_id,
                        c.code AS course_code,
                        c.name AS course_name,
                        c.credits,
                        e.final_grade,
                        p.pass_probability,
                        p.fail_probability,
                        p.predicted_status,
                        p.explanation,
                        p.scored_at,
                        r.model_name,
                        r.model_version
                    FROM ml.enrollment_prediction p
                    JOIN ml.model_run r ON r.id = p.model_run_id
                    JOIN public.enrollments e ON e.id = p.enrollment_id
                    JOIN public.sections sec ON sec.id = e.section_id
                    JOIN public.courses c ON c.id = sec.course_id
                    WHERE e.student_id = :student_id
                      AND r.status = 'completed'
                      AND e.status = 'enrolled'
                      AND e.completed_at IS NULL
                      AND e.final_grade IS NULL
                      AND e.is_passed IS NULL
                    {course_filter}
                    ORDER BY p.enrollment_id, p.scored_at DESC
                    LIMIT 20
                    """
                ),
                {"student_id": student_id, "section_id": section_id},
            )
        ).mappings().all()
        for row in course_rows:
            payload = dict(row)
            explanation = _course_explanation(payload.get("explanation"))
            payload["explanation"] = explanation
            payload["model_type"] = explanation.get("model_type", "transparent_rule_baseline")
            payload["source"] = "course_failure_rule"
            course_predictions.append(payload)

    contacts = await list_student_intervention_history(
        student_id,
        db,
        current_user,
        section_id=section_id,
        class_code=class_code,
    )
    case_context = await _case_context(db, current_user, section_id=section_id, class_code=class_code, student_id=student_id)
    signal = failures.get(student_id, {})
    risk = _risk_from_signals(
        status_value=str(student_row["status"]),
        cumulative_gpa=_float(student_row["gpa_cumulative"]),
        fail_count=_int(signal.get("fail_count")),
        near_fail_count=_int(signal.get("near_fail_count")),
        dropout_probability=_float((dropout or {}).get("dropout_probability")),
        dropout_level=(dropout or {}).get("risk_level"),
        course_fail_probability=max(
            [_float(row.get("fail_probability")) or 0 for row in course_predictions],
            default=None,
        ),
    )
    return {
        "profile": dict(student_row),
        "scope": {"section_id": section_id, "class_code": class_code},
        "risk": risk,
        "signals": {
            "fail_count": _int(signal.get("fail_count")),
            "near_fail_count": _int(signal.get("near_fail_count")),
            "dropout_prediction": dropout,
            "credit_progress_prediction": credit_progress,
            "course_predictions": course_predictions,
        },
        "contact_history": contacts,
        **case_context,
        "data_confidence": {
            "level": "high" if dropout and course_predictions else "medium",
            "has_dropout_prediction": dropout is not None,
            "has_course_predictions": bool(course_predictions),
            "message": "CLO synthetic và dự đoán ML phải được xác minh trước quyết định học vụ.",
        },
        "next_actions": risk["recommended_actions"],
        "action_endpoints": {
            "draft_message": "/api/v1/interventions/ai/draft-message",
            "log_contact": "/api/v1/interventions/contact",
            "student_history": f"/api/v1/interventions/students/{student_id}/history",
        },
    }


@router.get("/sections/{section_id}/history")
async def list_section_intervention_history(section_id: int, db: DBSession, current_user: CurrentUser) -> list[dict]:
    """Return contact history for a visible teaching section."""
    if not await can_access_section(db, current_user, section_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    rows = (
        await db.execute(
            select(StudentInterventionContact)
            .options(selectinload(StudentInterventionContact.actor))
            .where(StudentInterventionContact.section_id == section_id)
            .order_by(desc(StudentInterventionContact.created_at), desc(StudentInterventionContact.id))
        )
    ).scalars().all()
    return [_contact_payload(row) for row in rows]


@router.post("/contact", status_code=status.HTTP_201_CREATED)
async def create_intervention_contact(
    payload: InterventionContactCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Log a support contact or saved draft after the lecturer/advisor confirms it."""
    require_intervention_actor(current_user)
    await _require_contact_scope(
        db,
        current_user,
        student_id=payload.student_id,
        section_id=payload.section_id,
        class_code=payload.class_code,
    )
    case_item = None
    if payload.case_id is not None:
        case_item = await db.get(InterventionCase, payload.case_id)
        if (
            case_item is None
            or case_item.student_id != payload.student_id
            or case_item.section_id != payload.section_id
            or case_item.class_code != payload.class_code
            or case_item.assignee_user_id != current_user.id
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Case is not assigned to this actor and scope")
    contact = StudentInterventionContact(
        case_id=payload.case_id,
        actor_user_id=current_user.id,
        student_id=payload.student_id,
        section_id=payload.section_id,
        class_code=payload.class_code,
        channel=payload.channel,
        status=payload.status,
        subject=payload.subject,
        message=payload.message,
        note=payload.note,
        metadata_json=payload.metadata,
    )
    db.add(contact)
    await db.flush()
    if case_item is not None:
        if case_item.status in {"new", "assigned"}:
            case_item.status = "contacting"
        db.add(
            InterventionCaseEvent(
                case_id=case_item.id,
                actor_user_id=current_user.id,
                event_type="contact",
                payload_json={"contact_id": contact.id, "channel": contact.channel, "status": contact.status},
            )
        )
        await db.flush()
    return _contact_payload(contact, actor_name=current_user.full_name)


async def _student_signal_for_draft(
    db: DBSession,
    user: CurrentUser,
    student_id: int,
    section_id: int | None,
    class_code: str | None,
) -> dict:
    require_intervention_actor(user)
    await _require_contact_scope(db, user, student_id=student_id, section_id=section_id, class_code=class_code)
    student = await db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    failures = await _global_failure_counts(db, [student_id])
    predictions = await _dropout_predictions(db, [student_id])
    current_grade = None
    if section_id is not None:
        current_grade = await db.scalar(
            select(Enrollment.final_grade).where(Enrollment.student_id == student_id, Enrollment.section_id == section_id)
        )
    signal = failures.get(student_id, {})
    prediction = predictions.get(student_id, {})
    risk = _risk_from_signals(
        status_value=student.status,
        cumulative_gpa=_float(student.gpa_cumulative),
        fail_count=_int(signal.get("fail_count")),
        near_fail_count=_int(signal.get("near_fail_count")),
        current_grade=_float(current_grade),
        dropout_probability=_float(prediction.get("dropout_probability")),
        dropout_level=prediction.get("risk_level"),
    )
    return {
        "student": student,
        "fail_count": _int(signal.get("fail_count")),
        "near_fail_count": _int(signal.get("near_fail_count")),
        "current_grade": _float(current_grade),
        "dropout_probability": _float(prediction.get("dropout_probability")),
        **risk,
    }


@router.post("/ai/draft-message")
async def draft_intervention_message(
    payload: InterventionDraftRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Draft a lecturer-confirmed support message from existing risk signals."""
    signal = await _student_signal_for_draft(db, current_user, payload.student_id, payload.section_id, payload.class_code)
    student: Student = signal["student"]
    subject = "Trao đổi về kế hoạch hỗ trợ học tập"
    reason_lines = signal["reasons"] or ["cần trao đổi định kỳ về tình hình học tập"]
    action_lines = signal["recommended_actions"]
    greeting = f"Chào {student.full_name},"
    body = [
        greeting,
        "",
        "Thầy/cô muốn trao đổi với em về tình hình học tập hiện tại để cùng tìm cách hỗ trợ phù hợp.",
        "Một số tín hiệu cần chú ý:",
        *[f"- {reason}" for reason in reason_lines[:4]],
        "",
        "Đề xuất bước tiếp theo:",
        *[f"- {action}" for action in action_lines[:3]],
        "",
        "Em phản hồi thời gian thuận tiện để thầy/cô hẹn trao đổi ngắn trong tuần này nhé.",
        "",
        "Trân trọng.",
    ]
    if payload.tone == "brief":
        body = [
            greeting,
            "",
            f"Thầy/cô muốn hẹn em trao đổi ngắn về: {', '.join(reason_lines[:2])}.",
            "Em phản hồi thời gian thuận tiện trong tuần này nhé.",
        ]
    elif payload.tone == "formal":
        body[2] = "Thầy/cô liên hệ để trao đổi về kế hoạch hỗ trợ học tập dựa trên các tín hiệu cảnh báo hiện có."
    return {
        "subject": subject,
        "message": "\n".join(body),
        "risk_level": signal["risk_level"],
        "risk_score": signal["risk_score"],
        "reasons": signal["reasons"],
        "recommended_actions": signal["recommended_actions"],
        "source": "intervention_agent_rule_v1",
    }


@router.post("/ai/summarize-scope")
async def summarize_intervention_scope(
    payload: InterventionScopeSummaryRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Summarize a section or homeroom class into prioritized support actions."""
    if payload.scope_type == "section":
        if payload.scope_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="scope_id is required for section")
        data = await _section_at_risk_payload(db, current_user, payload.scope_id)
    else:
        if not payload.class_code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="class_code is required for homeroom")
        data = await _homeroom_at_risk_payload(db, current_user, payload.class_code)

    priority = [row for row in data["students"] if row["risk_level"] in {"high", "watch"}][:5]
    grouped: dict[str, int] = defaultdict(int)
    for row in data["students"]:
        for reason in row["reasons"]:
            if "GPA" in reason:
                grouped["GPA thấp hoặc giảm"] += 1
            elif "chưa đạt" in reason or "trượt" in reason:
                grouped["Học phần chưa đạt/cận trượt"] += 1
            elif "ML dropout" in reason:
                grouped["ML dropout risk"] += 1
            elif "Trạng thái" in reason:
                grouped["Trạng thái học vụ"] += 1

    recommendations = []
    if data["summary"]["high"]:
        recommendations.append("Ưu tiên hẹn trao đổi cá nhân với nhóm rủi ro cao trong tuần này")
    if grouped.get("Học phần chưa đạt/cận trượt", 0) >= 3:
        recommendations.append("Rà soát các học phần chưa đạt và hướng dẫn kế hoạch học lại/củng cố")
    if grouped.get("ML dropout risk", 0):
        recommendations.append("Dùng ML dropout như tín hiệu phụ, không thay thế nhận định của giảng viên")
    if data["summary"]["contacted"] < data["summary"]["high"]:
        recommendations.append("Ghi nhận liên hệ cho các sinh viên rủi ro cao chưa có lịch sử can thiệp")
    if not recommendations:
        recommendations.append("Duy trì theo dõi định kỳ và cập nhật lịch sử trao đổi khi có can thiệp")

    return {
        "scope": data["scope"],
        "summary": data["summary"],
        "priority_students": priority,
        "reason_groups": dict(grouped),
        "recommendations": recommendations,
        "source": "intervention_agent_rule_v1",
    }


@router.post("/ai/bulk-notify")
async def bulk_notify_intervention_scope(
    payload: InterventionBulkNotifyRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Create bulk support notification drafts/logs for students selected by the Agent."""
    data, section_id, class_code = await _scope_payload_for_bulk(db, current_user, payload)
    candidates = _bulk_candidates(data, payload)

    created: list[dict] = []
    skipped: list[dict] = []
    for student in candidates:
        if payload.channel == "email" and not student.get("email"):
            skipped.append(
                {
                    "student_id": student["student_id"],
                    "student_code": student["student_code"],
                    "full_name": student["full_name"],
                    "reason": "missing_email",
                }
            )
            continue
        contact = StudentInterventionContact(
            actor_user_id=current_user.id,
            student_id=student["student_id"],
            section_id=section_id,
            class_code=class_code,
            channel=payload.channel,
            status=payload.status,
            subject=payload.subject,
            message=_bulk_message(student, payload.message_template),
            note="Agent tạo thông báo hỗ trợ hàng loạt; giảng viên xác nhận trước khi sử dụng.",
            metadata_json={
                "source": "intervention_agent_bulk_v1",
                "scope": data["scope"],
                "risk_level": student["risk_level"],
                "risk_score": student["risk_score"],
                "delivery_mode": "audit_only",
            },
        )
        db.add(contact)
        await db.flush()
        created.append(
            {
                "contact_id": contact.id,
                "student_id": student["student_id"],
                "student_code": student["student_code"],
                "full_name": student["full_name"],
                "email": student.get("email"),
                "status": contact.status,
            }
        )

    return {
        "scope": data["scope"],
        "delivery_mode": "audit_only",
        "requested": len(candidates),
        "created_count": len(created),
        "skipped_count": len(skipped),
        "created": created,
        "skipped": skipped,
        "message": "Đã tạo thông báo/audit log hàng loạt. Chưa gửi SMTP thật vì hệ thống chưa cấu hình mail provider.",
    }


@router.post("/ai/bulk-draft")
async def bulk_draft_intervention_emails(
    payload: InterventionBulkNotifyRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Build personalized bulk email drafts without writing contact history."""
    data, _, _ = await _scope_payload_for_bulk(db, current_user, payload)
    candidates = _bulk_candidates(data, payload)
    drafts = []
    skipped = []
    for student in candidates:
        if not student.get("email"):
            skipped.append(
                {
                    "student_id": student["student_id"],
                    "student_code": student["student_code"],
                    "full_name": student["full_name"],
                    "reason": "missing_email",
                }
            )
            continue
        drafts.append(
            {
                "student_id": student["student_id"],
                "student_code": student["student_code"],
                "full_name": student["full_name"],
                "email": student["email"],
                "risk_level": student["risk_level"],
                "risk_score": student["risk_score"],
                "subject": payload.subject,
                "message": _bulk_message(student, payload.message_template),
                "reasons": student.get("reasons") or [],
                "recommended_actions": student.get("recommended_actions") or [],
            }
        )
    return {
        "scope": data["scope"],
        "delivery_mode": "draft_only",
        "draft_count": len(drafts),
        "skipped_count": len(skipped),
        "drafts": drafts,
        "skipped": skipped,
        "message": "Agent đã xây danh sách email cá nhân hóa. Chưa lưu/gửi cho đến khi giảng viên xác nhận.",
    }

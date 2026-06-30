"""Learning-support intervention APIs for at-risk students and contact history."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, func, select, text
from sqlalchemy.orm import selectinload

from app.access_control import (
    can_access_section,
    can_access_student,
    get_teacher_for_user,
    is_admin,
    require_department_scope,
)
from app.dependencies import CurrentUser, DBSession
from app.models.academic import Course, Program, Semester
from app.models.intervention import StudentInterventionContact
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


def _float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _int(value: Any) -> int:
    return int(value or 0)


def _risk_from_signals(
    *,
    status_value: str,
    cumulative_gpa: float | None,
    fail_count: int,
    near_fail_count: int = 0,
    current_grade: float | None = None,
    dropout_probability: float | None = None,
    dropout_level: str | None = None,
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
    failures = await _global_failure_counts(db, student_ids)
    predictions = await _dropout_predictions(db, student_ids)
    contacts = await _contact_counts(db, student_ids, section_id=section_id)

    rows = []
    for enrollment, student, program_name in enrollment_rows:
        signal = failures.get(student.id, {})
        prediction = predictions.get(student.id, {})
        dropout_probability = _float(prediction.get("dropout_probability"))
        current_grade = _float(enrollment.final_grade)
        risk = _risk_from_signals(
            status_value=student.status,
            cumulative_gpa=_float(student.gpa_cumulative),
            fail_count=_int(signal.get("fail_count")),
            near_fail_count=_int(signal.get("near_fail_count")),
            current_grade=current_grade,
            dropout_probability=dropout_probability,
            dropout_level=prediction.get("risk_level"),
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
                "top_factors": prediction.get("top_factors") or [],
                "last_contacted_at": contact.get("last_contacted_at"),
                "contact_count": contact.get("contact_count", 0),
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


@router.get("/sections/{section_id}/at-risk-students")
async def list_section_at_risk_students(section_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Return at-risk students in one teaching section visible to the actor."""
    return await _section_at_risk_payload(db, current_user, section_id)


@router.get("/homeroom/{class_code}/at-risk-students")
async def list_homeroom_at_risk_students(class_code: str, db: DBSession, current_user: CurrentUser) -> dict:
    """Return at-risk students in one advisor/homeroom class visible to the actor."""
    return await _homeroom_at_risk_payload(db, current_user, class_code)


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
    await _require_contact_scope(
        db,
        current_user,
        student_id=payload.student_id,
        section_id=payload.section_id,
        class_code=payload.class_code,
    )
    contact = StudentInterventionContact(
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
    return _contact_payload(contact, actor_name=current_user.full_name)


async def _student_signal_for_draft(
    db: DBSession,
    user: CurrentUser,
    student_id: int,
    section_id: int | None,
    class_code: str | None,
) -> dict:
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

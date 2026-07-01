"""Case-management APIs for academic early-warning workflows."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, case, desc, exists, func, or_, select
from sqlalchemy.orm import selectinload

from app.access_control import can_access_section, get_teacher_for_user, is_admin, require_department_scope
from app.dependencies import CurrentUser, DBSession
from app.models.academic import Course, Program
from app.models.intervention import InterventionCase, InterventionCaseEvent
from app.models.people import HomeroomAssignment, Student, Teacher, User, UserRole
from app.models.teaching import Enrollment, Section
from app.schemas.intervention import (
    InterventionCaseAssign,
    InterventionCaseCreate,
    InterventionCaseEventCreate,
    InterventionCaseUpdate,
)

router = APIRouter()
OPEN_STATUSES = {"new", "assigned", "contacting", "monitoring"}


async def _can_access_homeroom(db: DBSession, user: CurrentUser, class_code: str) -> bool:
    if is_admin(user):
        return True
    if user.role == UserRole.manager:
        department_ids = await require_department_scope(db, user)
        return bool(
            await db.scalar(
                select(exists().where(Student.class_code == class_code, Student.program_id == Program.id, Program.department_id.in_(department_ids)))
            )
        )
    teacher = await get_teacher_for_user(db, user)
    if user.role != UserRole.lecturer or teacher is None:
        return False
    return bool(
        await db.scalar(
            select(exists().where(
                HomeroomAssignment.class_code == class_code,
                HomeroomAssignment.teacher_id == teacher.id,
                HomeroomAssignment.is_active == True,  # noqa: E712
            ))
        )
    )


async def _require_scope(db: DBSession, user: CurrentUser, payload: InterventionCaseCreate) -> str:
    student = await db.get(Student, payload.student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    if payload.scope_type == "section":
        if payload.section_id is None or payload.class_code is not None:
            raise HTTPException(status_code=422, detail="Section scope requires section_id only")
        if not await can_access_section(db, user, payload.section_id):
            raise HTTPException(status_code=403, detail="Section is outside your scope")
        enrolled = await db.scalar(select(exists().where(Enrollment.student_id == payload.student_id, Enrollment.section_id == payload.section_id)))
        if not enrolled:
            raise HTTPException(status_code=400, detail="Student is not enrolled in section")
        return f"section:{payload.section_id}"
    if not payload.class_code or payload.section_id is not None:
        raise HTTPException(status_code=422, detail="Homeroom scope requires class_code only")
    if student.class_code != payload.class_code:
        raise HTTPException(status_code=400, detail="Student is not in homeroom class")
    if not await _can_access_homeroom(db, user, payload.class_code):
        raise HTTPException(status_code=403, detail="Homeroom is outside your scope")
    return f"homeroom:{payload.class_code}"


def _visible_filter(user: CurrentUser, department_ids: set[int] | None = None):
    if is_admin(user):
        return True
    if user.role == UserRole.manager:
        return exists().where(Student.id == InterventionCase.student_id, Student.program_id == Program.id, Program.department_id.in_(department_ids or set()))
    if user.role == UserRole.lecturer:
        return or_(
            InterventionCase.assignee_user_id == user.id,
            exists().where(
                Teacher.user_id == user.id,
                or_(
                    and_(InterventionCase.section_id == Section.id, Section.teacher_id == Teacher.id),
                    and_(InterventionCase.class_code == HomeroomAssignment.class_code, HomeroomAssignment.teacher_id == Teacher.id, HomeroomAssignment.is_active == True),  # noqa: E712
                ),
            ),
        )
    return False


def _permissions(item: InterventionCase, user: CurrentUser) -> dict:
    is_owner = user.role == UserRole.lecturer and item.assignee_user_id == user.id
    return {
        "can_assign": user.role == UserRole.manager,
        "can_escalate": user.role == UserRole.manager,
        "can_update_workflow": is_owner,
        "can_contact": is_owner,
        "can_view_private_timeline": user.role in {UserRole.manager, UserRole.lecturer} or is_admin(user),
    }


def _payload(item: InterventionCase, user: CurrentUser, *, include_events: bool = False) -> dict:
    student = item.__dict__.get("student")
    assignee = item.__dict__.get("assignee")
    data = {
        "id": item.id,
        "student_id": item.student_id,
        "student_code": student.student_code if student else None,
        "student_name": student.full_name if student else None,
        "scope_type": item.scope_type,
        "section_id": item.section_id,
        "class_code": item.class_code,
        "source": item.source,
        "priority": item.priority,
        "status": item.status,
        "assignee_user_id": item.assignee_user_id,
        "assignee_name": assignee.full_name if assignee else None,
        "follow_up_at": item.follow_up_at,
        "resolved_at": item.resolved_at,
        "resolution": item.resolution,
        "signal_snapshot": item.signal_snapshot or {},
        "is_overdue": bool(item.follow_up_at and item.follow_up_at < datetime.now(UTC) and item.status in OPEN_STATUSES),
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "permissions": _permissions(item, user),
    }
    if include_events:
        data["events"] = [
            {
                "id": event.id,
                "event_type": event.event_type,
                "actor_user_id": event.actor_user_id,
                "actor_name": event.actor.full_name if event.actor else None,
                "payload": event.payload_json or {},
                "created_at": event.created_at,
            }
            for event in sorted(item.events, key=lambda row: (row.created_at, row.id), reverse=True)
        ]
    return data


async def _get_visible_case(db: DBSession, user: CurrentUser, case_id: int) -> InterventionCase:
    department_ids = await require_department_scope(db, user) if user.role == UserRole.manager else None
    item = (
        await db.execute(
            select(InterventionCase)
            .options(
                selectinload(InterventionCase.student),
                selectinload(InterventionCase.assignee),
                selectinload(InterventionCase.events).selectinload(InterventionCaseEvent.actor),
            )
            .where(InterventionCase.id == case_id, _visible_filter(user, department_ids))
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Intervention case not found")
    return item


def _signal_snapshot(student: dict, scope: dict) -> dict:
    dropout = student.get("dropout_probability")
    course_progress = student.get("credit_progress_prediction") or {}
    return {
        "scope": scope,
        "risk_level": student.get("risk_level"),
        "risk_score": student.get("risk_score"),
        "reasons": student.get("reasons") or [],
        "recommended_actions": student.get("recommended_actions") or [],
        "academic": {
            "gpa_cumulative": student.get("gpa_cumulative"),
            "fail_count": student.get("fail_count", 0),
            "near_fail_count": student.get("near_fail_count", 0),
        },
        "dropout_ml": {
            "probability": dropout,
            "risk_level": student.get("dropout_risk_level"),
            "top_factors": student.get("top_factors") or [],
            "available": dropout is not None,
        },
        "credit_progress_ml": course_progress,
        "signals": student.get("signals") or [],
        "course_risk_rule": next(
            (signal for signal in (student.get("signals") or []) if signal.get("type") == "course_failure_rule"),
            None,
        ),
        "data_confidence": {
            "level": "high" if dropout is not None else "medium",
            "warning": "Tín hiệu hỗ trợ, không phải kết luận học vụ.",
        },
        "scored_at": datetime.now(UTC).isoformat(),
        "source": "academic_rules+predictions",
    }


async def _sync_scope_candidates(
    db: DBSession,
    user: CurrentUser,
    *,
    scope_type: str,
    section_id: int | None = None,
    class_code: str | None = None,
    remaining: int,
) -> tuple[int, int]:
    from app.api.v1.endpoints.interventions import _homeroom_at_risk_payload, _section_at_risk_payload

    data = (
        await _section_at_risk_payload(db, user, section_id)
        if scope_type == "section" and section_id is not None
        else await _homeroom_at_risk_payload(db, user, class_code or "")
    )
    candidates = [row for row in data["students"] if row["risk_level"] in {"high", "watch"}]
    candidates.sort(key=lambda row: (-row["risk_score"], row["student_id"]))
    created = 0
    skipped = 0
    scope_key = f"section:{section_id}" if section_id is not None else f"homeroom:{class_code}"
    for student in candidates[:remaining]:
        existing = await db.scalar(
            select(InterventionCase.id).where(
                InterventionCase.student_id == student["student_id"],
                InterventionCase.scope_key == scope_key,
                InterventionCase.active_key == "active",
            )
        )
        if existing:
            skipped += 1
            continue
        assignee_id = user.id if user.role == UserRole.lecturer else None
        item = InterventionCase(
            student_id=student["student_id"],
            scope_type=scope_type,
            scope_key=scope_key,
            section_id=section_id,
            class_code=class_code,
            source="risk_sync_v1",
            priority="high" if student["risk_level"] == "high" else "medium",
            status="assigned" if assignee_id else "new",
            assignee_user_id=assignee_id,
            created_by_user_id=user.id,
            signal_snapshot=_signal_snapshot(student, data["scope"]),
        )
        db.add(item)
        await db.flush()
        db.add(
            InterventionCaseEvent(
                case_id=item.id,
                actor_user_id=user.id,
                event_type="created_from_risk_signal",
                payload_json={"source": "academic_rules+predictions", "risk_score": student["risk_score"]},
            )
        )
        created += 1
    return created, skipped


@router.get("/cases")
async def list_cases(
    db: DBSession,
    current_user: CurrentUser,
    case_status: str | None = Query(default=None, alias="status"),
    priority: str | None = None,
    scope_type: str | None = None,
    assignee_user_id: str | None = None,
    student_id: int | None = None,
    overdue: bool | None = None,
) -> list[dict]:
    department_ids = await require_department_scope(db, current_user) if current_user.role == UserRole.manager else None
    query = select(InterventionCase).options(selectinload(InterventionCase.student), selectinload(InterventionCase.assignee)).where(_visible_filter(current_user, department_ids))
    if case_status:
        query = query.where(InterventionCase.status == case_status)
    if priority:
        query = query.where(InterventionCase.priority == priority)
    if scope_type:
        query = query.where(InterventionCase.scope_type == scope_type)
    if assignee_user_id:
        query = query.where(InterventionCase.assignee_user_id == assignee_user_id)
    if student_id is not None:
        query = query.where(InterventionCase.student_id == student_id)
    if overdue is True:
        query = query.where(InterventionCase.follow_up_at < func.now(), InterventionCase.status.in_(OPEN_STATUSES))
    rows = (await db.execute(query.order_by(desc(InterventionCase.updated_at)).limit(500))).scalars().all()
    return [_payload(row, current_user) for row in rows]


@router.get("/dashboard-summary")
async def dashboard_summary(db: DBSession, current_user: CurrentUser) -> dict:
    department_ids = await require_department_scope(db, current_user) if current_user.role == UserRole.manager else None
    visible = _visible_filter(current_user, department_ids)
    row = (
        await db.execute(
            select(
                func.count(InterventionCase.id).label("total"),
                func.sum(case((InterventionCase.status == "new", 1), else_=0)).label("new"),
                func.sum(case((InterventionCase.priority.in_(["high", "critical"]), 1), else_=0)).label("high_priority"),
                func.sum(case((InterventionCase.assignee_user_id.is_(None), 1), else_=0)).label("unassigned"),
                func.sum(case((and_(InterventionCase.follow_up_at < func.now(), InterventionCase.status.in_(OPEN_STATUSES)), 1), else_=0)).label("overdue"),
                func.sum(case((InterventionCase.status.in_(["resolved", "closed"]), 1), else_=0)).label("resolved"),
            ).where(visible)
        )
    ).mappings().one()
    return {key: int(value or 0) for key, value in row.items()}


@router.post("/cases/sync-risk-signals")
async def sync_risk_signals(
    db: DBSession,
    current_user: CurrentUser,
    max_cases: int = Query(default=100, ge=1, le=500),
) -> dict:
    """Materialize high/watch academic and ML signals into scoped workflow cases."""
    if current_user.role not in {UserRole.superadmin, UserRole.admin, UserRole.manager, UserRole.lecturer}:
        raise HTTPException(status_code=403, detail="This role cannot sync risk signals")
    section_query = select(Section.id)
    class_query = select(HomeroomAssignment.class_code).where(HomeroomAssignment.is_active == True)  # noqa: E712
    if current_user.role == UserRole.lecturer:
        teacher = await get_teacher_for_user(db, current_user)
        if teacher is None:
            raise HTTPException(status_code=403, detail="Lecturer is not linked to a teacher profile")
        section_query = section_query.where(Section.teacher_id == teacher.id)
        class_query = class_query.where(HomeroomAssignment.teacher_id == teacher.id)
    elif current_user.role == UserRole.manager:
        department_ids = await require_department_scope(db, current_user)
        section_query = section_query.join(Course, Course.id == Section.course_id).where(Course.department_id.in_(department_ids))
        class_query = (
            class_query.join(Teacher, Teacher.id == HomeroomAssignment.teacher_id)
            .where(Teacher.department_id.in_(department_ids))
        )
    section_ids = list((await db.scalars(section_query.order_by(Section.id))).all())
    class_codes = list((await db.scalars(class_query.order_by(HomeroomAssignment.class_code))).all())
    created = 0
    skipped = 0
    scopes_processed = 0
    for section_id in section_ids:
        if created >= max_cases:
            break
        added, ignored = await _sync_scope_candidates(
            db, current_user, scope_type="section", section_id=section_id, remaining=max_cases - created
        )
        created += added
        skipped += ignored
        scopes_processed += 1
    for class_code in class_codes:
        if created >= max_cases:
            break
        added, ignored = await _sync_scope_candidates(
            db, current_user, scope_type="homeroom", class_code=class_code, remaining=max_cases - created
        )
        created += added
        skipped += ignored
        scopes_processed += 1
    await db.flush()
    return {
        "created": created,
        "skipped_existing": skipped,
        "scopes_processed": scopes_processed,
        "max_cases": max_cases,
        "source": "academic_rules+predictions",
        "message": f"Đã tạo {created} ca từ tín hiệu cảnh báo; bỏ qua {skipped} ca đang mở.",
    }


@router.post("/cases", status_code=status.HTTP_201_CREATED)
async def create_case(payload: InterventionCaseCreate, db: DBSession, current_user: CurrentUser) -> dict:
    if current_user.role not in {UserRole.manager, UserRole.lecturer}:
        raise HTTPException(status_code=403, detail="Only managers and scoped lecturers can create cases")
    scope_key = await _require_scope(db, current_user, payload)
    existing = await db.scalar(select(InterventionCase).where(InterventionCase.student_id == payload.student_id, InterventionCase.scope_key == scope_key, InterventionCase.active_key == "active"))
    if existing:
        raise HTTPException(status_code=409, detail={"message": "An active case already exists", "case_id": existing.id})
    assignee = payload.assignee_user_id
    if current_user.role == UserRole.manager and assignee is not None:
        raise HTTPException(status_code=422, detail="Create an unassigned case, then use the scoped assignment endpoint")
    if current_user.role == UserRole.lecturer:
        if assignee and assignee != current_user.id:
            raise HTTPException(status_code=403, detail="Lecturers can only assign a case to themselves")
        assignee = current_user.id
    item = InterventionCase(
        student_id=payload.student_id,
        scope_type=payload.scope_type,
        scope_key=scope_key,
        section_id=payload.section_id,
        class_code=payload.class_code,
        source=payload.source,
        priority=payload.priority,
        status="assigned" if assignee else "new",
        assignee_user_id=assignee,
        created_by_user_id=current_user.id,
        follow_up_at=payload.follow_up_at,
        signal_snapshot=payload.signal_snapshot,
    )
    db.add(item)
    await db.flush()
    db.add(InterventionCaseEvent(case_id=item.id, actor_user_id=current_user.id, event_type="created", payload_json={"priority": item.priority}))
    await db.flush()
    return _payload(await _get_visible_case(db, current_user, item.id), current_user, include_events=True)


@router.get("/cases/{case_id}")
async def get_case(case_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    return _payload(await _get_visible_case(db, current_user, case_id), current_user, include_events=True)


@router.patch("/cases/{case_id}")
async def update_case(case_id: int, payload: InterventionCaseUpdate, db: DBSession, current_user: CurrentUser) -> dict:
    item = await _get_visible_case(db, current_user, case_id)
    changes = payload.model_dump(exclude_unset=True)
    if current_user.role == UserRole.manager:
        disallowed = set(changes) - {"priority", "follow_up_at"}
        if disallowed:
            raise HTTPException(status_code=403, detail="Managers may only change priority or follow-up date")
    elif current_user.role != UserRole.lecturer or item.assignee_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned lecturer can update workflow status")
    old_status = item.status
    for key, value in changes.items():
        setattr(item, key, value)
    if payload.status in {"resolved", "closed"}:
        item.active_key = None
        item.resolved_at = datetime.now(UTC)
    elif payload.status and old_status in {"resolved", "closed"}:
        item.active_key = "active"
        item.resolved_at = None
    db.add(InterventionCaseEvent(case_id=item.id, actor_user_id=current_user.id, event_type="updated", payload_json={"before_status": old_status, **changes}))
    await db.flush()
    return _payload(await _get_visible_case(db, current_user, case_id), current_user, include_events=True)


@router.post("/cases/{case_id}/assign")
async def assign_case(case_id: int, payload: InterventionCaseAssign, db: DBSession, current_user: CurrentUser) -> dict:
    if current_user.role != UserRole.manager:
        raise HTTPException(status_code=403, detail="Only department managers can assign cases")
    item = await _get_visible_case(db, current_user, case_id)
    assignee = await db.get(User, payload.assignee_user_id)
    if assignee is None or assignee.role != UserRole.lecturer or not assignee.is_active:
        raise HTTPException(status_code=422, detail="Assignee must be an active lecturer")
    manager_departments = await require_department_scope(db, current_user)
    teacher = await get_teacher_for_user(db, assignee)
    if teacher is None or teacher.department_id not in manager_departments:
        raise HTTPException(status_code=403, detail="Assignee is outside your department")
    scope_ok = await can_access_section(db, assignee, item.section_id) if item.section_id else await _can_access_homeroom(db, assignee, item.class_code or "")
    if not scope_ok:
        raise HTTPException(status_code=422, detail="Assignee is not responsible for this section or homeroom")
    previous = item.assignee_user_id
    item.assignee_user_id = assignee.id
    if item.status == "new":
        item.status = "assigned"
    db.add(InterventionCaseEvent(case_id=item.id, actor_user_id=current_user.id, event_type="assigned", payload_json={"from": previous, "to": assignee.id}))
    await db.flush()
    return _payload(await _get_visible_case(db, current_user, case_id), current_user, include_events=True)


@router.post("/cases/{case_id}/events", status_code=status.HTTP_201_CREATED)
async def add_case_event(case_id: int, payload: InterventionCaseEventCreate, db: DBSession, current_user: CurrentUser) -> dict:
    item = await _get_visible_case(db, current_user, case_id)
    if current_user.role == UserRole.manager:
        if payload.event_type != "escalation":
            raise HTTPException(status_code=403, detail="Managers may only add escalation events")
    elif current_user.role != UserRole.lecturer or item.assignee_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned lecturer can add case events")
    event = InterventionCaseEvent(case_id=case_id, actor_user_id=current_user.id, event_type=payload.event_type, payload_json=payload.payload)
    db.add(event)
    await db.flush()
    return {"id": event.id, "case_id": case_id, "event_type": event.event_type, "payload": event.payload_json, "created_at": event.created_at}

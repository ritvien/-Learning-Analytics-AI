"""Learning-support intervention campaign APIs."""

from __future__ import annotations

import asyncio
import smtplib
import ssl
from datetime import UTC, datetime
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from app.access_control import can_access_section
from app.config import get_settings
from app.dependencies import CurrentUser, DBSession
from app.models.intervention import (
    InterventionCampaign,
    InterventionCase,
    InterventionCaseEvent,
    InterventionMessage,
    InterventionMessageEvent,
    StudentInterventionContact,
)
from app.schemas.intervention import (
    InterventionBulkNotifyRequest,
    InterventionCampaignCreate,
    InterventionCampaignGenerateDrafts,
    InterventionMessageEventCreate,
    InterventionMessageUpdate,
)

from .interventions import (
    _bulk_candidates,
    _bulk_message,
    _require_homeroom_scope,
    _scope_payload_for_bulk,
    require_intervention_actor,
)

router = APIRouter()


def _now() -> datetime:
    return datetime.now(UTC)


def _smtp_ready() -> bool:
    settings = get_settings()
    return bool(
        settings.smtp_enabled
        and settings.smtp_host.strip()
        and settings.smtp_from_email.strip()
        and settings.smtp_username.strip()
        and settings.smtp_password.strip()
    )


def _send_smtp_message(message: InterventionMessage) -> str:
    """Send one reviewed email and return the provider/local message id."""
    settings = get_settings()
    if not message.recipient_email:
        raise ValueError("Missing recipient email")
    email = EmailMessage()
    provider_message_id = make_msgid(domain=settings.smtp_from_email.split("@")[-1])
    email["Message-ID"] = provider_message_id
    email["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    email["To"] = message.recipient_email
    email["Subject"] = message.subject or "Hỗ trợ học tập"
    email.set_content(message.body or "")

    if settings.smtp_use_tls:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as server:
            server.starttls(context=context)
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(email)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as server:
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(email)
    return provider_message_id


def _message_payload(message: InterventionMessage) -> dict:
    student = message.__dict__.get("student")
    return {
        "id": message.id,
        "campaign_id": message.campaign_id,
        "student_id": message.student_id,
        "student_code": student.student_code if student else None,
        "full_name": student.full_name if student else None,
        "contact_id": message.contact_id,
        "channel": message.channel,
        "recipient_email": message.recipient_email,
        "subject": message.subject,
        "body": message.body,
        "template_key": message.template_key,
        "template_version": message.template_version,
        "status": message.status,
        "approved_by_user_id": message.approved_by_user_id,
        "approved_at": message.approved_at,
        "sent_at": message.sent_at,
        "provider_message_id": message.provider_message_id,
        "error_code": message.error_code,
        "error_message": message.error_message,
        "metadata_json": message.metadata_json or {},
        "created_at": message.created_at,
        "updated_at": message.updated_at,
    }


def _campaign_payload(campaign: InterventionCampaign) -> dict:
    actor = campaign.__dict__.get("actor")
    messages = campaign.__dict__.get("messages") or []
    return {
        "id": campaign.id,
        "actor_user_id": campaign.actor_user_id,
        "actor_name": actor.full_name if actor else None,
        "scope_type": campaign.scope_type,
        "section_id": campaign.section_id,
        "class_code": campaign.class_code,
        "title": campaign.title,
        "objective": campaign.objective,
        "status": campaign.status,
        "source": campaign.source,
        "summary_json": campaign.summary_json or {},
        "created_at": campaign.created_at,
        "updated_at": campaign.updated_at,
        "messages": [_message_payload(message) for message in messages],
    }


async def _get_campaign(db: DBSession, user: CurrentUser, campaign_id: int) -> InterventionCampaign:
    campaign = (
        await db.execute(
            select(InterventionCampaign)
            .execution_options(populate_existing=True)
            .options(
                selectinload(InterventionCampaign.actor),
                selectinload(InterventionCampaign.messages).selectinload(InterventionMessage.student),
            )
            .where(InterventionCampaign.id == campaign_id)
        )
    ).scalar_one_or_none()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    if campaign.scope_type == "section":
        if campaign.section_id is None or not await can_access_section(db, user, campaign.section_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    elif campaign.scope_type == "homeroom":
        if not campaign.class_code:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
        await _require_homeroom_scope(db, user, campaign.class_code)
    return campaign


async def _add_event(db: DBSession, message: InterventionMessage, event_type: str, payload: dict | None = None) -> None:
    db.add(
        InterventionMessageEvent(
            message_id=message.id,
            event_type=event_type,
            payload_json=payload or {},
            created_at=_now(),
        )
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_intervention_campaign(
    payload: InterventionCampaignCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Create an empty learning-support campaign for a visible scope."""
    require_intervention_actor(current_user)
    bulk_payload = InterventionBulkNotifyRequest(
        scope_type=payload.scope_type,
        scope_id=payload.scope_id,
        class_code=payload.class_code,
        student_ids=payload.student_ids,
        max_students=payload.max_students,
    )
    data, section_id, class_code = await _scope_payload_for_bulk(db, current_user, bulk_payload)
    title = payload.title or f"Campaign hỗ trợ học tập - {data['scope'].get('code') or class_code or section_id}"
    campaign = InterventionCampaign(
        actor_user_id=current_user.id,
        scope_type=payload.scope_type,
        section_id=section_id,
        class_code=class_code,
        title=title,
        objective=payload.objective,
        status="draft",
        source="agent",
        summary_json={
            "scope": data["scope"],
            "summary": data["summary"],
            "selected_student_ids": payload.student_ids or [],
            "delivery_mode": "campaign_draft",
        },
    )
    db.add(campaign)
    await db.flush()
    return _campaign_payload(await _get_campaign(db, current_user, campaign.id))


@router.get("")
async def list_intervention_campaigns(
    db: DBSession,
    current_user: CurrentUser,
    scope_type: str | None = None,
    section_id: int | None = None,
    class_code: str | None = None,
) -> list[dict]:
    """List campaigns visible in one scope."""
    query = (
        select(InterventionCampaign)
        .options(
            selectinload(InterventionCampaign.actor),
            selectinload(InterventionCampaign.messages).selectinload(InterventionMessage.student),
        )
        .order_by(desc(InterventionCampaign.created_at), desc(InterventionCampaign.id))
    )
    if scope_type:
        query = query.where(InterventionCampaign.scope_type == scope_type)
    if section_id is not None:
        if not await can_access_section(db, current_user, section_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
        query = query.where(InterventionCampaign.section_id == section_id)
    if class_code:
        await _require_homeroom_scope(db, current_user, class_code)
        query = query.where(InterventionCampaign.class_code == class_code)
    rows = (await db.execute(query.limit(50))).scalars().all()
    visible = []
    for campaign in rows:
        if campaign.scope_type == "section" and campaign.section_id is not None:
            if not await can_access_section(db, current_user, campaign.section_id):
                continue
        elif campaign.scope_type == "homeroom" and campaign.class_code:
            await _require_homeroom_scope(db, current_user, campaign.class_code)
        visible.append(_campaign_payload(campaign))
    return visible


@router.get("/delivery-status")
async def get_campaign_delivery_status(current_user: CurrentUser) -> dict:
    """Return whether real SMTP delivery is ready for campaign email sends."""
    settings = get_settings()
    configured = _smtp_ready()
    return {
        "configured": configured,
        "delivery_mode": "smtp" if configured else "smtp_not_configured",
        "smtp_host": settings.smtp_host or None,
        "smtp_port": settings.smtp_port,
        "from_email": settings.smtp_from_email or None,
        "from_name": settings.smtp_from_name,
        "missing": [
            name
            for name, value in [
                ("SMTP_ENABLED", settings.smtp_enabled),
                ("SMTP_HOST", settings.smtp_host.strip()),
                ("SMTP_USERNAME", settings.smtp_username.strip()),
                ("SMTP_PASSWORD", settings.smtp_password.strip()),
                ("SMTP_FROM_EMAIL", settings.smtp_from_email.strip()),
            ]
            if not value
        ],
    }


@router.get("/{campaign_id}")
async def get_intervention_campaign(campaign_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Return one campaign with message drafts."""
    return _campaign_payload(await _get_campaign(db, current_user, campaign_id))


@router.post("/{campaign_id}/generate-drafts")
async def generate_campaign_drafts(
    campaign_id: int,
    payload: InterventionCampaignGenerateDrafts,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Generate personalized message drafts for selected at-risk students."""
    require_intervention_actor(current_user)
    campaign = await _get_campaign(db, current_user, campaign_id)
    if payload.replace_existing:
        for message in list(campaign.messages):
            await db.delete(message)
        await db.flush()

    bulk_payload = InterventionBulkNotifyRequest(
        scope_type=campaign.scope_type,
        scope_id=campaign.section_id,
        class_code=campaign.class_code,
        student_ids=payload.student_ids,
        channel=payload.channel,
        status="drafted",
        subject=payload.subject,
        message_template=payload.message_template,
        max_students=payload.max_students,
    )
    data, _, _ = await _scope_payload_for_bulk(db, current_user, bulk_payload)
    candidates = _bulk_candidates(data, bulk_payload)
    existing_student_ids = {message.student_id for message in campaign.messages}
    created = 0
    skipped = []

    for student in candidates:
        if student["student_id"] in existing_student_ids:
            skipped.append({"student_id": student["student_id"], "reason": "already_in_campaign"})
            continue
        missing_email = payload.channel == "email" and not student.get("email")
        message = InterventionMessage(
            campaign_id=campaign.id,
            student_id=student["student_id"],
            channel=payload.channel,
            recipient_email=student.get("email"),
            subject=payload.subject,
            body=None if missing_email else _bulk_message(student, payload.message_template),
            template_key="learning_support_email",
            template_version="v1",
            status="failed" if missing_email else "drafted",
            error_code="missing_email" if missing_email else None,
            error_message="Sinh viên chưa có email trong hồ sơ." if missing_email else None,
            metadata_json={
                "source": "intervention_campaign_agent_v1",
                "scope": data["scope"],
                "risk_level": student["risk_level"],
                "risk_score": student["risk_score"],
                "reasons": student.get("reasons") or [],
                "recommended_actions": student.get("recommended_actions") or [],
                "delivery_mode": "draft_review",
            },
        )
        db.add(message)
        await db.flush()
        await _add_event(
            db,
            message,
            "created",
            {"status": message.status, "reason": message.error_code, "agent_source": "intervention_campaign_agent_v1"},
        )
        created += 1

    campaign.status = "reviewing" if created else campaign.status
    campaign.summary_json = {
        **(campaign.summary_json or {}),
        "scope": data["scope"],
        "summary": data["summary"],
        "generated_count": created,
        "skipped": skipped,
    }
    await db.flush()
    return _campaign_payload(await _get_campaign(db, current_user, campaign_id))


@router.patch("/messages/{message_id}")
async def update_campaign_message(
    message_id: int,
    payload: InterventionMessageUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Edit one campaign message before approval."""
    require_intervention_actor(current_user)
    message = await db.get(InterventionMessage, message_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    await _get_campaign(db, current_user, message.campaign_id)
    for field in ("channel", "recipient_email", "subject", "body", "status"):
        value = getattr(payload, field)
        if value is not None:
            setattr(message, field, value)
    message.error_code = None if message.recipient_email or message.channel != "email" else "missing_email"
    message.error_message = None if message.error_code is None else "Sinh viên chưa có email trong hồ sơ."
    await db.flush()
    await _add_event(db, message, "edited", {"updated_by": current_user.id})
    await db.refresh(message, attribute_names=["student"])
    return _message_payload(message)


@router.post("/messages/{message_id}/approve")
async def approve_campaign_message(message_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Approve one message after lecturer review."""
    require_intervention_actor(current_user)
    message = await db.get(InterventionMessage, message_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    await _get_campaign(db, current_user, message.campaign_id)
    if message.channel == "email" and not message.recipient_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot approve email without recipient")
    message.status = "approved"
    message.approved_by_user_id = current_user.id
    message.approved_at = _now()
    await db.flush()
    await _add_event(db, message, "approved", {"approved_by": current_user.id})
    await db.refresh(message, attribute_names=["student"])
    return _message_payload(message)


@router.post("/{campaign_id}/approve")
async def approve_intervention_campaign(campaign_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Approve all valid drafted messages in a campaign."""
    require_intervention_actor(current_user)
    campaign = await _get_campaign(db, current_user, campaign_id)
    approved = 0
    for message in campaign.messages:
        if message.status not in {"drafted", "approved"}:
            continue
        if message.channel == "email" and not message.recipient_email:
            message.status = "failed"
            message.error_code = "missing_email"
            message.error_message = "Sinh viên chưa có email trong hồ sơ."
            continue
        message.status = "approved"
        message.approved_by_user_id = current_user.id
        message.approved_at = message.approved_at or _now()
        await _add_event(db, message, "approved", {"approved_by": current_user.id})
        approved += 1
    campaign.status = "approved" if approved else campaign.status
    await db.flush()
    return _campaign_payload(await _get_campaign(db, current_user, campaign_id))


@router.post("/{campaign_id}/send")
async def send_intervention_campaign(campaign_id: int, db: DBSession, current_user: CurrentUser) -> dict:
    """Send approved campaign emails when SMTP is configured, and always keep an audit trail."""
    require_intervention_actor(current_user)
    campaign = await _get_campaign(db, current_user, campaign_id)
    smtp_ready = _smtp_ready()
    delivery_mode = "smtp" if smtp_ready else "smtp_not_configured"
    created = 0
    sent = 0
    queued = 0
    failed = 0
    campaign.status = "sending"
    for message in campaign.messages:
        if message.status not in {"approved", "drafted"} or message.contact_id is not None:
            continue
        if message.channel == "email" and not message.recipient_email:
            message.status = "failed"
            message.error_code = "missing_email"
            message.error_message = "Sinh viên chưa có email trong hồ sơ."
            await _add_event(db, message, "failed", {"reason": "missing_email"})
            failed += 1
            continue
        provider_message_id = None
        sent_at = None
        contact_status = "logged"
        note = "Campaign can thiệp học tập đã được giảng viên duyệt và lưu vào lịch sử hỗ trợ."
        next_status = "queued"
        if message.channel == "email" and smtp_ready:
            try:
                provider_message_id = await asyncio.to_thread(_send_smtp_message, message)
                sent_at = _now()
                contact_status = "emailed"
                next_status = "sent"
                note = "Campaign can thiệp học tập đã được giảng viên duyệt và gửi qua SMTP."
                sent += 1
            except Exception as exc:  # pragma: no cover - provider/network dependent
                message.status = "failed"
                message.error_code = "smtp_send_failed"
                message.error_message = f"Không gửi được email qua SMTP: {exc}"
                await _add_event(db, message, "failed", {"reason": "smtp_send_failed", "detail": str(exc)})
                failed += 1
                continue
        elif message.channel == "email":
            note = "Campaign đã được duyệt và lưu audit, nhưng chưa gửi email vì SMTP chưa được cấu hình."
            queued += 1
        scope_key = f"section:{campaign.section_id}" if campaign.section_id is not None else f"homeroom:{campaign.class_code}"
        active_case = await db.scalar(
            select(InterventionCase).where(
                InterventionCase.student_id == message.student_id,
                InterventionCase.scope_key == scope_key,
                InterventionCase.active_key == "active",
                InterventionCase.assignee_user_id == current_user.id,
            )
        )
        contact = StudentInterventionContact(
            case_id=active_case.id if active_case else None,
            actor_user_id=current_user.id,
            student_id=message.student_id,
            section_id=campaign.section_id,
            class_code=campaign.class_code,
            channel=message.channel,
            status=contact_status,
            subject=message.subject,
            message=message.body,
            note=note,
            metadata_json={
                **(message.metadata_json or {}),
                "campaign_id": campaign.id,
                "message_id": message.id,
                "delivery_mode": delivery_mode,
            },
        )
        db.add(contact)
        await db.flush()
        if active_case is not None:
            if active_case.status in {"new", "assigned"}:
                active_case.status = "contacting"
            db.add(
                InterventionCaseEvent(
                    case_id=active_case.id,
                    actor_user_id=current_user.id,
                    event_type="contact",
                    payload_json={"contact_id": contact.id, "campaign_id": campaign.id, "channel": message.channel},
                )
            )
        message.contact_id = contact.id
        message.status = next_status
        message.sent_at = sent_at
        message.provider_message_id = provider_message_id
        await _add_event(
            db,
            message,
            "sent" if next_status == "sent" else "queued",
            {"delivery_mode": delivery_mode, "contact_id": contact.id, "provider_message_id": provider_message_id},
        )
        created += 1
    campaign.status = "completed" if sent else ("approved" if queued or failed else campaign.status)
    campaign.summary_json = {
        **(campaign.summary_json or {}),
        "finalized_count": created,
        "sent_count": sent,
        "queued_count": queued,
        "failed_count": failed,
        "delivery_mode": delivery_mode,
    }
    await db.flush()
    if smtp_ready:
        message_text = f"Đã gửi {sent} email và lưu {created} liên hệ vào lịch sử hỗ trợ."
    else:
        message_text = "Đã lưu campaign và danh sách email, nhưng chưa gửi thật vì SMTP chưa được cấu hình."
    return {
        **_campaign_payload(await _get_campaign(db, current_user, campaign_id)),
        "delivery_mode": delivery_mode,
        "created_contact_count": created,
        "sent_count": sent,
        "queued_count": queued,
        "failed_count": failed,
        "message": message_text,
    }


@router.post("/messages/{message_id}/events")
async def log_campaign_message_event(
    message_id: int,
    payload: InterventionMessageEventCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Log an educational follow-up event such as reply or meeting scheduled."""
    message = await db.get(InterventionMessage, message_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    await _get_campaign(db, current_user, message.campaign_id)
    await _add_event(db, message, payload.event_type, {"actor_user_id": current_user.id, **payload.payload})
    await db.flush()
    await db.refresh(message, attribute_names=["student"])
    return _message_payload(message)

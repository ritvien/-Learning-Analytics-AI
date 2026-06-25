"""Application service for the Report Agent API."""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from inspect import isawaitable
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.access_control import can_create_report_scope, can_view_report, can_view_report_scope
from app.agent.report_prompts import REPORT_AGENT_PROMPT_VERSION, REPORT_AGENT_SYSTEM_PROMPT
from app.agent.report_tools import (
    TOOL_REGISTRY,
    explain_report_metric,
    get_historical_trend,
    get_report_snapshot,
    list_recent_reports,
    suggest_report_actions,
    trace_report_metric,
)
from app.config import get_settings
from app.models.academic import Semester
from app.models.agent import (
    AgentMemory,
    AgentPromptVersion,
    ReportAgentMessage,
    ReportAgentPendingAction,
    ReportAgentSession,
    ReportAgentToolCall,
)
from app.models.people import User
from app.models.report import Report
from app.reports.service import generate_report

WRITE_INTENT_WORDS = ("tạo task", "tao task", "giao việc", "schedule", "hẹn lịch", "gửi report", "send report")

REPORT_BUILD_DEFAULTS: dict[str, dict[str, str]] = {
    "school_overview": {"scope_type": "school", "actor_role": "manager"},
    "department_health": {"scope_type": "department", "actor_role": "manager"},
    "program_health": {"scope_type": "program", "actor_role": "manager"},
    "course_health": {"scope_type": "course", "actor_role": "lecturer"},
    "section_intervention": {"scope_type": "section", "actor_role": "lecturer"},
}

REPORT_BUILD_DESIGNS: dict[str, dict[str, Any]] = {
    "school_overview": {"label": "Tóm tắt điều hành toàn trường", "outline": ["Tóm tắt điều hành", "Chỉ số học vụ cốt lõi", "Đơn vị và môn cần chú ý", "Hành động ưu tiên"], "visuals": ["Xu hướng tỷ lệ đạt", "Phân bố kết quả", "Top đơn vị/môn rủi ro"]},
    "department_health": {"label": "Sức khỏe khoa", "outline": ["Tóm tắt khoa", "So sánh ngành", "Môn nghẽn", "Kế hoạch xử lý"], "visuals": ["Pass rate theo ngành", "Xu hướng theo kỳ", "Bảng môn nghẽn"]},
    "program_health": {"label": "Sức khỏe ngành và PLO", "outline": ["Tóm tắt ngành", "PLO/CLO", "Môn và lớp bất thường", "Minh chứng và hành động"], "visuals": ["Xu hướng điểm/pass rate", "PLO/CLO attainment", "Danh sách môn kéo kết quả xuống"]},
    "course_health": {"label": "Sức khỏe môn học", "outline": ["Tóm tắt môn", "Xu hướng qua học kỳ", "CLO và phân bố điểm", "Lớp học phần cần chú ý"], "visuals": ["Xu hướng điểm trung bình", "Phân bổ điểm", "So sánh lớp học phần"]},
    "section_intervention": {"label": "Can thiệp lớp học phần", "outline": ["Tình hình lớp", "Tiến độ nhập điểm", "Sinh viên cần can thiệp", "Kế hoạch hành động"], "visuals": ["Phân loại học lực", "Tiến độ đầu điểm", "Roster đã lọc theo nguy cơ"]},
}


async def ensure_report_agent_prompt(db: AsyncSession) -> None:
    """Persist the active prompt version if it is missing."""
    result = await db.execute(
        select(AgentPromptVersion).where(
            AgentPromptVersion.name == "report_agent",
            AgentPromptVersion.version == REPORT_AGENT_PROMPT_VERSION,
        )
    )
    if result.scalar_one_or_none() is not None:
        return
    db.add(
        AgentPromptVersion(
            name="report_agent",
            version=REPORT_AGENT_PROMPT_VERSION,
            content=REPORT_AGENT_SYSTEM_PROMPT,
            is_active=True,
        )
    )
    await db.flush()


async def create_report_agent_session(
    db: AsyncSession,
    user: User,
    report_id: str | None,
    mode: str,
    title: str | None,
    scope: dict[str, Any],
) -> ReportAgentSession:
    """Create a report-agent session."""
    session = ReportAgentSession(
        user_id=user.id,
        report_id=report_id,
        mode=mode,
        title=title or _session_title(mode, report_id),
        scope_json=scope,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def get_report_agent_session(db: AsyncSession, user: User, session_id: str) -> ReportAgentSession | None:
    """Load a session owned by the current user."""
    result = await db.execute(
        select(ReportAgentSession)
        .options(selectinload(ReportAgentSession.messages))
        .where(ReportAgentSession.id == session_id, ReportAgentSession.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def ask_report_agent(
    db: AsyncSession,
    user: User,
    message: str,
    mode: str,
    context: dict[str, Any],
    report_id: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Answer a report question with grounded tools, memory, and audit logs."""
    started = time.perf_counter()
    await ensure_report_agent_prompt(db)

    session = await _get_or_create_session(db, user, session_id, report_id, mode, context)
    user_message = ReportAgentMessage(
        session_id=session.id,
        user_id=user.id,
        role="user",
        content=message,
        context_json=context,
    )
    db.add(user_message)
    await db.flush()

    tool_calls: list[dict[str, Any]] = []
    memories = await _load_memories(db, user.id)
    memory_summary = _summarize_memories(memories)
    selected_report_id = report_id or session.report_id or context.get("report_id")
    selected_metric = context.get("metric_key") or _extract_metric_key(message)
    snapshot: dict[str, Any] | None = None

    if selected_report_id:
        report_obj = await db.get(Report, str(selected_report_id))
        if report_obj is None or not await can_view_report(db, user, report_obj):
            raise ValueError("Report not found")
        snapshot = await _run_tool(
            db,
            session,
            user,
            user_message.id,
            "get_report_snapshot",
            {"report_id": selected_report_id},
            lambda: get_report_snapshot(db, str(selected_report_id)),
            tool_calls,
        )
        if snapshot.get("found"):
            session.report_id = snapshot["id"]
            await _remember_recent_report(db, user.id, snapshot)

            if _wants_metric_explanation(message, context):
                await _run_tool(
                    db,
                    session,
                    user,
                    user_message.id,
                    "explain_report_metric",
                    {"report_id": snapshot["id"], "metric_key": selected_metric},
                    lambda: explain_report_metric(snapshot or {}, selected_metric),
                    tool_calls,
                )
            if _wants_trace(message):
                await _run_tool(
                    db,
                    session,
                    user,
                    user_message.id,
                    "trace_report_metric",
                    {"report_id": snapshot["id"], "metric_key": selected_metric},
                    lambda: trace_report_metric(snapshot or {}, selected_metric),
                    tool_calls,
                )
            if _wants_trend(message):
                _scope = snapshot.get("scope_id")
                _rtype = snapshot.get("report_type")
                if _rtype:
                    await _run_tool(
                        db,
                        session,
                        user,
                        user_message.id,
                        "get_historical_trend",
                        {"report_type": _rtype, "scope_id": _scope},
                        lambda rt=_rtype, si=_scope: get_historical_trend(db, rt, si),
                        tool_calls,
                    )
            if mode in {"action_planning", "workflow"} or _wants_action(message):
                await _run_tool(
                    db,
                    session,
                    user,
                    user_message.id,
                    "suggest_report_actions",
                    {"report_id": snapshot["id"]},
                    lambda: suggest_report_actions(snapshot or {}),
                    tool_calls,
                )
    else:
        recent_reports = await _run_tool(
            db,
            session,
            user,
            user_message.id,
            "list_recent_reports",
            {"limit": 10},
            lambda: _list_recent_reports_for_user(db, user, 10),
            tool_calls,
        )
        snapshot = {"recent_reports": recent_reports}

    pending_actions = await _maybe_create_pending_action(db, session, user, message, tool_calls)
    answer = await _build_answer(message, mode, context, snapshot or {}, memory_summary, tool_calls)

    assistant_message = ReportAgentMessage(
        session_id=session.id,
        user_id=user.id,
        role="assistant",
        content=answer,
        context_json={"mode": mode, "prompt_version": REPORT_AGENT_PROMPT_VERSION},
    )
    db.add(assistant_message)
    session.short_summary = _update_short_summary(session.short_summary, message, answer)
    await db.flush()

    return {
        "response": answer,
        "session_id": session.id,
        "mode": mode,
        "prompt_version": REPORT_AGENT_PROMPT_VERSION,
        "memory_summary": memory_summary,
        "tool_calls": tool_calls,
        "pending_actions": pending_actions,
        "latency_ms": int((time.perf_counter() - started) * 1000),
    }


async def confirm_pending_action(
    db: AsyncSession,
    user: User,
    action_id: str,
    decision: str,
) -> dict[str, Any]:
    """Confirm or cancel a pending write action.

    MVP records the decision and returns a deterministic result. Actual task/report
    mutation can be wired per action type after the workflow screens are ready.
    """
    action = await db.get(ReportAgentPendingAction, action_id)
    if action is None or action.user_id != user.id:
        raise ValueError("Pending action not found")
    if action.status != "pending":
        return {"id": action.id, "status": action.status, "result": action.result_json}

    if decision == "cancel":
        action.status = "cancelled"
        action.result_json = {"message": "Action cancelled by user"}
    elif action.action_type == "create_report_snapshot":
        definition = action.payload_json.get("definition") if isinstance(action.payload_json, dict) else None
        if not isinstance(definition, dict):
            raise ValueError("Report definition is missing")
        allowed = await can_create_report_scope(
            db,
            user,
            str(definition.get("report_type") or ""),
            str(definition.get("scope_type") or ""),
            definition.get("scope_id"),
        )
        if not allowed:
            raise ValueError("Report scope is outside your permissions")
        report = await generate_report(
            db,
            report_type=str(definition["report_type"]),
            actor_role=str(definition.get("actor_role") or "manager"),
            generated_by=user.id,
            scope_type=str(definition["scope_type"]),
            scope_id=definition.get("scope_id"),
            semester_id=_as_optional_int(definition.get("semester_id")),
            period_start=_as_optional_datetime(definition.get("period_start")),
            period_end=_as_optional_datetime(definition.get("period_end")),
        )
        if definition.get("custom_request"):
            report.title = f"Báo cáo tùy chỉnh - {report.title}"
            report.metrics_json = {
                **(report.metrics_json or {}),
                "agent_custom_request": definition["custom_request"],
                "agent_report_outline": definition.get("outline", []),
            }
            report.content_markdown = f"{report.content_markdown}\n\n## Yêu cầu tùy chỉnh\n{definition['custom_request']}\n"
        db.add(
            ReportAgentToolCall(
                session_id=action.session_id,
                user_id=user.id,
                tool_name="create_report_snapshot",
                tool_input_json={"definition": definition},
                tool_output_json={"report_id": report.id, "report_type": report.report_type},
                status="success",
            )
        )
        action.status = "confirmed"
        action.confirmed_at = datetime.now(UTC)
        report_url = f"/manager/reports?report={report.id}"
        action.result_json = {
            "message": "Report snapshot created",
            "report_id": report.id,
            "report_url": report_url,
            "output_format": "link",
        }
    else:
        action.status = "confirmed"
        action.confirmed_at = datetime.now(UTC)
        action.result_json = {
            "message": "Action confirmed and ready for workflow execution",
            "action_type": action.action_type,
        }
    await db.flush()
    return {"id": action.id, "status": action.status, "result": action.result_json}


def tool_registry_payload() -> list[dict[str, Any]]:
    """Return report-agent tool metadata for API/UI."""
    return [
        {
            "name": item.name,
            "description": item.description,
            "mode": list(item.mode),
            "requires_confirmation": item.requires_confirmation,
            "write_action": item.write_action,
        }
        for item in TOOL_REGISTRY
    ]


async def plan_report_build(
    db: AsyncSession,
    user: User,
    message: str,
    context: dict[str, Any],
    session_id: str | None = None,
) -> dict[str, Any]:
    """Create a permission-checked report plan that remains pending until confirmed."""
    scope_context = context.get("scope") if isinstance(context.get("scope"), dict) else context
    if _needs_report_discovery(message, context):
        definition = _discovery_report_definition(message, context)
        session = await _get_or_create_session(db, user, session_id, None, "workflow", {"build_definition": definition})
        return {
            "session_id": session.id,
            "definition": definition,
            "data_quality": {
                "status": "needs_discovery",
                "message": "Chưa đủ brief để chọn tool và filter báo cáo.",
            },
            "missing_fields": ["report_type", "scope", "period", "purpose"],
            "requires_confirmation": True,
            "message": _build_report_discovery_question(),
        }
    report_type = _infer_report_type(message, context)
    defaults = REPORT_BUILD_DEFAULTS[report_type]
    design = REPORT_BUILD_DESIGNS[report_type]
    scope_type = defaults["scope_type"]
    supplied_scope_type = scope_context.get("scope_type")
    scope_id = scope_context.get("scope_id") if supplied_scope_type in {None, scope_type} else None
    semester_id = _as_optional_int(scope_context.get("semester_id") or context.get("semester_id"))
    if semester_id is None:
        current_semester = (
            await db.execute(select(Semester).where(Semester.is_current.is_(True)).limit(1))
        ).scalar_one_or_none()
        semester_id = current_semester.id if current_semester is not None else None
    period = scope_context.get("period") if isinstance(scope_context.get("period"), dict) else context.get("period")
    period = period if isinstance(period, dict) else {}
    custom_request = context.get("custom_request")
    is_custom = isinstance(custom_request, str) and bool(custom_request.strip())
    brief = _extract_report_brief(message, context)
    definition = {
        "report_type": report_type,
        "actor_role": defaults["actor_role"],
        "scope_type": scope_type,
        "scope_id": str(scope_id) if scope_id is not None else None,
        "scope_hint": _extract_scope_hint(message, context),
        "semester_id": semester_id,
        "period_start": period.get("from") or context.get("period_start"),
        "period_end": period.get("to") or context.get("period_end"),
        "assessment_stage": _infer_assessment_stage(message),
        "output_format": "link",
        "template_label": "Báo cáo tùy chỉnh" if is_custom else design["label"],
        "base_design": design["label"],
        "outline": design["outline"],
        "visuals": design["visuals"],
        "custom_request": custom_request,
        "audience": brief.get("audience"),
        "purpose": brief.get("purpose"),
        "decision": brief.get("decision"),
        "comparison": brief.get("comparison"),
        "is_custom": is_custom,
        "source": context.get("source", "global_chat"),
    }
    missing_fields = _missing_report_brief_fields(definition, message, context)
    session = await _get_or_create_session(db, user, session_id, None, "workflow", {"build_definition": definition})
    if missing_fields:
        question = _build_report_brief_question(definition, missing_fields)
        return {
            "session_id": session.id,
            "definition": definition,
            "data_quality": {
                "status": "incomplete",
                "message": "Cần chốt đủ ngữ cảnh trước khi xem trước dữ liệu hoặc tạo snapshot.",
            },
            "missing_fields": missing_fields,
            "requires_confirmation": True,
            "message": question,
        }

    allowed = await can_create_report_scope(
        db,
        user,
        definition["report_type"],
        definition["scope_type"],
        definition["scope_id"],
    )
    if not allowed:
        return {
            "session_id": session.id,
            "definition": definition,
            "data_quality": {"status": "blocked", "message": "Phạm vi yêu cầu nằm ngoài quyền của bạn."},
            "missing_fields": [],
            "requires_confirmation": True,
            "message": "Tôi không thể tạo báo cáo cho phạm vi này vì nó nằm ngoài quyền của bạn.",
        }

    action = ReportAgentPendingAction(
        session_id=session.id,
        user_id=user.id,
        action_type="create_report_snapshot",
        payload_json={"definition": definition, "request": message},
    )
    db.add(action)
    db.add(
        ReportAgentToolCall(
            session_id=session.id,
            user_id=user.id,
            tool_name="draft_report_definition",
            tool_input_json={"message": message, "context": context},
            tool_output_json={"definition": definition, "data_quality": {"status": "scope_verified"}},
            status="success",
        )
    )
    await db.flush()
    return {
        "session_id": session.id,
        "action_id": action.id,
        "definition": definition,
        "data_quality": {
            "status": "scope_verified",
            "message": "Phạm vi đã được kiểm tra quyền. Snapshot sẽ dùng dữ liệu tại thời điểm bạn xác nhận.",
            "snapshot_warning": "Chất lượng điểm và cỡ mẫu sẽ được ghi trong report sau khi tạo.",
            "assessment_warning": "Yêu cầu giữa kỳ sẽ được ghi nhận, nhưng aggregate report hiện dùng dữ liệu kết quả sẵn có trong phạm vi; chưa có aggregate giữa kỳ riêng.",
        },
        "missing_fields": [],
        "requires_confirmation": True,
        "message": "Bản nháp báo cáo đã sẵn sàng. Hãy xác nhận để tạo snapshot báo cáo bất biến.",
    }


async def _get_or_create_session(
    db: AsyncSession,
    user: User,
    session_id: str | None,
    report_id: str | None,
    mode: str,
    context: dict[str, Any],
) -> ReportAgentSession:
    if session_id:
        session = await get_report_agent_session(db, user, session_id)
        if session is None:
            raise ValueError("Session not found")
        session.mode = mode or session.mode
        if report_id:
            session.report_id = report_id
        return session
    return await create_report_agent_session(
        db,
        user=user,
        report_id=report_id,
        mode=mode,
        title=None,
        scope=context.get("scope") or context,
    )


async def _run_tool(
    db: AsyncSession,
    session: ReportAgentSession,
    user: User,
    message_id: int | None,
    tool_name: str,
    tool_input: dict[str, Any],
    func,
    tool_calls: list[dict[str, Any]],
) -> Any:
    started = time.perf_counter()
    status = "success"
    error_text = None
    try:
        result = func()
        output = await result if isawaitable(result) else result
    except Exception as exc:
        status = "error"
        error_text = str(exc)
        output = {"error": str(exc)}
    latency_ms = int((time.perf_counter() - started) * 1000)
    output_json = output if isinstance(output, dict) else {"result": output}
    call_payload = {
        "tool_name": tool_name,
        "tool_input": tool_input,
        "tool_output": output_json,
        "status": status,
        "latency_ms": latency_ms,
    }
    tool_calls.append(call_payload)
    db.add(
        ReportAgentToolCall(
            session_id=session.id,
            message_id=message_id,
            user_id=user.id,
            tool_name=tool_name,
            tool_input_json=tool_input,
            tool_output_json=output_json,
            status=status,
            latency_ms=latency_ms,
            error_text=error_text,
        )
    )
    await db.flush()
    return output


async def _load_memories(db: AsyncSession, user_id: str) -> list[AgentMemory]:
    result = await db.execute(
        select(AgentMemory)
        .where(AgentMemory.user_id == user_id, AgentMemory.namespace == "report_agent")
        .order_by(AgentMemory.updated_at.desc())
        .limit(8)
    )
    return list(result.scalars().all())


def _summarize_memories(memories: list[AgentMemory]) -> str | None:
    if not memories:
        return None
    parts = []
    for item in memories[:5]:
        value = item.value_json
        if isinstance(value, dict):
            label = value.get("title") or value.get("label") or value.get("report_id") or item.key
        else:
            label = item.key
        parts.append(f"{item.memory_type}:{label}")
    return "; ".join(parts)


async def _remember_recent_report(db: AsyncSession, user_id: str, snapshot: dict[str, Any]) -> None:
    db.add(
        AgentMemory(
            user_id=user_id,
            namespace="report_agent",
            memory_type="recent_report",
            key=str(snapshot["id"]),
            value_json={
                "report_id": snapshot["id"],
                "title": snapshot.get("title"),
                "report_type": snapshot.get("report_type"),
                "scope_type": snapshot.get("scope_type"),
                "scope_id": snapshot.get("scope_id"),
            },
            source="report_agent_tool",
            confidence=90,
        )
    )
    await db.flush()


async def _list_recent_reports_for_user(db: AsyncSession, user: User, limit: int) -> list[dict[str, Any]]:
    reports = await list_recent_reports(db, 200)
    visible: list[dict[str, Any]] = []
    for report in reports:
        if await can_view_report_scope(
            db,
            user,
            str(report.get("report_type") or ""),
            report.get("scope_type"),
            report.get("scope_id"),
        ):
            visible.append(report)
        if len(visible) >= limit:
            break
    return visible


async def _maybe_create_pending_action(
    db: AsyncSession,
    session: ReportAgentSession,
    user: User,
    message: str,
    tool_calls: list[dict[str, Any]],
) -> list[ReportAgentPendingAction]:
    if not _has_write_intent(message):
        return []
    suggested = next((call for call in tool_calls if call["tool_name"] == "suggest_report_actions"), None)
    payload = {
        "message": message,
        "source_report_id": session.report_id,
        "suggested_actions": (suggested or {}).get("tool_output", {}).get("actions", []),
    }
    action = ReportAgentPendingAction(
        session_id=session.id,
        user_id=user.id,
        action_type="create_task_from_report_action",
        payload_json=payload,
    )
    db.add(action)
    await db.flush()
    await db.refresh(action)
    return [action]


async def _build_answer(
    message: str,
    mode: str,
    context: dict[str, Any],
    snapshot: dict[str, Any],
    memory_summary: str | None,
    tool_calls: list[dict[str, Any]],
) -> str:
    settings = get_settings()
    if settings.llm_api_key:
        try:
            llm_kwargs = {"model": settings.llm_model, "api_key": settings.llm_api_key, "temperature": 0.1}
            if settings.llm_base_url:
                llm_kwargs["base_url"] = settings.llm_base_url
            llm = ChatOpenAI(**llm_kwargs)
            response = await llm.ainvoke(
                [
                    SystemMessage(content=REPORT_AGENT_SYSTEM_PROMPT),
                    HumanMessage(
                        content=json.dumps(
                            {
                                "question": message,
                                "mode": mode,
                                "ui_context": context,
                                "memory_summary": memory_summary,
                                "report_snapshot": snapshot,
                                "tool_outputs": tool_calls,
                            },
                            ensure_ascii=False,
                            default=str,
                        )
                    ),
                ]
            )
            content = str(response.content).strip()
            if content:
                return _append_report_links(content, snapshot)
        except Exception:
            pass
    return _append_report_links(_deterministic_answer(message, mode, snapshot, tool_calls), snapshot)


def _append_report_links(content: str, snapshot: dict[str, Any]) -> str:
    """Append direct report links so chat answers can open the exact report."""
    report_id = snapshot.get("id")
    if report_id:
        url = f"/manager/reports?report={report_id}"
        if url not in content:
            title = snapshot.get("title") or "báo cáo"
            return f"{content}\n\n**Mở báo cáo:** [Xem {title}]({url})"
    recent = snapshot.get("recent_reports")
    if isinstance(recent, list) and recent:
        lines = []
        for item in recent[:3]:
            if isinstance(item, dict) and item.get("id"):
                title = item.get("title") or item["id"]
                lines.append(f"- [Xem {title}](/manager/reports?report={item['id']})")
        if lines and "/manager/reports?report=" not in content:
            return f"{content}\n\n**Báo cáo gần đây:**\n" + "\n".join(lines)
    return content


def _deterministic_answer(message: str, mode: str, snapshot: dict[str, Any], tool_calls: list[dict[str, Any]]) -> str:
    metric_explain = next((call["tool_output"] for call in tool_calls if call["tool_name"] == "explain_report_metric"), None)
    actions = next((call["tool_output"] for call in tool_calls if call["tool_name"] == "suggest_report_actions"), None)
    if metric_explain:
        return (
            f"**Kết luận**\n"
            f"{metric_explain['metric_label']} hiện là `{metric_explain.get('value')}`.\n\n"
            f"**Cách tính**\n{metric_explain['formula']}.\n\n"
            f"**Nguồn dữ liệu**\n{metric_explain['source']}.\n\n"
            f"**Điều cần kiểm tra tiếp**\n{metric_explain['limit']}"
        )
    if actions and actions.get("actions"):
        first = actions["actions"][0]
        return (
            "**Vấn đề**\n"
            f"Report đang có tín hiệu cần chuyển thành hành động: {first['title']}.\n\n"
            "**Mức độ**\n"
            f"{first['severity']}.\n\n"
            "**Hành động đề xuất**\n"
            f"Giao cho vai trò `{first['owner_role']}` kiểm tra và cập nhật kết quả xử lý.\n\n"
            "**Cần xác nhận**\n"
            "Nếu muốn ghi vào hệ thống, hãy xác nhận pending action thay vì để agent tự tạo task."
        )
    if snapshot.get("found"):
        metrics: dict = snapshot.get("metrics") or {}
        lower = message.lower()
        # CLO-specific answer
        if any(w in lower for w in ("clo", "chuẩn đầu ra", "thành phần", "cdr")):
            clo_att: dict = metrics.get("clo_attainment") or {}
            clo_comp: dict = metrics.get("clo_components") or {}
            if clo_att:
                weak = {k: v for k, v in clo_att.items() if v < 70}
                strong = {k: v for k, v in clo_att.items() if v >= 70}
                parts = [
                    f"**Tóm tắt CLO** — {len(clo_att)} chuẩn đầu ra, "
                    f"{len(strong)} đạt ngưỡng ≥70%, **{len(weak)} cần cải thiện**.\n"
                ]
                if weak:
                    parts.append("**CLO chưa đạt:**")
                    for code, pct in sorted(weak.items(), key=lambda x: x[1]):
                        comps = clo_comp.get(code, [])
                        if comps:
                            worst = min(comps, key=lambda c: c["avg_score"] / max(c["max_score"], 1))
                            parts.append(
                                f"- **{code}** ({pct}%): thành phần yếu nhất là "
                                f"\"{worst['component']}\" "
                                f"({worst['avg_score']:.1f}/{worst['max_score']:.0f})"
                            )
                        else:
                            parts.append(f"- **{code}** ({pct}%)")
                if strong:
                    top = sorted(strong.items(), key=lambda x: -x[1])[:3]
                    parts.append("\n**CLO đạt tốt:** " + ", ".join(f"{k} ({v}%)" for k, v in top))
                return "\n".join(parts)
        # PLO-specific answer
        if any(w in lower for w in ("plo", "chương trình", "kiểm định", "ngành")):
            plo_att: dict = metrics.get("plo_attainment") or {}
            if plo_att:
                weak_plo = {k: v for k, v in plo_att.items() if v < 70}
                avg = round(sum(plo_att.values()) / len(plo_att), 1)
                parts = [
                    f"**Tóm tắt PLO** — {len(plo_att)} chuẩn đầu ra chương trình, "
                    f"trung bình đạt **{avg}%**.\n"
                ]
                if weak_plo:
                    parts.append("**PLO chưa đạt 70%:**")
                    for code, pct in sorted(weak_plo.items(), key=lambda x: x[1]):
                        parts.append(f"- **{code}** ({pct}%) — cần rà soát CLO và hoạt động giảng dạy liên quan.")
                else:
                    parts.append("Tất cả PLO đang đạt ngưỡng 70% — chương trình đủ điều kiện theo chuẩn kiểm định.")
                return "\n".join(parts)
        return (
            f"Report `{snapshot.get('title')}` đã được nạp. "
            "Bạn có thể hỏi: giải thích CLO/PLO, phân tích điểm thành phần, "
            "truy vết pass_rate, hoặc đề xuất hành động can thiệp."
        )
    if snapshot.get("recent_reports"):
        count = len(snapshot["recent_reports"])
        return f"Chưa có report cụ thể trong ngữ cảnh. Mình tìm thấy {count} report gần đây; hãy chọn một report để phân tích sâu."
    return "Mình chưa có đủ report context để trả lời chắc chắn. Cần truyền `report_id` hoặc chọn một report trên UI."


def _update_short_summary(previous: str | None, question: str, answer: str) -> str:
    new_line = f"Q: {question[:160]} | A: {answer[:220]}"
    combined = f"{previous}\n{new_line}" if previous else new_line
    return combined[-2000:]


def _infer_report_type(message: str, context: dict[str, Any]) -> str:
    requested = context.get("report_type")
    if isinstance(requested, str) and requested in REPORT_BUILD_DEFAULTS:
        return requested
    normalized = _normalized_text(message)
    if any(word in normalized for word in ("toan truong", "tong quan truong", "ban giam hieu")):
        return "school_overview"
    if any(word in normalized for word in ("khoa", "faculty")):
        return "department_health"
    if any(word in normalized for word in ("nganh", "chuong trinh", "plo")):
        return "program_health"
    if any(word in normalized for word in ("lop", "sinh vien nguy co", "giua ky")):
        return "section_intervention"
    if any(word in normalized for word in ("mon", "hoc phan", "clo")):
        return "course_health"
    scope = context.get("scope") if isinstance(context.get("scope"), dict) else context
    scope_type = scope.get("scope_type")
    by_scope = {
        "school": "school_overview",
        "department": "department_health",
        "program": "program_health",
        "course": "course_health",
        "section": "section_intervention",
    }
    if isinstance(scope_type, str) and scope_type in by_scope:
        return by_scope[scope_type]
    return "program_health"


def _needs_report_discovery(message: str, context: dict[str, Any]) -> bool:
    if context.get("report_type"):
        return False
    scope = context.get("scope") if isinstance(context.get("scope"), dict) else context
    if scope.get("scope_type") or scope.get("scope_id"):
        return False
    normalized = _normalized_text(message)
    intent_terms = ("bao cao", "report")
    if not any(term in normalized for term in intent_terms):
        return False
    specific_terms = (
        "toan truong", "tong quan truong", "ban giam hieu",
        "khoa", "nganh", "chuong trinh", "cntt", "cong nghe thong tin",
        "mon", "hoc phan", "lop", "sinh vien", "canh bao", "nguy co",
        "plo", "clo", "kiem dinh", "ty le truot", "gpa",
    )
    return not any(term in normalized for term in specific_terms)


def _discovery_report_definition(message: str, context: dict[str, Any]) -> dict[str, Any]:
    return {
        "report_type": None,
        "actor_role": "manager",
        "scope_type": None,
        "scope_id": None,
        "scope_hint": None,
        "semester_id": None,
        "period_start": None,
        "period_end": None,
        "assessment_stage": _infer_assessment_stage(message),
        "output_format": "link",
        "template_label": "Chưa chọn loại báo cáo",
        "base_design": None,
        "outline": [],
        "visuals": [],
        "custom_request": context.get("custom_request"),
        "audience": None,
        "purpose": None,
        "decision": None,
        "comparison": None,
        "is_custom": True,
        "source": context.get("source", "global_chat"),
    }


def _build_report_discovery_question() -> str:
    return (
        "Mình có thể giúp bạn xây báo cáo, nhưng hiện yêu cầu còn quá rộng nên chưa thể chọn đúng tool và filter.\n\n"
        "Bạn chọn hoặc mô tả giúp tôi 5 ý sau:\n"
        "- Loại báo cáo: tổng quan trường, sức khỏe khoa, sức khỏe ngành, sức khỏe môn học, can thiệp lớp học phần, sinh viên nguy cơ, hoặc báo cáo tùy chỉnh.\n"
        "- Phạm vi: toàn trường, khoa/ngành/môn/lớp nào, hoặc nhóm sinh viên nào.\n"
        "- Thời gian: học kỳ hiện tại, một học kỳ cụ thể, năm học, hoặc khoảng ngày.\n"
        "- Mục tiêu sử dụng: họp quản lý, cảnh báo học vụ, cải thiện môn học, kiểm định/minh chứng, hay so sánh chất lượng.\n"
        "- Bộ lọc: chỉ SV nguy cơ, môn tỷ lệ trượt cao, điểm thiếu, khóa/ngành cụ thể, hoặc không lọc đặc biệt.\n\n"
        "Ví dụ: Tạo báo cáo tổng quan trường học kỳ 2025-2 để họp quản lý, tập trung GPA, tỷ lệ trượt và SV nguy cơ."
    )


def _normalized_text(value: str) -> str:
    replacements = {
        "à": "a", "á": "a", "ạ": "a", "ả": "a", "ã": "a",
        "â": "a", "ầ": "a", "ấ": "a", "ậ": "a", "ẩ": "a", "ẫ": "a",
        "ă": "a", "ằ": "a", "ắ": "a", "ặ": "a", "ẳ": "a", "ẵ": "a",
        "è": "e", "é": "e", "ẹ": "e", "ẻ": "e", "ẽ": "e",
        "ê": "e", "ề": "e", "ế": "e", "ệ": "e", "ể": "e", "ễ": "e",
        "ì": "i", "í": "i", "ị": "i", "ỉ": "i", "ĩ": "i",
        "ò": "o", "ó": "o", "ọ": "o", "ỏ": "o", "õ": "o",
        "ô": "o", "ồ": "o", "ố": "o", "ộ": "o", "ổ": "o", "ỗ": "o",
        "ơ": "o", "ờ": "o", "ớ": "o", "ợ": "o", "ở": "o", "ỡ": "o",
        "ù": "u", "ú": "u", "ụ": "u", "ủ": "u", "ũ": "u",
        "ư": "u", "ừ": "u", "ứ": "u", "ự": "u", "ử": "u", "ữ": "u",
        "ỳ": "y", "ý": "y", "ỵ": "y", "ỷ": "y", "ỹ": "y",
        "đ": "d",
    }
    lower = value.lower()
    return "".join(replacements.get(char, char) for char in lower)


def _extract_report_brief(message: str, context: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalized_text(message)
    brief = context.get("brief") if isinstance(context.get("brief"), dict) else {}
    purpose = brief.get("purpose") or context.get("purpose")
    audience = brief.get("audience") or context.get("audience")
    decision = brief.get("decision") or context.get("decision")
    comparison = brief.get("comparison") or context.get("comparison")

    if not purpose:
        if any(word in normalized for word in ("canh bao", "nguy co", "can thiep", "hoc vu")):
            purpose = "Cảnh báo học vụ và ưu tiên can thiệp"
        elif any(word in normalized for word in ("kiem dinh", "minh chung", "plo", "clo")):
            purpose = "Minh chứng đảm bảo chất lượng/kiểm định"
        elif any(word in normalized for word in ("hop", "ban giam hieu", "quan ly", "tong quan")):
            purpose = "Họp quản lý và theo dõi chất lượng đào tạo"
        elif any(word in normalized for word in ("cai thien", "mon yeu", "ty le truot", "diem thap")):
            purpose = "Cải thiện môn học và giảm rủi ro kết quả"

    if not audience:
        if any(word in normalized for word in ("ban giam hieu", "bgh", "lanh dao")):
            audience = "Ban giám hiệu/lãnh đạo"
        elif any(word in normalized for word in ("truong khoa", "khoa")):
            audience = "Trưởng khoa"
        elif any(word in normalized for word in ("truong nganh", "nganh")):
            audience = "Trưởng ngành"
        elif any(word in normalized for word in ("giang vien", "lop hoc phan")):
            audience = "Giảng viên phụ trách"

    if not comparison:
        if any(word in normalized for word in ("so sanh", "ky truoc", "cung ky", "benchmark", "muc tieu")):
            comparison = "So sánh theo kỳ hoặc mốc mục tiêu do người dùng yêu cầu"

    return {
        "purpose": purpose,
        "audience": audience,
        "decision": decision,
        "comparison": comparison,
    }


def _extract_scope_hint(message: str, context: dict[str, Any]) -> str | None:
    normalized = _normalized_text(message)
    if "cntt" in normalized or "cong nghe thong tin" in normalized:
        return "Công nghệ thông tin"
    if "toan truong" in normalized or "tong quan truong" in normalized or "ban giam hieu" in normalized:
        return "Toàn trường"

    scope = context.get("scope") if isinstance(context.get("scope"), dict) else context
    for key in ("scope_label", "scope_name", "program_name", "department_name", "course_name", "section_name"):
        value = scope.get(key) or context.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    markers = (
        ("nganh ", "ngành"),
        ("khoa ", "khoa"),
        ("mon ", "môn học"),
        ("hoc phan ", "môn học"),
        ("lop ", "lớp học phần"),
    )
    for marker, label in markers:
        index = normalized.find(marker)
        if index >= 0:
            raw_tail = message[index + len(marker):].strip(" .,:;!?")
            if raw_tail:
                return f"{label} {raw_tail[:80]}"
    return None


def _message_has_period(message: str, context: dict[str, Any]) -> bool:
    if (
        context.get("semester_id")
        or context.get("period")
        or context.get("period_start")
        or context.get("period_end")
        or context.get("period_label")
    ):
        return True
    normalized = _normalized_text(message)
    return any(
        token in normalized
        for token in (
            "hoc ky", "hk", "nam hoc", "ky nay", "ky hien tai", "ky truoc",
            "2020", "2021", "2022", "2023", "2024", "2025", "2026",
            "thang", "quy", "tu ngay", "den ngay",
        )
    )


def _missing_report_brief_fields(definition: dict[str, Any], message: str, context: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if definition["scope_type"] != "school" and not definition.get("scope_id"):
        missing.append("scope_id")
    if not _message_has_period(message, context):
        missing.append("period")
    if not definition.get("purpose"):
        missing.append("purpose")
    return missing


def _build_report_brief_question(definition: dict[str, Any], missing_fields: list[str]) -> str:
    scope_label = {
        "department": "khoa",
        "program": "ngành",
        "course": "môn học",
        "section": "lớp học phần",
    }.get(str(definition.get("scope_type") or ""), "phạm vi")
    period_label = "Theo kỳ hiện tại" if definition.get("semester_id") else "Chưa xác định"
    if definition.get("period_start") or definition.get("period_end"):
        period_label = f"{definition.get('period_start') or '?'} đến {definition.get('period_end') or '?'}"
    if "period" in missing_fields:
        period_label = "Chưa chốt; có thể dùng kỳ hiện tại nếu bạn xác nhận"
    understood = [
        f"Loại báo cáo: {definition.get('template_label') or definition.get('base_design') or definition.get('report_type')}",
        f"Phạm vi: {definition.get('scope_hint') or definition.get('scope_id') or 'Chưa xác định'}",
        f"Thời gian: {period_label}",
        f"Mục tiêu: {definition.get('purpose') or 'Chưa xác định'}",
    ]
    questions = []
    if "scope_id" in missing_fields:
        if definition.get("scope_hint"):
            questions.append(f"xác nhận đúng {scope_label} '{definition['scope_hint']}' và mã/id nếu bạn biết")
        else:
            questions.append(f"phạm vi chính xác: {scope_label} nào, mã/tên cụ thể là gì")
    if "period" in missing_fields:
        questions.append("thời gian: học kỳ, năm học hoặc khoảng ngày nào")
    if "purpose" in missing_fields:
        questions.append("mục tiêu: họp quản lý, cảnh báo học vụ, cải thiện môn học, kiểm định hay so sánh chất lượng")
    joined = "; ".join(questions)
    understood_text = "\n".join(f"- {item}" for item in understood)
    return (
        "Tôi đã nhận diện đây là yêu cầu tạo báo cáo.\n\n"
        f"Ngữ cảnh tôi đang hiểu:\n{understood_text}\n\n"
        "Phần còn thiếu để gọi tool đúng:\n"
        f"- {joined}\n\n"
        "Bạn chỉ cần trả lời các ý còn thiếu. Tôi sẽ giữ lại ngữ cảnh đã hiểu và cập nhật brief ở lượt tiếp theo."
    )


def _as_optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_optional_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _infer_assessment_stage(message: str) -> str:
    normalized = message.lower()
    if "giữa kỳ" in normalized or "giua ky" in normalized or "midterm" in normalized:
        return "midterm_requested"
    if "cuối kỳ" in normalized or "cuoi ky" in normalized or "final" in normalized:
        return "final_requested"
    return "available_results"


def _session_title(mode: str, report_id: str | None) -> str:
    suffix = f" {report_id[:8]}" if report_id else ""
    return f"Report Agent - {mode}{suffix}"


def _extract_metric_key(message: str) -> str | None:
    lower = message.lower()
    for key in (
        "pass_rate", "avg_gpa", "at_risk_students", "risk_level",
        "watchlist_count", "completed_enrollments",
        "clo_attainment", "plo_attainment", "weak_clo_count",
    ):
        if key in lower:
            return key
    aliases = {
        "tỷ lệ đạt": "pass_rate",
        "ti le dat": "pass_rate",
        "gpa": "avg_gpa",
        "nguy cơ": "at_risk_students",
        "mức rủi ro": "risk_level",
        "can thiệp": "watchlist_count",
        "clo": "clo_attainment",
        "plo": "plo_attainment",
        "chuẩn đầu ra": "clo_attainment",
        "cdr": "clo_attainment",
        "chương trình": "plo_attainment",
        "kiểm định": "plo_attainment",
        "điểm thành phần": "clo_components",
        "thành phần": "clo_components",
    }
    return next((value for key, value in aliases.items() if key in lower), None)


def _wants_metric_explanation(message: str, context: dict[str, Any]) -> bool:
    lower = message.lower()
    return bool(context.get("metric_key")) or any(
        word in lower for word in (
            "chỉ số", "công thức", "tính", "giải thích", "metric",
            "clo", "plo", "chuẩn đầu ra", "thành phần", "kiểm định",
        )
    )


def _wants_trace(message: str) -> bool:
    lower = message.lower()
    return any(word in lower for word in ("truy vết", "nguồn", "từ đâu", "trace", "dữ liệu nào"))


def _wants_action(message: str) -> bool:
    lower = message.lower()
    return any(word in lower for word in ("hành động", "đề xuất", "task", "can thiệp", "làm gì"))


def _has_write_intent(message: str) -> bool:
    lower = message.lower()
    return any(word in lower for word in WRITE_INTENT_WORDS)


def _wants_trend(message: str) -> bool:
    lower = message.lower()
    return any(word in lower for word in (
        "xu hướng", "xu huong", "trend", "qua các kỳ", "qua cac ky",
        "nhiều kỳ", "nhieu ky", "lịch sử", "lich su", "thay đổi",
        "thay doi", "giảm", "tăng", "so sánh kỳ", "so sanh ky",
        "kỳ trước", "ky truoc", "kỳ trước đó",
    ))

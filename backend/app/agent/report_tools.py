"""Deterministic tools used by the Report Agent."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report


@dataclass(frozen=True)
class ReportAgentToolSpec:
    """Metadata for one report-agent tool."""

    name: str
    description: str
    mode: tuple[str, ...]
    requires_confirmation: bool = False
    write_action: bool = False


TOOL_REGISTRY: tuple[ReportAgentToolSpec, ...] = (
    ReportAgentToolSpec(
        name="get_report_snapshot",
        description="Load report metadata, summary, markdown, and metric snapshot.",
        mode=("explain", "root_cause", "narrative", "action_planning", "workflow", "compare"),
    ),
    ReportAgentToolSpec(
        name="get_historical_trend",
        description="Pull pass_rate trend across past reports of the same scope to support multi-semester analysis.",
        mode=("explain", "root_cause", "compare"),
    ),
    ReportAgentToolSpec(
        name="explain_report_metric",
        description="Explain a metric value, formula, source fields, and interpretation limits.",
        mode=("explain", "root_cause"),
    ),
    ReportAgentToolSpec(
        name="trace_report_metric",
        description="Trace which report fields and source tables contribute to a metric.",
        mode=("explain", "root_cause", "compare"),
    ),
    ReportAgentToolSpec(
        name="suggest_report_actions",
        description="Convert report issues and risks into candidate action items.",
        mode=("action_planning", "workflow"),
    ),
    ReportAgentToolSpec(
        name="create_task_from_report_action",
        description="Create a workflow task from an approved report action.",
        mode=("action_planning", "workflow"),
        requires_confirmation=True,
        write_action=True,
    ),
    ReportAgentToolSpec(
        name="schedule_report",
        description="Schedule a recurring report for stakeholders.",
        mode=("workflow",),
        requires_confirmation=True,
        write_action=True,
    ),
    ReportAgentToolSpec(
        name="send_report",
        description="Send a finalized report to selected stakeholders.",
        mode=("workflow",),
        requires_confirmation=True,
        write_action=True,
    ),
)


METRIC_DEFINITIONS: dict[str, dict[str, str]] = {
    "pass_rate": {
        "label": "Tỷ lệ đạt",
        "formula": "passed_enrollments / completed_enrollments * 100",
        "source": "enrollments.is_passed sau khi lớp/học phần đã có kết quả",
        "limit": "Dễ đẹp giả nếu số lượt hoàn tất ít hoặc chưa lọc đúng kỳ/khoa/ngành.",
    },
    "avg_gpa": {
        "label": "GPA trung bình",
        "formula": "Trung bình gpa_cumulative của sinh viên active có GPA",
        "source": "students.gpa_cumulative",
        "limit": "Không phản ánh riêng một môn hoặc một CLO; cần tách theo khóa/ngành khi phân tích sâu.",
    },
    "at_risk_students": {
        "label": "Sinh viên nguy cơ",
        "formula": "Số sinh viên active có GPA dưới ngưỡng rủi ro hiện tại",
        "source": "students.status, students.gpa_cumulative",
        "limit": "Chỉ là ngưỡng học vụ; chưa bao gồm vắng học, nợ học phí, tương tác LMS nếu chưa có dữ liệu.",
    },
    "risk_level": {
        "label": "Mức rủi ro",
        "formula": "Luật phân tầng từ pass_rate, at_risk_students và/hoặc avg_grade",
        "source": "metrics đã tính trong report payload",
        "limit": "Là rule-based, cần hiệu chỉnh theo chính sách nhà trường.",
    },
    "watchlist_count": {
        "label": "Số sinh viên cần can thiệp",
        "formula": "Số sinh viên trong watchlist của lớp/học phần",
        "source": "enrollments.final_grade, enrollments.is_passed",
        "limit": "Phụ thuộc dữ liệu điểm đã nhập; giữa kỳ có thể thấp hơn thực tế.",
    },
    "completed_enrollments": {
        "label": "Lượt học phần hoàn tất",
        "formula": "Số enrollment có is_passed khác null",
        "source": "enrollments.is_passed",
        "limit": "Không phải tổng số đăng ký học nếu còn lớp chưa chốt điểm.",
    },
    "clo_attainment": {
        "label": "Tỷ lệ đạt CLO",
        "formula": (
            "Với mỗi CLO: tính điểm CLO của từng sinh viên = "
            "Σ(điểm thành phần × trọng số ánh xạ × trọng số thành phần) / Σ(trọng số). "
            "Tỷ lệ đạt = % sinh viên có điểm CLO ≥ 4.0."
        ),
        "source": "grade_components × grade_component_clo_mappings × grade_component_types → clos",
        "limit": (
            "Cần đủ dữ liệu grade_component_clo_mappings. "
            "Nếu giảng viên chưa gán thành phần vào CLO, kết quả sẽ rỗng hoặc lệch."
        ),
    },
    "clo_components": {
        "label": "Điểm thành phần theo CLO",
        "formula": "Điểm trung bình của từng thành phần đánh giá (chuyên cần, giữa kỳ, cuối kỳ) theo từng CLO.",
        "source": "grade_components → grade_component_types → grade_component_clo_mappings → clos",
        "limit": "Phản ánh điểm bình quân cả lớp; cần nhìn phân phối để phát hiện nhóm sinh viên cụ thể yếu.",
    },
    "plo_attainment": {
        "label": "Tỷ lệ đạt PLO",
        "formula": (
            "Với mỗi PLO: tổng hợp tỷ lệ đạt CLO có ánh xạ vào PLO, "
            "có trọng số theo mức đóng góp (1=Introduced, 2=Developed, 3=Assessed). "
            "weighted_attainment = Σ(CLO_attainment × contribution) / Σ(contribution)."
        ),
        "source": "clo_attainment (đã tính) × clo_plo_mappings × plos",
        "limit": (
            "Phụ thuộc chất lượng ma trận CLO→PLO. "
            "Cần kiểm tra clo_plo_mappings đã được ban khoa điền đúng chưa. "
            "PLO đạt cao chưa chắc chương trình tốt nếu CLO mapping không phủ đủ."
        ),
    },
    "weak_clo_count": {
        "label": "Số CLO chưa đạt ngưỡng",
        "formula": "Số CLO có tỷ lệ đạt < 70%.",
        "source": "clo_attainment đã tính",
        "limit": "Ngưỡng 70% là chuẩn tham chiếu; từng trường có thể đặt khác trong chính sách đảm bảo chất lượng.",
    },
}


async def get_report_snapshot(db: AsyncSession, report_id: str) -> dict[str, Any]:
    """Return a compact report snapshot for agent grounding."""
    report = await db.get(Report, report_id)
    if report is None:
        return {"found": False, "error": "Report not found", "report_id": report_id}
    return {
        "found": True,
        "id": report.id,
        "report_type": report.report_type,
        "actor_role": report.actor_role,
        "scope_type": report.scope_type,
        "scope_id": report.scope_id,
        "title": report.title,
        "summary": report.summary,
        "status": report.status,
        "metrics": report.metrics_json,
        "content_markdown": report.content_markdown[:6000],
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


def explain_report_metric(snapshot: dict[str, Any], metric_key: str | None) -> dict[str, Any]:
    """Explain one report metric from the snapshot."""
    metrics = snapshot.get("metrics") or {}
    selected_key = metric_key or _guess_primary_metric(metrics)
    definition = METRIC_DEFINITIONS.get(selected_key or "", {})
    value = metrics.get(selected_key) if selected_key else None
    return {
        "metric_key": selected_key,
        "metric_label": definition.get("label", selected_key or "unknown"),
        "value": value,
        "formula": definition.get("formula", "Chưa có công thức chuẩn hóa cho metric này."),
        "source": definition.get("source", "metrics_json của report hiện tại."),
        "limit": definition.get("limit", "Cần kiểm tra scope, kỳ học và độ đầy đủ dữ liệu trước khi kết luận."),
        "available_metrics": sorted(metrics.keys()),
    }


def trace_report_metric(snapshot: dict[str, Any], metric_key: str | None) -> dict[str, Any]:
    """Return traceability details for one metric."""
    explanation = explain_report_metric(snapshot, metric_key)
    return {
        **explanation,
        "report_id": snapshot.get("id"),
        "report_type": snapshot.get("report_type"),
        "scope": {
            "scope_type": snapshot.get("scope_type"),
            "scope_id": snapshot.get("scope_id"),
        },
        "trace_status": "defined" if explanation["metric_key"] in METRIC_DEFINITIONS else "generic",
    }


def suggest_report_actions(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Extract deterministic candidate actions from report metrics."""
    metrics = snapshot.get("metrics") or {}
    actions = metrics.get("actions") or []
    issues = metrics.get("issues") or []
    risks = metrics.get("risks") or []
    candidates = []
    for index, action in enumerate(actions[:5], start=1):
        candidates.append(
            {
                "title": action,
                "severity": _infer_severity(risks, issues),
                "owner_role": _infer_owner(snapshot),
                "evidence": {
                    "report_id": snapshot.get("id"),
                    "issue": issues[index - 1] if index - 1 < len(issues) else None,
                    "risk": risks[0] if risks else None,
                },
            }
        )
    return {"actions": candidates, "source_report_id": snapshot.get("id")}


async def get_historical_trend(
    db: AsyncSession,
    report_type: str,
    scope_id: str | None,
    limit: int = 8,
) -> dict[str, Any]:
    """Pull pass_rate + avg_gpa trend từ các báo cáo cùng scope, sắp xếp theo thứ tự thời gian.

    Dùng để agent trả lời câu hỏi xu hướng nhiều kỳ:
    'pass_rate thay đổi như thế nào?', 'kỳ nào đang giảm?'.
    """
    result = await db.execute(
        select(Report)
        .where(
            Report.report_type == report_type,
            Report.scope_id == scope_id,
            Report.status.in_(["generated", "final", "ready"]),
        )
        .order_by(Report.created_at.desc())
        .limit(limit)
    )
    reports = list(result.scalars().all())
    trend: list[dict[str, Any]] = []
    for r in reversed(reports):
        m = r.metrics_json or {}
        pr = m.get("pass_rate")
        if pr is None:
            continue
        trend.append(
            {
                "semester": m.get("semester_name") or (r.created_at.strftime("%m/%Y") if r.created_at else ""),
                "pass_rate": float(pr),
                "avg_gpa": float(m["avg_gpa"]) if m.get("avg_gpa") is not None else None,
                "risk_level": m.get("risk_level"),
                "report_id": r.id,
            }
        )

    if not trend:
        return {
            "found": False,
            "message": "Chưa đủ báo cáo lịch sử để vẽ xu hướng. Cần ít nhất 2 báo cáo cùng phạm vi.",
            "report_type": report_type,
            "scope_id": scope_id,
        }

    latest = trend[-1]
    oldest = trend[0]
    delta = round(latest["pass_rate"] - oldest["pass_rate"], 1)
    direction = "tăng" if delta > 0 else "giảm" if delta < 0 else "ổn định"

    return {
        "found": True,
        "report_type": report_type,
        "scope_id": scope_id,
        "data_points": len(trend),
        "trend": trend,
        "summary": (
            f"Từ {oldest['semester']} đến {latest['semester']}: "
            f"pass_rate {direction} {abs(delta)}% "
            f"({oldest['pass_rate']}% → {latest['pass_rate']}%)."
        ),
        "latest_pass_rate": latest["pass_rate"],
        "oldest_pass_rate": oldest["pass_rate"],
        "delta": delta,
        "direction": direction,
    }


async def list_recent_reports(db: AsyncSession, limit: int = 10) -> list[dict[str, Any]]:
    """List recent reports for grounding when no report_id is selected."""
    result = await db.execute(select(Report).order_by(Report.created_at.desc()).limit(limit))
    reports = result.scalars().all()
    return [
        {
            "id": item.id,
            "title": item.title,
            "report_type": item.report_type,
            "scope_type": item.scope_type,
            "scope_id": item.scope_id,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in reports
    ]


def _guess_primary_metric(metrics: dict[str, Any]) -> str | None:
    for key in ("pass_rate", "risk_level", "at_risk_students", "avg_gpa", "watchlist_count"):
        if key in metrics:
            return key
    return next(iter(metrics.keys()), None)


def _infer_severity(risks: list[str], issues: list[str]) -> str:
    text = " ".join([*risks, *issues]).lower()
    if "cao" in text or "dưới 70" in text or "nguy cơ" in text:
        return "high"
    if "trung bình" in text or "cần" in text:
        return "medium"
    return "low"


def _infer_owner(snapshot: dict[str, Any]) -> str:
    scope_type = snapshot.get("scope_type")
    if scope_type == "section":
        return "lecturer"
    if scope_type == "program":
        return "manager"
    return "admin"

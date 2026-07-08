"""Report generation service with deterministic analytics and optional LLM polish.

The numbers are always computed from the database first. If an LLM key is configured,
the model may rewrite the narrative from those facts, but it must not invent metrics.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.academic import Course, Department, Program, Semester
from app.models.people import Student, Teacher
from app.models.report import Report
from app.models.teaching import Enrollment, Section

logger = logging.getLogger(__name__)

ReportPayload = dict[str, Any]

# T32 — Course-improvement thresholds (kept consistent with analytics.health_score).
CLO_ACHIEVED_THRESHOLD = 4.0  # average CLO score counted as "achieved"
WEAK_CLO_THRESHOLD_PCT = 70.0  # CLO attainment below this needs an improvement action

# Per-CLO attainment for one course. Uses AVG(CASE ...) instead of ::float casts so it
# stays portable; callers wrap this in try/except because grade-component data may be absent.
_CLO_BREAKDOWN_SQL = text(
    """
    WITH clo_scores AS (
        SELECT
            e.id AS enrollment_id,
            cl.code AS clo_code,
            cl.name AS clo_name,
            SUM(gc.score * gccm.weight * gct.weight)
                / NULLIF(SUM(gccm.weight * gct.weight), 0) AS score
        FROM enrollments e
        JOIN sections sec ON e.section_id = sec.id
        JOIN grade_components gc ON gc.enrollment_id = e.id
        JOIN grade_component_types gct ON gc.component_type_id = gct.id
        JOIN grade_component_clo_mappings gccm ON gct.id = gccm.component_type_id
        JOIN clos cl ON gccm.clo_id = cl.id
        WHERE sec.course_id = :course_id AND e.status = 'completed'
        GROUP BY e.id, cl.code, cl.name
    )
    SELECT
        clo_code,
        clo_name,
        COUNT(*) AS sample,
        AVG(score) AS avg_score,
        AVG(CASE WHEN score >= :threshold THEN 1.0 ELSE 0.0 END) AS attainment_rate
    FROM clo_scores
    GROUP BY clo_code, clo_name
    ORDER BY clo_code
    """
)

# Per-CLO component breakdown for a specific section — shows which grade components
# feed each CLO, their average scores, and weights so we can pinpoint weak components.
_CLO_COMPONENT_SQL = text(
    """
    SELECT
        cl.code                                               AS clo_code,
        cl.name                                               AS clo_name,
        gct.name                                              AS component_name,
        ROUND(CAST(gct.weight        AS numeric), 4)          AS component_weight,
        ROUND(CAST(gccm.weight       AS numeric), 4)          AS clo_contribution,
        ROUND(CAST(AVG(gc.score)     AS numeric), 2)          AS avg_score,
        MAX(gc.max_score)                                     AS max_score,
        COUNT(gc.id)                                          AS sample_count
    FROM clos cl
    JOIN grade_component_clo_mappings gccm ON gccm.clo_id            = cl.id
    JOIN grade_component_types gct         ON gccm.component_type_id = gct.id
    JOIN grade_components gc               ON gc.component_type_id   = gct.id
    JOIN enrollments e                     ON gc.enrollment_id        = e.id
    WHERE e.section_id = :section_id
      AND e.status = 'completed'
    GROUP BY cl.code, cl.name, gct.name, gct.weight, gccm.weight
    ORDER BY cl.code, gct.weight DESC
    """
)

# Weighted PLO attainment for a program, aggregated via CLO → PLO contribution matrix.
_PLO_ATTAINMENT_SQL = text(
    """
    WITH ecs AS (
        SELECT
            e.id  AS enrollment_id,
            cl.id AS clo_id,
            SUM(gc.score * gccm.weight * gct.weight)
                / NULLIF(SUM(gccm.weight * gct.weight), 0) AS score
        FROM enrollments e
        JOIN sections sec                      ON e.section_id         = sec.id
        JOIN program_courses pc                ON pc.course_id          = sec.course_id
        JOIN grade_components gc               ON gc.enrollment_id      = e.id
        JOIN grade_component_types gct         ON gc.component_type_id  = gct.id
        JOIN grade_component_clo_mappings gccm ON gct.id                = gccm.component_type_id
        JOIN clos cl                           ON gccm.clo_id           = cl.id
        WHERE pc.program_id = :program_id AND e.status = 'completed'
        GROUP BY e.id, cl.id
    ),
    clo_att AS (
        SELECT
            clo_id,
            AVG(CASE WHEN score >= :threshold THEN 1.0 ELSE 0.0 END) AS attainment_rate
        FROM ecs
        GROUP BY clo_id
    ),
    plo_agg AS (
        SELECT
            p.id                                                          AS plo_id,
            p.code                                                        AS plo_code,
            p.name                                                        AS plo_name,
            COUNT(DISTINCT ca.clo_id)                                     AS clo_count,
            ROUND(CAST(
                SUM(ca.attainment_rate * cpm.contribution)
                    / NULLIF(SUM(cpm.contribution)::float, 0)
            AS numeric), 3)                                               AS weighted_attainment
        FROM plos p
        JOIN clo_plo_mappings cpm ON cpm.plo_id = p.id
        JOIN clo_att ca           ON ca.clo_id  = cpm.clo_id
        WHERE p.program_id = :program_id
        GROUP BY p.id, p.code, p.name
    )
    SELECT * FROM plo_agg ORDER BY plo_code
    """
)


async def _fetch_clo_breakdown(db: AsyncSession, course_id: int) -> list[dict[str, Any]]:
    """Fetch per-CLO attainment rows for a course (raw, may be empty)."""
    result = await db.execute(_CLO_BREAKDOWN_SQL, {"course_id": course_id, "threshold": CLO_ACHIEVED_THRESHOLD})
    return [dict(row) for row in result.mappings().all()]


async def _fetch_clo_components(db: AsyncSession, section_id: int) -> list[dict[str, Any]]:
    """Fetch component-level CLO detail for a section — which grade components feed each CLO."""
    result = await db.execute(_CLO_COMPONENT_SQL, {"section_id": section_id})
    return [dict(row) for row in result.mappings().all()]


async def _fetch_plo_attainment(db: AsyncSession, program_id: int) -> list[dict[str, Any]]:
    """Weighted PLO attainment for a program, aggregated from CLO attainment via contribution matrix."""
    result = await db.execute(_PLO_ATTAINMENT_SQL, {"program_id": program_id, "threshold": CLO_ACHIEVED_THRESHOLD})
    return [dict(row) for row in result.mappings().all()]


def _build_clo_enrichment(
    rows: list[dict[str, Any]],
    component_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Pure transform: per-CLO rows + component detail → attainment map + improvement suggestions.

    Returns {} when there is no usable CLO data so the report degrades gracefully.
    """
    clo_attainment: dict[str, float] = {}
    weak: list[dict[str, Any]] = []
    for row in rows:
        code = str(row.get("clo_code") or "").strip()
        if not code:
            continue
        rate = row.get("attainment_rate")
        pct = round(float(rate) * 100, 1) if rate is not None else 0.0
        clo_attainment[code] = pct
        if pct < WEAK_CLO_THRESHOLD_PCT:
            weak.append({"code": code, "name": str(row.get("clo_name") or ""), "attainment": pct})
    if not clo_attainment:
        return {}
    weak.sort(key=lambda item: item["attainment"])

    # Build per-CLO component detail for diagnostic narratives.
    clo_components: dict[str, list[dict[str, Any]]] = {}
    for row in component_rows or []:
        code = str(row.get("clo_code") or "").strip()
        if not code:
            continue
        clo_components.setdefault(code, []).append(
            {
                "component": str(row.get("component_name") or ""),
                "avg_score": float(row.get("avg_score") or 0),
                "max_score": float(row.get("max_score") or 10),
                "component_weight": float(row.get("component_weight") or 0),
                "clo_contribution": float(row.get("clo_contribution") or 0),
            }
        )

    improvement_issues = [
        f"{item['code']} chỉ đạt {item['attainment']}% (dưới ngưỡng {WEAK_CLO_THRESHOLD_PCT:.0f}%)." for item in weak
    ]
    improvement_actions = []
    for item in weak:
        comps = clo_components.get(item["code"], [])
        worst_comp = min(comps, key=lambda c: c["avg_score"] / max(c["max_score"], 1)) if comps else None
        detail = ""
        if worst_comp:
            pct = worst_comp["avg_score"] / max(worst_comp["max_score"], 1) * 100
            detail = f' Thành phần yếu nhất: "{worst_comp["component"]}" ({worst_comp["avg_score"]:.1f}/{worst_comp["max_score"]:.0f} = {pct:.0f}%).'
        improvement_actions.append(
            f"Cải thiện {item['code']}"
            + (f" ({item['name']})" if item["name"] else "")
            + f": đạt {item['attainment']}%, cần rà rubric và đề bài.{detail}"
        )
    return {
        "clo_attainment": clo_attainment,
        "clo_components": clo_components,
        "weak_clos": weak,
        "improvement_issues": improvement_issues,
        "improvement_actions": improvement_actions,
    }


def _apply_clo_enrichment(payload: ReportPayload, enrichment: dict[str, Any], detail_href: str | None = None) -> ReportPayload:
    """Merge CLO attainment + component detail + improvement suggestions into a section report."""
    metrics = {**payload["metrics_json"]}
    metrics["clo_attainment"] = enrichment["clo_attainment"]
    metrics["clo_components"] = enrichment.get("clo_components", {})
    metrics["weak_clo_count"] = len(enrichment["weak_clos"])
    weak_clos_with_links = [
        {**item, "href": detail_href} if detail_href else dict(item)
        for item in enrichment["weak_clos"]
    ]
    metrics["weak_clos"] = weak_clos_with_links
    metrics["issues"] = enrichment["improvement_issues"] + list(metrics.get("issues") or [])
    metrics["actions"] = enrichment["improvement_actions"] + list(metrics.get("actions") or [])
    payload["metrics_json"] = metrics
    clo_section = _format_clo_section({**enrichment, "weak_clos": weak_clos_with_links})
    if clo_section:
        payload["content_markdown"] = payload["content_markdown"] + "\n\n" + clo_section
    return payload


def _format_clo_section(enrichment: dict[str, Any]) -> str:
    """Render per-CLO attainment + component breakdown as a markdown section."""
    clo_attainment: dict[str, float] = enrichment.get("clo_attainment", {})
    clo_components: dict[str, list[dict[str, Any]]] = enrichment.get("clo_components", {})
    weak_clos: list[dict[str, Any]] = enrichment.get("weak_clos", [])
    if not clo_attainment:
        return ""
    lines: list[str] = ["## Chi tiết chuẩn đầu ra (CLO)", ""]
    lines += ["### Tỷ lệ đạt theo CLO", "", "| CLO | Tỷ lệ đạt | Đánh giá |", "|-----|-----------|----------|"]
    for code, pct in clo_attainment.items():
        tag = "✅ Đạt" if pct >= WEAK_CLO_THRESHOLD_PCT else "⚠️ Cần cải thiện"
        lines.append(f"| {code} | {pct}% | {tag} |")
    lines.append("")
    if weak_clos:
        lines.append("### Phân tích CLO chưa đạt ngưỡng")
        lines.append("")
        for item in weak_clos:
            code = item["code"]
            name = item.get("name", "")
            pct = item["attainment"]
            gap = WEAK_CLO_THRESHOLD_PCT - pct
            label = f"{code}{f' — {name}' if name else ''}"
            href = item.get("href")
            target = f"[{label}]({href})" if href else f"**{label}**"
            lines.append(
                f"{target}: chỉ có **{pct}%** sinh viên đạt chuẩn "
                f"(thiếu {gap:.0f}% so với ngưỡng {WEAK_CLO_THRESHOLD_PCT:.0f}%)."
            )
            comps = clo_components.get(code, [])
            if comps:
                lines += [
                    "",
                    "Điểm thành phần đóng góp vào CLO này:",
                    "",
                    "| Thành phần | Điểm TB / Tối đa | % đạt | Trọng số |",
                    "|------------|-----------------|-------|----------|",
                ]
                for comp in comps:
                    avg = comp["avg_score"]
                    mx = comp["max_score"]
                    pct_comp = round(avg / max(mx, 1) * 100, 0)
                    w = comp["component_weight"]
                    lines.append(f"| {comp['component']} | {avg:.1f} / {mx:.0f} | {pct_comp:.0f}% | {w * 100:.0f}% |")
                worst = min(comps, key=lambda c: c["avg_score"] / max(c["max_score"], 1))
                worst_pct = worst["avg_score"] / max(worst["max_score"], 1) * 100
                lines += [
                    "",
                    f'> **Điểm can thiệp**: Thành phần "*{worst["component"]}*" có tỷ lệ điểm thấp nhất '
                    f"({worst['avg_score']:.1f}/{worst['max_score']:.0f} = {worst_pct:.0f}%). "
                    "Cần rà lại đề, rubric và hoạt động ôn tập bám sát chuẩn này.",
                ]
            lines.append("")
    return _join_lines(lines)


def _format_plo_section(plo_rows: list[dict[str, Any]]) -> str:
    """Render PLO attainment table + narrative as a markdown section."""
    if not plo_rows:
        return ""
    _WEAK_PLO = 0.70
    lines: list[str] = ["## Tổng hợp chuẩn đầu ra chương trình (PLO)", ""]
    lines += [
        "| PLO | Tên | CLO đóng góp | Tỷ lệ đạt (có trọng số) | Đánh giá |",
        "|-----|-----|-------------|------------------------|----------|",
    ]
    weak_plos: list[dict[str, Any]] = []
    for row in plo_rows:
        code = str(row.get("plo_code") or "")
        name = str(row.get("plo_name") or "")
        clo_count = int(row.get("clo_count") or 0)
        att = float(row.get("weighted_attainment") or 0)
        pct = round(att * 100, 1)
        tag = "✅" if att >= _WEAK_PLO else "⚠️"
        lines.append(f"| {code} | {name[:45]} | {clo_count} | {pct}% | {tag} |")
        if att < _WEAK_PLO:
            weak_plos.append({"code": code, "name": name, "pct": pct})
    lines.append("")
    if weak_plos:
        lines += ["### PLO chưa đạt ngưỡng 70%", ""]
        for item in weak_plos:
            lines.append(
                f"- **{item['code']}** ({item['name']}): đạt **{item['pct']}%** — "
                "cần rà soát các CLO đóng góp vào PLO này và tăng cường hoạt động học tập phù hợp."
            )
        lines.append("")
    total_att = [float(r.get("weighted_attainment") or 0) for r in plo_rows]
    avg_att = round(sum(total_att) / len(total_att) * 100, 1) if total_att else 0
    ok = avg_att >= 70
    lines.append(
        f"*Tỷ lệ đạt PLO trung bình toàn ngành: **{avg_att}%**. "
        + (
            "Chương trình đang đạt ngưỡng an toàn theo chuẩn kiểm định AUN/ABET."
            if ok
            else "Chương trình chưa đạt ngưỡng 70% — cần đánh giá lại thiết kế chương trình và hoạt động giảng dạy."
        )
        + "*"
    )
    return _join_lines(lines)


def _pct(part: int, total: int) -> float:
    return round(part / total * 100, 1) if total else 0.0


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


def _grade_distribution(values: list[float]) -> dict[str, int]:
    bands = {"<4.0": 0, "4.0-5.4": 0, "5.5-6.9": 0, "7.0-8.4": 0, ">=8.5": 0}
    for value in values:
        if value < 4:
            bands["<4.0"] += 1
        elif value < 5.5:
            bands["4.0-5.4"] += 1
        elif value < 7:
            bands["5.5-6.9"] += 1
        elif value < 8.5:
            bands["7.0-8.4"] += 1
        else:
            bands[">=8.5"] += 1
    return bands


def _gpa_distribution(students: list[Student]) -> dict[str, int]:
    values = [float(student.gpa_cumulative) for student in students if student.gpa_cumulative is not None]
    return {
        "<2.0": len([value for value in values if value < 2.0]),
        "2.0-2.49": len([value for value in values if 2.0 <= value < 2.5]),
        "2.5-3.19": len([value for value in values if 2.5 <= value < 3.2]),
        ">=3.2": len([value for value in values if value >= 3.2]),
    }


def _ratio(part: int, total: int) -> float:
    return _pct(part, total)


def _insight(title: str, finding: str, evidence: str, action: str, href: str | None = None) -> dict[str, Any]:
    return {
        "title": title,
        "finding": finding,
        "evidence": evidence,
        "action": action,
        "href": href,
    }


def _root_cause(evidence: str, hypothesis: str, next_check: str, href: str | None = None) -> dict[str, Any]:
    return {
        "evidence": evidence,
        "hypothesis": hypothesis,
        "next_check": next_check,
        "href": href,
    }


def _action_item(
    owner: str,
    task: str,
    reason: str,
    priority: str = "Trung bình",
    deadline: str = "30 ngày",
    href: str | None = None,
) -> dict[str, Any]:
    return {
        "owner": owner,
        "task": task,
        "reason": reason,
        "priority": priority,
        "deadline": deadline,
        "href": href,
    }


def _action_text(action: dict[str, Any]) -> str:
    return (
        f"{action['owner']} cần {action['task']} ({action['priority']}, {action['deadline']}) "
        f"vì {action['reason']}"
    )


def _risk_level(pass_rate: float, at_risk_count: int = 0, avg_grade: float | None = None) -> str:
    if pass_rate < 65 or at_risk_count >= 20 or (avg_grade is not None and avg_grade < 5.5):
        return "Cao"
    if pass_rate < 78 or at_risk_count >= 5 or (avg_grade is not None and avg_grade < 6.5):
        return "Trung bình"
    return "Thấp"


def _join_lines(lines: list[str]) -> str:
    return "\n".join(lines)


def _json_safe(value: Any) -> Any:
    """Convert DB-returned values into plain JSON types before storing metrics."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, date | datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_json_safe(item) for item in value]
    return value


def _same_tz(value: datetime, reference: datetime) -> datetime:
    if value.tzinfo is None and reference.tzinfo is not None:
        return value.replace(tzinfo=reference.tzinfo)
    if value.tzinfo is not None and reference.tzinfo is None:
        return value.replace(tzinfo=None)
    return value


def _in_period(value: datetime | None, start: datetime | None, end: datetime | None) -> bool:
    if value is None:
        return False
    checked = value
    if start is not None:
        checked_start = _same_tz(start, checked)
        if checked < checked_start:
            return False
    if end is not None:
        checked_end = _same_tz(end, checked)
        if checked > checked_end:
            return False
    return True


def _period_label(period_start: datetime | None, period_end: datetime | None) -> str:
    if period_start is None and period_end is None:
        return "Toàn bộ dữ liệu hiện có"
    if period_start is not None and period_end is not None:
        return f"Từ {period_start.date().isoformat()} đến {period_end.date().isoformat()}"
    if period_start is not None:
        return f"Từ {period_start.date().isoformat()} trở đi"
    return f"Đến {period_end.date().isoformat()}"


def _apply_period_filter(
    data: dict[str, list[Any]],
    period_start: datetime | None,
    period_end: datetime | None,
) -> tuple[dict[str, list[Any]], dict[str, Any]]:
    if period_start is None and period_end is None:
        return data, {
            "period_start": None,
            "period_end": None,
            "period_label": _period_label(None, None),
            "time_filter_applied": False,
            "excluded_enrollments_outside_period": 0,
        }

    enrollments = [item for item in data["enrollments"] if _in_period(item.completed_at, period_start, period_end)]
    filtered = {**data, "enrollments": enrollments}
    return filtered, {
        "period_start": period_start.isoformat() if period_start is not None else None,
        "period_end": period_end.isoformat() if period_end is not None else None,
        "period_label": _period_label(period_start, period_end),
        "time_filter_applied": True,
        "excluded_enrollments_outside_period": len(data["enrollments"]) - len(enrollments),
    }


async def _load_data(db: AsyncSession) -> dict[str, list[Any]]:
    students = list((await db.execute(select(Student))).scalars().all())
    enrollments = list((await db.execute(select(Enrollment))).scalars().all())
    sections = list((await db.execute(select(Section))).scalars().all())
    semesters = list((await db.execute(select(Semester))).scalars().all())
    courses = list((await db.execute(select(Course).options(selectinload(Course.programs)))).scalars().all())
    programs = list((await db.execute(select(Program))).scalars().all())
    departments = list((await db.execute(select(Department))).scalars().all())
    teachers = list((await db.execute(select(Teacher))).scalars().all())
    return {
        "students": students,
        "enrollments": enrollments,
        "sections": sections,
        "semesters": semesters,
        "courses": courses,
        "programs": programs,
        "departments": departments,
        "teachers": teachers,
    }


async def _fetch_pass_rate_trend(
    db: AsyncSession,
    report_type: str,
    scope_id: str | None,
    limit: int = 6,
) -> list[dict[str, Any]]:
    """Pull pass_rate + avg_gpa từ các báo cáo cùng report_type + scope_id, sắp xếp theo thời gian.

    Trả về list để gắn vào metrics_json["pass_rate_trend"].
    Bỏ qua báo cáo chưa có pass_rate để tránh điểm null trên chart.
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
        metrics_r = r.metrics_json or {}
        pr = metrics_r.get("pass_rate")
        if pr is None:
            continue
        trend.append(
            {
                "semester": metrics_r.get("semester_name") or (
                    r.created_at.strftime("%m/%Y") if r.created_at else ""
                ),
                "pass_rate": float(pr),
                "avg_gpa": float(metrics_r["avg_gpa"]) if metrics_r.get("avg_gpa") is not None else None,
                "report_id": r.id,
            }
        )
    return trend


async def generate_report(
    db: AsyncSession,
    report_type: str,
    actor_role: str,
    generated_by: str | None,
    scope_type: str | None = None,
    scope_id: str | None = None,
    semester_id: int | None = None,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    include_ai_narrative: bool = False,
) -> Report:
    """Generate, optionally enhance, persist, and return a report."""
    raw_data = await _load_data(db)
    data, period_metrics = _apply_period_filter(raw_data, period_start, period_end)
    generation_tool_calls: list[dict[str, Any]] = [
        {
            "tool_name": "load_report_dataset",
            "status": "success",
            "tool_output": {
                "students": len(data["students"]),
                "enrollments": len(data["enrollments"]),
                "raw_enrollments": len(raw_data["enrollments"]),
                "sections": len(data["sections"]),
                "semesters": len(data["semesters"]),
                "courses": len(data["courses"]),
                "programs": len(data["programs"]),
                "departments": len(data["departments"]),
                "teachers": len(data["teachers"]),
                "period_label": period_metrics["period_label"],
                "time_filter_applied": period_metrics["time_filter_applied"],
            },
        }
    ]
    if report_type == "school_overview":
        payload = _school_overview(data)
        generation_tool_calls.append(
            {
                "tool_name": "build_school_overview_snapshot",
                "status": "success",
                "tool_output": {
                    "metrics": payload["metrics_json"],
                    "title": payload["title"],
                },
            }
        )
        scope_type = scope_type or "school"
    elif report_type == "department_health":
        department_id = int(scope_id or 0)
        payload = _department_health(data, department_id)
        generation_tool_calls.append(
            {
                "tool_name": "build_department_health_snapshot",
                "status": "success",
                "tool_input": {"department_id": department_id},
                "tool_output": {
                    "metrics": payload["metrics_json"],
                    "title": payload["title"],
                },
            }
        )
        scope_type = scope_type or "department"
    elif report_type == "program_health":
        program_id = int(scope_id or 0)
        try:
            plo_rows = await _fetch_plo_attainment(db, program_id)
            generation_tool_calls.append(
                {
                    "tool_name": "fetch_plo_attainment",
                    "status": "success",
                    "tool_input": {"program_id": program_id},
                    "tool_output": {"rows": plo_rows},
                }
            )
        except Exception:
            logger.exception("PLO attainment query failed; continuing without PLO section")
            plo_rows = []
            generation_tool_calls.append(
                {
                    "tool_name": "fetch_plo_attainment",
                    "status": "error",
                    "tool_input": {"program_id": program_id},
                    "tool_output": {"rows": []},
                }
            )
        payload = _program_health(data, program_id, plo_rows)
        generation_tool_calls.append(
            {
                "tool_name": "build_program_health_snapshot",
                "status": "success",
                "tool_output": {
                    "metrics": payload["metrics_json"],
                    "title": payload["title"],
                },
            }
        )
        scope_type = scope_type or "program"
    elif report_type == "course_health":
        course_id = int(scope_id or 0)
        try:
            clo_rows = await _fetch_clo_breakdown(db, course_id)
            generation_tool_calls.append(
                {
                    "tool_name": "fetch_clo_breakdown",
                    "status": "success",
                    "tool_input": {"course_id": course_id},
                    "tool_output": {"rows": clo_rows},
                }
            )
        except Exception:
            logger.exception("Course CLO breakdown query failed; continuing without CLO section")
            clo_rows = []
            generation_tool_calls.append(
                {
                    "tool_name": "fetch_clo_breakdown",
                    "status": "error",
                    "tool_input": {"course_id": course_id},
                    "tool_output": {"rows": []},
                }
            )
        payload = _course_health(data, course_id, clo_rows)
        generation_tool_calls.append(
            {
                "tool_name": "build_course_health_snapshot",
                "status": "success",
                "tool_input": {"course_id": course_id},
                "tool_output": {
                    "metrics": payload["metrics_json"],
                    "title": payload["title"],
                },
            }
        )
        scope_type = scope_type or "course"
    elif report_type == "section_intervention":
        section_id = int(scope_id or 0)
        payload = _section_intervention(data, section_id)
        generation_tool_calls.append(
            {
                "tool_name": "build_section_intervention_snapshot",
                "status": "success",
                "tool_input": {"section_id": section_id},
                "tool_output": {
                    "metrics": payload["metrics_json"],
                    "title": payload["title"],
                },
            }
        )
        scope_type = scope_type or "section"
        section = next((item for item in data["sections"] if item.id == section_id), None)
        if section is not None:
            try:
                clo_rows = await _fetch_clo_breakdown(db, section.course_id)
                comp_rows = await _fetch_clo_components(db, section_id)
                generation_tool_calls.extend(
                    [
                        {
                            "tool_name": "fetch_clo_breakdown",
                            "status": "success",
                            "tool_input": {"course_id": section.course_id},
                            "tool_output": {"rows": clo_rows},
                        },
                        {
                            "tool_name": "fetch_clo_components",
                            "status": "success",
                            "tool_input": {"section_id": section_id},
                            "tool_output": {"rows": comp_rows},
                        },
                    ]
                )
                enrichment = _build_clo_enrichment(clo_rows, comp_rows)
            except Exception:
                logger.exception("CLO enrichment failed; skipping CLO section")
                generation_tool_calls.append(
                    {
                        "tool_name": "fetch_clo_enrichment",
                        "status": "error",
                        "tool_input": {"section_id": section_id},
                        "tool_output": {"enrichment": {}},
                    }
                )
                enrichment = {}
            if enrichment:
                payload = _apply_clo_enrichment(
                    payload,
                    enrichment,
                    detail_href=f"/manager/analytics/sections?section_id={section_id}",
                )
                generation_tool_calls.append(
                    {
                        "tool_name": "apply_clo_enrichment",
                        "status": "success",
                        "tool_output": {"enrichment": enrichment},
                    }
                )
    else:
        raise ValueError("Unsupported report type")

    payload["metrics_json"] = {
        **payload["metrics_json"],
        **period_metrics,
    }

    # Tag the report with the semester it covers so the library can filter by semester range.
    # Section reports already know their semester; otherwise use the one passed from the UI.
    resolved_semester_id = semester_id
    if resolved_semester_id is None and report_type == "section_intervention":
        section = next((item for item in data["sections"] if item.id == int(scope_id or 0)), None)
        resolved_semester_id = section.semester_id if section is not None else None
    if resolved_semester_id is not None:
        semester = next((s for s in data["semesters"] if s.id == resolved_semester_id), None)
        if semester is not None:
            payload["metrics_json"] = {
                **payload["metrics_json"],
                "semester_id": semester.id,
                "semester_name": semester.name,
                "semester_order": semester.year * 10 + semester.term,
            }

    # Fetch historical trend for chart rendering (best-effort; skip on error)
    _TREND_TYPES = {"school_overview", "department_health", "program_health", "course_health", "section_intervention"}
    if report_type in _TREND_TYPES:
        try:
            trend = await _fetch_pass_rate_trend(db, report_type, scope_id, limit=6)
            if trend:
                payload["metrics_json"] = {**payload["metrics_json"], "pass_rate_trend": trend}
        except Exception:
            logger.exception("pass_rate_trend fetch failed; skipping trend data")

    generation_tool_calls = _json_safe(generation_tool_calls)
    payload["metrics_json"] = {
        **payload["metrics_json"],
        "generation_tool_calls": generation_tool_calls,
    }

    if include_ai_narrative:
        payload = await _maybe_enhance_with_llm(payload, report_type, actor_role, generation_tool_calls)
    else:
        payload["metrics_json"] = {
            **payload["metrics_json"],
            "llm_enhanced": False,
            "llm_generation_stage": "disabled_by_report_settings",
        }
    payload = _sync_content_markdown(payload)
    report = Report(
        id=str(uuid4()),
        report_type=report_type,
        actor_role=actor_role,
        scope_type=scope_type,
        scope_id=scope_id,
        generated_by=generated_by,
        period_start=period_start,
        period_end=period_end,
        status="generated",
        **payload,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return report


def _school_overview(data: dict[str, list[Any]]) -> ReportPayload:
    students: list[Student] = data["students"]
    enrollments: list[Enrollment] = data["enrollments"]
    programs: list[Program] = data["programs"]
    sections: list[Section] = data["sections"]
    courses: list[Course] = data["courses"]
    active_students = [student for student in students if student.status == "active"]
    valid = [enrollment for enrollment in enrollments if enrollment.is_passed is not None]
    passed_count = len([item for item in valid if item.is_passed])
    failed_count = len(valid) - passed_count
    pass_rate = _pct(passed_count, len(valid))
    avg_gpa = _avg([float(student.gpa_cumulative) for student in active_students if student.gpa_cumulative is not None])
    at_risk = [
        student for student in active_students if student.gpa_cumulative is not None and student.gpa_cumulative < 2
    ]
    section_map = {section.id: section for section in sections}
    course_map = {course.id: course for course in courses}
    program_map = {program.id: program for program in programs}
    student_map = {student.id: student for student in students}
    failed_by_course: dict[int, int] = {}
    failed_by_program: dict[int, int] = {}
    for row in valid:
        if row.is_passed is not False:
            continue
        section = section_map.get(row.section_id)
        student = student_map.get(row.student_id)
        if section is not None:
            failed_by_course[section.course_id] = failed_by_course.get(section.course_id, 0) + 1
        if student is not None and student.program_id is not None:
            failed_by_program[student.program_id] = failed_by_program.get(student.program_id, 0) + 1
    bottlenecks = [
        {
            "course_id": course_id,
            "course": course_map.get(course_id).name if course_map.get(course_id) else str(course_id),
            "failed": failed,
            "href": f"/manager/analytics/courses?course_id={course_id}",
        }
        for course_id, failed in sorted(failed_by_course.items(), key=lambda item: item[1], reverse=True)[:5]
    ]
    weak_programs = [
        {
            "program_id": program_id,
            "program": program_map.get(program_id).name if program_map.get(program_id) else str(program_id),
            "failed": failed,
            "href": f"/manager/analytics/programs?program_id={program_id}",
        }
        for program_id, failed in sorted(failed_by_program.items(), key=lambda item: item[1], reverse=True)[:5]
    ]
    program_stats = []
    for program in programs:
        program_students = [student for student in active_students if student.program_id == program.id]
        ids = {student.id for student in program_students}
        program_rows = [row for row in valid if row.student_id in ids]
        if not program_rows:
            continue
        program_passed = len([row for row in program_rows if row.is_passed])
        program_stats.append(
            {
                "program_id": program.id,
                "program": program.name,
                "pass_rate": _pct(program_passed, len(program_rows)),
                "failed": len(program_rows) - program_passed,
                "active_students": len(program_students),
                "href": f"/manager/analytics/programs?program_id={program.id}",
            }
        )
    program_stats.sort(key=lambda item: (item["pass_rate"], -item["failed"]))
    best_programs = sorted(program_stats, key=lambda item: item["pass_rate"], reverse=True)[:3]
    weakest_programs_by_rate = program_stats[:3]
    gpa_distribution = _gpa_distribution(active_students)
    deep_insights = [
        _insight(
            "Toàn cảnh chất lượng học vụ",
            f"Tỷ lệ đạt toàn trường là {pass_rate}% trên {len(valid)} lượt học phần đã hoàn tất.",
            f"{passed_count} lượt đạt, {failed_count} lượt chưa đạt; GPA trung bình {avg_gpa}.",
            "Dùng báo cáo khoa/ngành để tách vùng rủi ro thay vì kết luận ở mức toàn trường.",
        ),
        _insight(
            "Nhóm chương trình cần mở ra xem trước",
            "; ".join(f"{item['program']} ({item['pass_rate']}%, {item['failed']} lượt trượt)" for item in weakest_programs_by_rate)
            or "Chưa đủ dữ liệu chương trình.",
            f"{len(program_stats)} chương trình có dữ liệu hoàn tất; {gpa_distribution['<2.0']} sinh viên có GPA dưới 2.0.",
            "Mở các ngành yếu để xem môn nền tảng, lớp học phần và nhóm sinh viên rủi ro.",
            weakest_programs_by_rate[0]["href"] if weakest_programs_by_rate else None,
        ),
        _insight(
            "Môn học kéo kết quả xuống mạnh nhất",
            ", ".join(f"{item['course']} ({item['failed']} lượt)" for item in bottlenecks[:3]) or "Chưa có môn nghẽn rõ.",
            f"Top 5 môn nghẽn chiếm {_ratio(sum(item['failed'] for item in bottlenecks), failed_count)}% tổng lượt chưa đạt.",
            "Mở phân tích môn để kiểm tra lớp nào, giáo viên nào và thành phần điểm nào tạo nghẽn.",
            bottlenecks[0]["href"] if bottlenecks else None,
        ),
    ]
    root_causes = [
        _root_cause(
            f"Top 5 môn nghẽn chiếm {_ratio(sum(item['failed'] for item in bottlenecks), failed_count)}% tổng lượt chưa đạt.",
            "Rủi ro toàn trường có khả năng tập trung ở một nhóm môn nền tảng thay vì phân tán đều.",
            "Mở từng môn nghẽn để xem lớp học phần, giảng viên phụ trách, phân bố điểm và CLO liên quan.",
            bottlenecks[0]["href"] if bottlenecks else None,
        ),
        _root_cause(
            f"{gpa_distribution['<2.0']} sinh viên có GPA dưới 2.0.",
            "Một nhóm sinh viên đang có nguy cơ kéo dài tiến độ hoặc phải học lại nhiều học phần.",
            "Tách danh sách sinh viên theo ngành/khoa và giao cố vấn học tập xác minh nguyên nhân.",
        ),
    ]
    action_plan = [
        _action_item(
            "Phòng đào tạo",
            "mở phân tích top môn nghẽn và gửi danh sách cho các khoa phụ trách",
            "top môn nghẽn đang chiếm tỷ trọng lớn trong tổng lượt chưa đạt",
            "Cao",
            "7 ngày",
            bottlenecks[0]["href"] if bottlenecks else None,
        ),
        _action_item(
            "Trưởng khoa",
            "review các ngành có tỷ lệ đạt thấp hoặc nhiều sinh viên GPA dưới 2.0",
            "rủi ro cần được tách xuống cấp ngành để hành động đúng người",
            "Cao",
            "14 ngày",
            weakest_programs_by_rate[0]["href"] if weakest_programs_by_rate else None,
        ),
        _action_item(
            "Cố vấn học tập",
            "xác minh nhóm sinh viên GPA dưới 2.0 theo nguyên nhân học vụ",
            "cần phân biệt thiếu nền tảng, vắng học, nợ điểm hay học lại nhiều lần",
            "Trung bình",
            "30 ngày",
        ),
    ]
    risk_level = _risk_level(pass_rate, len(at_risk))
    metrics = {
        "active_students": len(active_students),
        "program_count": len(programs),
        "completed_enrollments": len(valid),
        "passed_enrollments": passed_count,
        "failed_enrollments": failed_count,
        "pass_rate": pass_rate,
        "avg_gpa": avg_gpa,
        "at_risk_students": len(at_risk),
        "risk_level": risk_level,
        "weak_programs": weak_programs,
        "bottlenecks": bottlenecks,
        "program_stats": program_stats[:10],
        "best_programs": best_programs,
        "gpa_distribution": gpa_distribution,
        "deep_insights": deep_insights,
        "root_causes": root_causes,
        "action_plan": action_plan,
    }
    good = [
        f"Hệ thống đang có {len(active_students)} sinh viên đang học trên {len(programs)} chương trình.",
        f"GPA trung bình toàn trường là {avg_gpa}, đủ dùng để theo dõi sức khỏe học vụ ở mức tổng quan.",
    ]
    issues = [
        f"Có {failed_count} lượt học phần chưa đạt trong dữ liệu đã hoàn tất.",
        f"Có {len(at_risk)} sinh viên GPA dưới 2.0 cần đưa vào danh sách theo dõi.",
        "Môn gây trượt nhiều nhất: "
        + (", ".join(f"{item['course']} ({item['failed']} lượt)" for item in bottlenecks[:3]) or "chưa có dữ liệu trượt"),
    ]
    risks = [
        f"Mức rủi ro hiện tại: {risk_level}.",
        "Nếu các học phần có tỉ lệ trượt cao không được tách ra, báo cáo toàn trường sẽ che mất điểm nghẽn thật.",
    ]
    actions = [_action_text(item) for item in action_plan]
    summary = (
        f"Toàn trường có tỷ lệ đạt {pass_rate}% với {len(at_risk)} sinh viên nguy cơ. "
        f"Mức rủi ro đánh giá: {risk_level}."
    )
    content = _format_report(
        "Báo cáo sức khỏe học vụ toàn trường",
        summary,
        metrics,
        good,
        issues,
        risks,
        actions,
    )
    return {
        "title": "Báo cáo sức khỏe học vụ toàn trường",
        "summary": summary,
        "metrics_json": {**metrics, "good_signals": good, "issues": issues, "risks": risks, "actions": actions},
        "content_markdown": content,
    }


def _department_health(data: dict[str, list[Any]], department_id: int) -> ReportPayload:
    students: list[Student] = data["students"]
    enrollments: list[Enrollment] = data["enrollments"]
    sections: list[Section] = data["sections"]
    courses: list[Course] = data["courses"]
    programs: list[Program] = data["programs"]
    departments: list[Department] = data["departments"]
    department = next((item for item in departments if item.id == department_id), None)
    if department is None:
        raise ValueError("Department not found")

    department_programs = [item for item in programs if item.department_id == department_id]
    program_ids = {item.id for item in department_programs}
    department_students = [
        student for student in students if student.program_id in program_ids and student.status == "active"
    ]
    student_ids = {student.id for student in department_students}
    rows = [item for item in enrollments if item.student_id in student_ids and item.is_passed is not None]
    passed_count = len([item for item in rows if item.is_passed])
    pass_rate = _pct(passed_count, len(rows))
    avg_gpa = _avg(
        [float(student.gpa_cumulative) for student in department_students if student.gpa_cumulative is not None]
    )
    at_risk_students = [
        student for student in department_students if student.gpa_cumulative is not None and student.gpa_cumulative < 2
    ]

    section_map = {section.id: section for section in sections}
    course_map = {course.id: course for course in courses}
    program_map = {program.id: program for program in programs}
    department_courses = [
        course
        for course in courses
        if course.department_id == department_id or any(program.id in program_ids for program in course.programs)
    ]
    failed_by_course: dict[int, int] = {}
    failed_by_program: dict[int, int] = {}
    for row in rows:
        if row.is_passed is not False:
            continue
        section = section_map.get(row.section_id)
        if section is None:
            continue
        failed_by_course[section.course_id] = failed_by_course.get(section.course_id, 0) + 1
        student = next((item for item in department_students if item.id == row.student_id), None)
        if student is not None:
            failed_by_program[student.program_id] = failed_by_program.get(student.program_id, 0) + 1

    bottlenecks = [
        {
            "course_id": course_id,
            "course": course_map.get(course_id).name if course_map.get(course_id) else str(course_id),
            "failed": failed,
            "href": f"/manager/analytics/courses?course_id={course_id}",
        }
        for course_id, failed in sorted(failed_by_course.items(), key=lambda item: item[1], reverse=True)[:5]
    ]
    weak_programs = [
        {
            "program_id": program_id,
            "program": program_map.get(program_id).name if program_map.get(program_id) else str(program_id),
            "failed": failed,
            "href": f"/manager/analytics/programs?program_id={program_id}",
        }
        for program_id, failed in sorted(failed_by_program.items(), key=lambda item: item[1], reverse=True)[:5]
    ]
    program_stats = []
    for program in department_programs:
        ids = {student.id for student in department_students if student.program_id == program.id}
        program_rows = [row for row in rows if row.student_id in ids]
        if not program_rows:
            continue
        program_passed = len([row for row in program_rows if row.is_passed])
        program_stats.append(
            {
                "program_id": program.id,
                "program": program.name,
                "pass_rate": _pct(program_passed, len(program_rows)),
                "failed": len(program_rows) - program_passed,
                "active_students": len(ids),
                "href": f"/manager/analytics/programs?program_id={program.id}",
            }
        )
    program_stats.sort(key=lambda item: (item["pass_rate"], -item["failed"]))
    deep_insights = [
        _insight(
            "Sức khỏe khoa theo đầu ra học tập",
            f"Tỷ lệ đạt của khoa là {pass_rate}% trên {len(rows)} lượt học phần đã hoàn tất.",
            f"{len(department_students)} sinh viên đang học, {len(at_risk_students)} sinh viên GPA dưới 2.0, GPA trung bình {avg_gpa}.",
            "Ưu tiên ngành có tỷ lệ đạt thấp trước, sau đó mở môn nghẽn trong từng ngành.",
            program_stats[0]["href"] if program_stats else None,
        ),
        _insight(
            "Ngành tạo rủi ro chính",
            "; ".join(f"{item['program']} ({item['pass_rate']}%, {item['failed']} lượt trượt)" for item in program_stats[:3])
            or "Chưa đủ dữ liệu theo ngành.",
            f"Top ngành yếu chiếm {_ratio(sum(item['failed'] for item in program_stats[:3]), len(rows) - passed_count)}% lượt chưa đạt của khoa.",
            "Mở phân tích ngành để kiểm tra môn nền tảng và phân bố sinh viên yếu.",
            program_stats[0]["href"] if program_stats else None,
        ),
        _insight(
            "Môn nghẽn cần làm việc với giảng viên",
            ", ".join(f"{item['course']} ({item['failed']} lượt)" for item in bottlenecks[:3]) or "Chưa có môn nghẽn rõ.",
            f"Top 5 môn nghẽn chiếm {_ratio(sum(item['failed'] for item in bottlenecks), len(rows) - passed_count)}% lượt chưa đạt của khoa.",
            "Mở phân tích môn để xem lớp yếu, điểm thành phần và dữ liệu CLO.",
            bottlenecks[0]["href"] if bottlenecks else None,
        ),
    ]
    weak_program_summary = (
        ", ".join(f"{item['program']} ({item['pass_rate']}%)" for item in program_stats[:3])
        or "chưa đủ dữ liệu"
    )
    root_causes = [
        _root_cause(
            f"Top ngành yếu: {weak_program_summary}.",
            "Rủi ro của khoa có thể tập trung ở một vài ngành thay vì là vấn đề toàn khoa.",
            "Mở phân tích ngành yếu để kiểm tra môn nền tảng, sinh viên GPA thấp và PLO nếu có.",
            program_stats[0]["href"] if program_stats else None,
        ),
        _root_cause(
            f"Top 5 môn nghẽn chiếm {_ratio(sum(item['failed'] for item in bottlenecks), len(rows) - passed_count)}% lượt chưa đạt của khoa.",
            "Một số môn có thể đang kéo kết quả khoa xuống do đề/rubric/lớp học phần cụ thể.",
            "Mở phân tích môn nghẽn để so sánh lớp, giáo viên và điểm thành phần.",
            bottlenecks[0]["href"] if bottlenecks else None,
        ),
    ]
    action_plan = [
        _action_item(
            "Trưởng khoa",
            "giao trưởng ngành review nhóm ngành yếu nhất",
            "cần xác định rủi ro nằm ở chương trình, môn nền tảng hay nhóm sinh viên",
            "Cao",
            "7 ngày",
            program_stats[0]["href"] if program_stats else None,
        ),
        _action_item(
            "Trưởng bộ môn",
            "làm việc với giảng viên các môn nghẽn",
            "top môn nghẽn tạo tỷ trọng đáng kể trong lượt chưa đạt của khoa",
            "Cao",
            "14 ngày",
            bottlenecks[0]["href"] if bottlenecks else None,
        ),
        _action_item(
            "Cố vấn học tập",
            "lọc sinh viên GPA dưới 2.0 trong khoa và phân nhóm nguyên nhân",
            "nhóm GPA thấp cần can thiệp theo nguyên nhân thay vì nhắc nhở chung",
            "Trung bình",
            "30 ngày",
        ),
    ]
    risk_level = _risk_level(pass_rate, len(at_risk_students))
    metrics = {
        "department_id": department_id,
        "department_name": department.name,
        "program_count": len(department_programs),
        "course_count": len(department_courses),
        "active_students": len(department_students),
        "completed_enrollments": len(rows),
        "pass_rate": pass_rate,
        "avg_gpa": avg_gpa,
        "at_risk_students": len(at_risk_students),
        "risk_level": risk_level,
        "weak_programs": weak_programs,
        "bottlenecks": bottlenecks,
        "program_stats": program_stats,
        "gpa_distribution": _gpa_distribution(department_students),
        "deep_insights": deep_insights,
        "root_causes": root_causes,
        "action_plan": action_plan,
    }
    good = [
        f"Khoa {department.name} có {len(department_programs)} ngành và {len(department_students)} sinh viên đang học.",
        f"Tỷ lệ đạt hiện tại là {pass_rate}%; cần đọc cùng các ngành và môn có nhiều lượt trượt để xác định điểm nghẽn thật.",
    ]
    issues = [
        f"Có {len(at_risk_students)} sinh viên GPA dưới 2.0 trong phạm vi khoa.",
        "Nhóm môn nghẽn chính: "
        + (", ".join(f"{item['course']} ({item['failed']} lượt)" for item in bottlenecks) or "chưa có dữ liệu trượt"),
    ]
    risks = [
        f"Mức rủi ro khoa: {risk_level}.",
        "Nếu không tách theo ngành và môn, khoa có thể bỏ sót điểm nghẽn trong chương trình đào tạo.",
    ]
    actions = [_action_text(item) for item in action_plan]
    summary = (
        f"Khoa {department.name} có tỷ lệ đạt {pass_rate}%, GPA trung bình {avg_gpa}, "
        f"{len(at_risk_students)} sinh viên nguy cơ. Mức rủi ro: {risk_level}."
    )
    content = _format_report(
        f"Báo cáo sức khỏe khoa: {department.name}",
        summary,
        metrics,
        good,
        issues,
        risks,
        actions,
    )
    return {
        "title": f"Báo cáo sức khỏe khoa - {department.name}",
        "summary": summary,
        "metrics_json": {**metrics, "good_signals": good, "issues": issues, "risks": risks, "actions": actions},
        "content_markdown": content,
    }


def _program_health(
    data: dict[str, list[Any]], program_id: int, plo_rows: list[dict[str, Any]] | None = None
) -> ReportPayload:
    students: list[Student] = data["students"]
    enrollments: list[Enrollment] = data["enrollments"]
    sections: list[Section] = data["sections"]
    courses: list[Course] = data["courses"]
    programs: list[Program] = data["programs"]
    program = next((item for item in programs if item.id == program_id), None)
    if program is None:
        raise ValueError("Program not found")

    section_map = {section.id: section for section in sections}
    course_map = {course.id: course for course in courses}
    program_students = [
        student for student in students if student.program_id == program_id and student.status == "active"
    ]
    student_ids = {student.id for student in program_students}
    rows = [item for item in enrollments if item.student_id in student_ids and item.is_passed is not None]
    passed_count = len([item for item in rows if item.is_passed])
    pass_rate = _pct(passed_count, len(rows))
    avg_gpa = _avg(
        [float(student.gpa_cumulative) for student in program_students if student.gpa_cumulative is not None]
    )
    at_risk_students = [
        student for student in program_students if student.gpa_cumulative is not None and student.gpa_cumulative < 2
    ]
    failed_by_course: dict[int, int] = {}
    for row in rows:
        if row.is_passed is not False:
            continue
        section = section_map.get(row.section_id)
        if section:
            failed_by_course[section.course_id] = failed_by_course.get(section.course_id, 0) + 1
    course_stats = []
    for course_id in {section_map[row.section_id].course_id for row in rows if row.section_id in section_map}:
        course_rows = [row for row in rows if section_map.get(row.section_id) and section_map[row.section_id].course_id == course_id]
        course_passed = len([row for row in course_rows if row.is_passed])
        course_stats.append(
            {
                "course_id": course_id,
                "course": course_map.get(course_id).name if course_map.get(course_id) else str(course_id),
                "pass_rate": _pct(course_passed, len(course_rows)),
                "failed": len(course_rows) - course_passed,
                "sample": len(course_rows),
                "href": f"/manager/analytics/courses?course_id={course_id}",
            }
        )
    course_stats.sort(key=lambda item: (item["pass_rate"], -item["failed"]))
    bottlenecks = [
        {
            "course_id": course_id,
            "course": course_map.get(course_id).name if course_map.get(course_id) else str(course_id),
            "failed": failed,
            "href": f"/manager/analytics/courses?course_id={course_id}",
        }
        for course_id, failed in sorted(failed_by_course.items(), key=lambda item: item[1], reverse=True)[:5]
    ]
    deep_insights = [
        _insight(
            "Bức tranh ngành theo học phần",
            f"Tỷ lệ đạt ngành là {pass_rate}% trên {len(rows)} lượt học phần hoàn tất.",
            f"{len(program_students)} sinh viên đang học, {len(at_risk_students)} sinh viên GPA dưới 2.0, GPA trung bình {avg_gpa}.",
            "Đối chiếu môn có tỷ lệ đạt thấp với môn có nhiều lượt trượt để xác định ưu tiên can thiệp.",
        ),
        _insight(
            "Môn có tỷ lệ đạt thấp nhất",
            "; ".join(f"{item['course']} ({item['pass_rate']}%, n={item['sample']})" for item in course_stats[:3])
            or "Chưa đủ dữ liệu môn học.",
            f"{len(course_stats)} môn có dữ liệu trong ngành; top môn yếu cần được mở sang phân tích chi tiết.",
            "Mở phân tích môn để xem lớp học phần và điểm thành phần.",
            course_stats[0]["href"] if course_stats else None,
        ),
        _insight(
            "Môn gây số lượt trượt lớn nhất",
            ", ".join(f"{item['course']} ({item['failed']} lượt)" for item in bottlenecks[:3]) or "Chưa có môn nghẽn rõ.",
            f"Top 5 môn nghẽn chiếm {_ratio(sum(item['failed'] for item in bottlenecks), len(rows) - passed_count)}% lượt chưa đạt của ngành.",
            "Làm việc với giảng viên môn nghẽn và kiểm tra điều kiện dự thi/rubric.",
            bottlenecks[0]["href"] if bottlenecks else None,
        ),
    ]
    root_causes = [
        _root_cause(
            "; ".join(f"{item['course']} ({item['pass_rate']}%, n={item['sample']})" for item in course_stats[:3])
            or "Chưa đủ dữ liệu học phần.",
            "Các môn có tỷ lệ đạt thấp có thể là điểm nghẽn về kiến thức nền, thiết kế môn hoặc điều kiện đánh giá.",
            "Mở phân tích môn để kiểm tra lớp học phần, điểm thành phần và CLO.",
            course_stats[0]["href"] if course_stats else None,
        ),
        _root_cause(
            f"{len(at_risk_students)} sinh viên GPA dưới 2.0 trong ngành.",
            "Rủi ro tiến độ có thể đến từ nhóm sinh viên yếu tích lũy, không chỉ từ từng môn riêng lẻ.",
            "Tách danh sách sinh viên theo khóa/lớp và giao cố vấn học tập xác minh.",
        ),
    ]
    action_plan = [
        _action_item(
            "Trưởng ngành",
            "mở top môn có tỷ lệ đạt thấp để xác định môn nền tảng cần cải tiến",
            "môn có pass rate thấp ảnh hưởng trực tiếp tới tiến độ và PLO của ngành",
            "Cao",
            "7 ngày",
            course_stats[0]["href"] if course_stats else None,
        ),
        _action_item(
            "Hội đồng chương trình",
            "kiểm tra PLO/CLO mapping và môn liên quan tới PLO yếu",
            "PLO yếu là rủi ro trực tiếp cho OBE và kiểm định",
            "Cao",
            "30 ngày",
        ),
        _action_item(
            "Cố vấn học tập",
            "phân nhóm sinh viên GPA dưới 2.0 theo khóa và nguyên nhân",
            "cần xác định nhóm cần hỗ trợ học thuật sớm",
            "Trung bình",
            "30 ngày",
        ),
    ]
    risk_level = _risk_level(pass_rate, len(at_risk_students))
    metrics = {
        "program_id": program_id,
        "program_name": program.name,
        "active_students": len(program_students),
        "completed_enrollments": len(rows),
        "pass_rate": pass_rate,
        "avg_gpa": avg_gpa,
        "at_risk_students": len(at_risk_students),
        "risk_level": risk_level,
        "bottlenecks": bottlenecks,
        "course_stats": course_stats[:10],
        "gpa_distribution": _gpa_distribution(program_students),
        "deep_insights": deep_insights,
        "root_causes": root_causes,
        "action_plan": action_plan,
    }
    good = [
        f"Ngành {program.name} có {len(program_students)} sinh viên đang học, đủ mẫu để theo dõi xu hướng.",
        f"Tỷ lệ đạt hiện tại là {pass_rate}%, cần đọc cùng nhóm môn đang gây trượt để không kết luận quá rộng.",
    ]
    issues = [
        f"Có {len(at_risk_students)} sinh viên GPA dưới 2.0 trong ngành.",
        "Các môn nghẽn chính: "
        + (", ".join(f"{item['course']} ({item['failed']} lượt)" for item in bottlenecks) or "chưa có dữ liệu trượt"),
    ]
    risks = [
        f"Mức rủi ro ngành: {risk_level}.",
        "Nếu môn nền tảng nằm trong nhóm nghẽn, sinh viên có thể kéo dài tiến độ ở các học kỳ sau.",
    ]
    actions = [_action_text(item) for item in action_plan]
    summary = (
        f"Ngành {program.name} có tỷ lệ đạt {pass_rate}%, GPA trung bình {avg_gpa}, "
        f"{len(at_risk_students)} sinh viên nguy cơ. Mức rủi ro: {risk_level}."
    )
    content = _format_report(
        f"Báo cáo sức khỏe ngành: {program.name}",
        summary,
        metrics,
        good,
        issues,
        risks,
        actions,
    )
    if plo_rows:
        plo_section = _format_plo_section(plo_rows)
        if plo_section:
            content = content + "\n\n" + plo_section
        # surface PLO attainment summary into metrics for agent tools
        metrics["plo_attainment"] = {
            str(r.get("plo_code")): round(float(r.get("weighted_attainment") or 0) * 100, 1) for r in plo_rows
        }
        weak_plos = [r for r in plo_rows if float(r.get("weighted_attainment") or 0) < 0.70]
        if weak_plos:
            issues.append(
                "PLO chưa đạt ngưỡng 70%: "
                + ", ".join(
                    f"{r['plo_code']} ({round(float(r.get('weighted_attainment', 0)) * 100, 1)}%)" for r in weak_plos
                )
            )
    return {
        "title": f"Báo cáo sức khỏe ngành - {program.name}",
        "summary": summary,
        "metrics_json": {**metrics, "good_signals": good, "issues": issues, "risks": risks, "actions": actions},
        "content_markdown": content,
    }


def _course_health(
    data: dict[str, list[Any]], course_id: int, clo_rows: list[dict[str, Any]] | None = None
) -> ReportPayload:
    students: list[Student] = data["students"]
    enrollments: list[Enrollment] = data["enrollments"]
    sections: list[Section] = data["sections"]
    courses: list[Course] = data["courses"]
    teachers: list[Teacher] = data["teachers"]
    course = next((item for item in courses if item.id == course_id), None)
    if course is None:
        raise ValueError("Course not found")

    course_sections = [item for item in sections if item.course_id == course_id]
    section_ids = {item.id for item in course_sections}
    rows = [item for item in enrollments if item.section_id in section_ids and item.is_passed is not None]
    all_rows = [item for item in enrollments if item.section_id in section_ids]
    passed_count = len([item for item in rows if item.is_passed])
    pass_rate = _pct(passed_count, len(rows))
    grades = [float(item.final_grade) for item in rows if item.final_grade is not None]
    avg_grade = _avg(grades)
    student_ids = {item.student_id for item in all_rows}
    course_students = [item for item in students if item.id in student_ids]
    teacher_map = {teacher.id: teacher for teacher in teachers}

    weak_sections = []
    section_stats = []
    for section in course_sections:
        section_rows = [item for item in rows if item.section_id == section.id]
        section_passed = len([item for item in section_rows if item.is_passed])
        section_pass_rate = _pct(section_passed, len(section_rows))
        if section_rows:
            teacher = teacher_map.get(section.teacher_id) if section.teacher_id is not None else None
            section_stats.append(
                {
                    "section_id": section.id,
                    "section": section.section_code,
                    "teacher": teacher.full_name if teacher else "Chưa gán giảng viên",
                    "pass_rate": section_pass_rate,
                    "avg_grade": _avg([float(item.final_grade) for item in section_rows if item.final_grade is not None]),
                    "sample": len(section_rows),
                    "href": f"/manager/analytics/sections?section_id={section.id}",
                }
            )
        if section_rows and section_pass_rate < 70:
            teacher = teacher_map.get(section.teacher_id) if section.teacher_id is not None else None
            weak_sections.append(
                {
                    "section_id": section.id,
                    "course_id": section.course_id,
                    "section": section.section_code,
                    "teacher": teacher.full_name if teacher else "Chưa gán giảng viên",
                    "pass_rate": section_pass_rate,
                    "sample": len(section_rows),
                    "href": f"/manager/analytics/sections?section_id={section.id}",
                }
            )
    weak_sections.sort(key=lambda item: item["pass_rate"])
    section_stats.sort(key=lambda item: (item["pass_rate"], item["avg_grade"]))

    enrichment = _build_clo_enrichment(clo_rows or [])
    weak_clos = enrichment.get("weak_clos", [])
    risk_level = _risk_level(pass_rate, len(weak_sections), avg_grade)
    missing_grade_count = len([item for item in all_rows if item.is_passed is None])
    deep_insights = [
        _insight(
            "Phân bố kết quả môn học",
            f"Môn có tỷ lệ đạt {pass_rate}% và điểm trung bình {avg_grade}.",
            f"Phân bố điểm: {_grade_distribution(grades)}; còn {missing_grade_count} lượt học phần chưa chốt kết quả.",
            "Ưu tiên xem lớp có tỷ lệ đạt thấp và so sánh điểm thành phần giữa các lớp.",
            section_stats[0]["href"] if section_stats else None,
        ),
        _insight(
            "Lớp học phần kéo kết quả xuống",
            "; ".join(
                f"{item['section']} ({item['pass_rate']}%, TB {item['avg_grade']}, n={item['sample']})"
                for item in section_stats[:3]
            )
            or "Chưa đủ dữ liệu lớp học phần.",
            f"{len(weak_sections)} lớp dưới ngưỡng 70%; {len(section_stats)} lớp có kết quả hoàn tất.",
            "Mở lớp yếu để xem sinh viên, giáo viên phụ trách và điểm thành phần.",
            section_stats[0]["href"] if section_stats else None,
        ),
        _insight(
            "Chuẩn đầu ra môn học",
            ", ".join(f"{item['code']} chỉ đạt {item['attainment']}%" for item in weak_clos[:3])
            if weak_clos
            else "Chưa phát hiện CLO dưới ngưỡng hoặc chưa có dữ liệu CLO.",
            f"{len(enrichment.get('clo_attainment', {}))} CLO có dữ liệu; {len(weak_clos)} CLO dưới ngưỡng 70%.",
            "Rà lại mapping thành phần điểm -> CLO, rubric và đề bài của CLO yếu.",
            f"/manager/analytics/courses?course_id={course_id}",
        ),
    ]
    root_causes = [
        _root_cause(
            "; ".join(
                f"{item['section']} ({item['pass_rate']}%, TB {item['avg_grade']}, n={item['sample']})"
                for item in section_stats[:3]
            )
            or "Chưa đủ dữ liệu lớp học phần.",
            "Rủi ro môn học có thể tập trung ở một số lớp thay vì là vấn đề của toàn bộ môn.",
            "Mở lớp yếu để xem sinh viên, giáo viên phụ trách và phân bố điểm thành phần.",
            section_stats[0]["href"] if section_stats else None,
        ),
        _root_cause(
            ", ".join(f"{item['code']} đạt {item['attainment']}%" for item in weak_clos[:3]) or "Chưa có CLO yếu rõ.",
            "Nếu CLO yếu trong khi pass rate không quá thấp, đề/rubric có thể đang cho qua môn nhưng chưa bảo đảm chuẩn đầu ra.",
            "Kiểm tra mapping thành phần điểm -> CLO và điểm thành phần của các lớp yếu.",
            f"/manager/analytics/courses?course_id={course_id}",
        ),
    ]
    action_plan = [
        _action_item(
            "Trưởng bộ môn",
            "so sánh các lớp có tỷ lệ đạt thấp với mặt bằng chung của môn",
            "cần phân biệt vấn đề toàn môn và vấn đề cục bộ ở từng lớp",
            "Cao",
            "7 ngày",
            section_stats[0]["href"] if section_stats else None,
        ),
        _action_item(
            "Giảng viên lớp yếu",
            "trích điểm thành phần và danh sách sinh viên cần hỗ trợ",
            "cần biết sinh viên yếu ở chuyên cần, giữa kỳ, cuối kỳ hay CLO cụ thể",
            "Cao",
            "7 ngày",
            weak_sections[0]["href"] if weak_sections else None,
        ),
        _action_item(
            "Nhóm đảm bảo chất lượng",
            "cập nhật mapping thành phần điểm -> CLO nếu dữ liệu CLO còn thiếu",
            "report chuẩn đầu ra không đủ tin cậy nếu thiếu mapping",
            "Trung bình",
            "30 ngày",
            f"/manager/analytics/courses?course_id={course_id}",
        ),
    ]
    metrics = {
        "course_id": course_id,
        "course_code": course.code,
        "course_name": course.name,
        "credits": course.credits,
        "section_count": len(course_sections),
        "student_count": len(course_students),
        "completed_enrollments": len(rows),
        "pass_rate": pass_rate,
        "avg_grade": avg_grade,
        "risk_level": risk_level,
        "weak_sections": weak_sections[:5],
        "section_stats": section_stats[:10],
        "grade_distribution": _grade_distribution(grades),
        "missing_grade_count": missing_grade_count,
        "deep_insights": deep_insights,
        "root_causes": root_causes,
        "action_plan": action_plan,
    }
    if enrichment:
        metrics["clo_attainment"] = enrichment["clo_attainment"]
        metrics["weak_clo_count"] = len(weak_clos)
        metrics["weak_clos"] = [
            {**item, "href": f"/manager/analytics/courses?course_id={course_id}"}
            for item in weak_clos
        ]

    good = [
        f"Môn {course.name} có {len(course_sections)} lớp học phần và {len(rows)} lượt học phần đã có kết quả.",
        f"Điểm trung bình môn hiện tại là {avg_grade}, tỷ lệ đạt là {pass_rate}%.",
    ]
    issues = []
    if weak_sections:
        issues.append(
            "Các lớp học phần cần chú ý: "
            + ", ".join(f"{item['section']} ({item['pass_rate']}%)" for item in weak_sections[:5])
        )
    else:
        issues.append("Chưa thấy lớp học phần nào dưới ngưỡng tỷ lệ đạt 70% trong dữ liệu đã hoàn tất.")
    if weak_clos:
        issues.append(
            "CLO chưa đạt ngưỡng 70%: " + ", ".join(f"{item['code']} ({item['attainment']}%)" for item in weak_clos)
        )
    elif clo_rows:
        issues.append("Các CLO có dữ liệu hiện đang đạt ngưỡng theo cấu hình hiện tại.")
    else:
        issues.append("Chưa có dữ liệu CLO đủ để đánh giá chuẩn đầu ra môn học.")

    risks = [
        f"Mức rủi ro môn học: {risk_level}.",
        "Nếu các lớp yếu tập trung ở cùng một thành phần điểm, cần rà lại đề, rubric và hoạt động ôn tập.",
    ]
    actions = [_action_text(item) for item in action_plan]
    if enrichment.get("improvement_actions"):
        actions = list(enrichment["improvement_actions"]) + actions

    summary = (
        f"Môn {course.name} có tỷ lệ đạt {pass_rate}%, điểm trung bình {avg_grade}, "
        f"{len(weak_sections)} lớp học phần cần chú ý. Mức rủi ro: {risk_level}."
    )
    content = _format_report(
        f"Báo cáo sức khỏe môn học: {course.name}",
        summary,
        metrics,
        good,
        issues,
        risks,
        actions,
    )
    clo_section = _format_clo_section(
        {
            **enrichment,
            "weak_clos": [
                {**item, "href": f"/manager/analytics/courses?course_id={course_id}"}
                for item in weak_clos
            ],
        }
    )
    if clo_section:
        content = content + "\n\n" + clo_section
    return {
        "title": f"Báo cáo sức khỏe môn học - {course.name}",
        "summary": summary,
        "metrics_json": {**metrics, "good_signals": good, "issues": issues, "risks": risks, "actions": actions},
        "content_markdown": content,
    }


def _section_intervention(data: dict[str, list[Any]], section_id: int) -> ReportPayload:
    students: list[Student] = data["students"]
    enrollments: list[Enrollment] = data["enrollments"]
    sections: list[Section] = data["sections"]
    courses: list[Course] = data["courses"]
    teachers: list[Teacher] = data["teachers"]
    semesters: list[Semester] = data["semesters"]
    section = next((item for item in sections if item.id == section_id), None)
    if section is None:
        raise ValueError("Section not found")

    course = next((item for item in courses if item.id == section.course_id), None)
    teacher = next((item for item in teachers if item.id == section.teacher_id), None)
    semester = next((item for item in semesters if item.id == section.semester_id), None)
    student_map = {student.id: student for student in students}
    rows = [item for item in enrollments if item.section_id == section_id]
    valid = [item for item in rows if item.is_passed is not None]
    grades = [float(item.final_grade) for item in rows if item.final_grade is not None]
    pass_rate = _pct(len([item for item in valid if item.is_passed]), len(valid))
    avg_grade = _avg(grades)
    watchlist = []
    for row in rows:
        grade = float(row.final_grade) if row.final_grade is not None else None
        if row.is_passed is False or (grade is not None and grade < 5.5):
            student = student_map.get(row.student_id)
            watchlist.append(
                {
                    "student_code": student.student_code if student else str(row.student_id),
                    "full_name": student.full_name if student else "Unknown",
                    "grade": grade,
                    "reason": "Không đạt" if row.is_passed is False else "Cận rủi ro",
                }
            )
    risk_level = _risk_level(pass_rate, len(watchlist), avg_grade)
    missing_grade_count = len(rows) - len(valid)
    grade_distribution = _grade_distribution(grades)
    deep_insights = [
        _insight(
            "Mức hoàn tất dữ liệu điểm",
            f"Lớp đã có {len(valid)}/{len(rows)} kết quả được ghi nhận.",
            f"Tỷ lệ hoàn tất điểm {_ratio(len(valid), len(rows))}%; còn {missing_grade_count} sinh viên chưa có kết quả hoàn tất.",
            "Chốt đủ điểm trước khi kết luận cuối kỳ; nếu chưa đủ điểm, chỉ xem đây là cảnh báo sớm.",
            f"/manager/analytics/sections?section_id={section_id}",
        ),
        _insight(
            "Phân bố điểm của lớp",
            f"Điểm trung bình lớp là {avg_grade}, tỷ lệ đạt {pass_rate}%.",
            f"Phân bố điểm: {grade_distribution}; {len(watchlist)} sinh viên nằm trong watchlist.",
            "Tách nhóm dưới 5.5 để xem cần hỗ trợ kiến thức nền, chuyên cần hay ôn tập cuối kỳ.",
            f"/manager/analytics/sections?section_id={section_id}",
        ),
        _insight(
            "Hướng can thiệp giảng viên",
            "Nếu nhiều sinh viên cùng yếu ở một thành phần điểm, nguyên nhân có thể nằm ở rubric, đề hoặc hoạt động luyện tập.",
            f"Giảng viên phụ trách: {teacher.full_name if teacher else 'chưa gán'}; học kỳ {semester.code if semester else 'chưa rõ'}.",
            "Mở điểm thành phần của lớp, nhóm sinh viên theo nguyên nhân và ghi nhận hành động hỗ trợ.",
            f"/manager/analytics/sections?section_id={section_id}",
        ),
    ]
    root_causes = [
        _root_cause(
            f"Tỷ lệ hoàn tất điểm {_ratio(len(valid), len(rows))}%, còn {missing_grade_count} sinh viên chưa có kết quả hoàn tất.",
            "Nếu dữ liệu chưa chốt đủ, kết luận về lớp chỉ nên xem là cảnh báo sớm.",
            "Cập nhật đủ điểm thành phần và điểm cuối kỳ trước khi chốt nhận định cuối cùng.",
            f"/manager/analytics/sections?section_id={section_id}",
        ),
        _root_cause(
            f"{len(watchlist)} sinh viên trong watchlist; phân bố điểm {grade_distribution}.",
            "Sinh viên rủi ro có thể tập trung ở một nhóm điểm thấp hoặc thiếu điểm thành phần.",
            "Mở danh sách sinh viên và điểm thành phần để phân nhóm nguyên nhân can thiệp.",
            f"/manager/analytics/sections?section_id={section_id}",
        ),
    ]
    action_plan = [
        _action_item(
            "Giảng viên",
            "kiểm tra watchlist và liên hệ sinh viên cần hỗ trợ",
            "can thiệp sớm giúp tránh trượt do thiếu điểm hoặc yếu một thành phần",
            "Cao" if watchlist else "Trung bình",
            "7 ngày",
            f"/manager/analytics/sections?section_id={section_id}",
        ),
        _action_item(
            "Giảng viên",
            "rà lại điểm thành phần để xác định chuyên cần, giữa kỳ hay cuối kỳ đang kéo kết quả xuống",
            "cần biết đúng nguyên nhân trước khi tổ chức phụ đạo hoặc điều chỉnh rubric",
            "Cao",
            "7 ngày",
            f"/manager/analytics/sections?section_id={section_id}",
        ),
        _action_item(
            "Trưởng bộ môn",
            "xem lại đề/rubric nếu nhiều sinh viên cùng yếu ở một thành phần hoặc CLO",
            "mẫu lỗi lặp lại có thể phản ánh vấn đề thiết kế đánh giá",
            "Trung bình",
            "14 ngày",
            f"/manager/analytics/sections?section_id={section_id}",
        ),
    ]
    metrics = {
        "section_id": section_id,
        "section_code": section.section_code,
        "course_name": course.name if course else "Chưa rõ môn học",
        "teacher_name": teacher.full_name if teacher else "Chưa gán giảng viên",
        "semester": semester.code if semester else "Chưa rõ học kỳ",
        "student_count": len(rows),
        "graded_count": len(valid),
        "pass_rate": pass_rate,
        "avg_grade": avg_grade,
        "watchlist_count": len(watchlist),
        "risk_level": risk_level,
        "watchlist": watchlist[:20],
        "grade_distribution": grade_distribution,
        "missing_grade_count": missing_grade_count,
        "deep_insights": deep_insights,
        "root_causes": root_causes,
        "action_plan": action_plan,
    }
    good = [
        f"Lớp {section.section_code} đã có {len(valid)}/{len(rows)} kết quả được ghi nhận.",
        f"Điểm trung bình lớp là {avg_grade}; đây là tín hiệu chính để so với mặt bằng môn.",
    ]
    issues = []
    if watchlist:
        issues.append(f"Có {len(watchlist)} sinh viên cần chú ý ngay.")
    else:
        issues.append("Chưa phát hiện sinh viên cần can thiệp theo ngưỡng điểm hiện tại.")
    if pass_rate < 70:
        issues.append(f"Tỷ lệ đạt lớp chỉ đạt {pass_rate}%, thấp hơn ngưỡng an toàn 70%.")
    elif len(valid) < len(rows):
        issues.append(f"Còn {len(rows) - len(valid)} sinh viên chưa có kết quả hoàn tất.")
    else:
        issues.append("Chưa thấy dấu hiệu tỷ lệ đạt thấp trong dữ liệu hiện tại.")

    risks = [f"Mức rủi ro lớp: {risk_level}."]
    if risk_level == "Thấp":
        risks.append("Rủi ro chính là dữ liệu lớp quá ít hoặc chưa đủ điểm thành phần để kết luận sâu.")
    else:
        risks.append("Nhóm cận rủi ro có thể trượt nếu bài cuối kỳ hoặc điều kiện dự thi không được can thiệp sớm.")

    actions = [_action_text(item) for item in action_plan]
    summary = (
        f"Lớp {section.section_code} có tỷ lệ đạt {pass_rate}%, điểm trung bình {avg_grade}, "
        f"{len(watchlist)} sinh viên cần can thiệp. Mức rủi ro: {risk_level}."
    )
    content = _format_report(
        f"Báo cáo can thiệp lớp: {section.section_code}",
        summary,
        metrics,
        good,
        issues,
        risks,
        actions,
        watchlist,
    )
    return {
        "title": f"Báo cáo can thiệp lớp - {section.section_code}",
        "summary": summary,
        "metrics_json": {**metrics, "good_signals": good, "issues": issues, "risks": risks, "actions": actions},
        "content_markdown": content,
    }


def _format_report(
    title: str,
    summary: str,
    metrics: dict[str, Any],
    good: list[str],
    issues: list[str],
    risks: list[str],
    actions: list[str],
    watchlist: list[dict[str, Any]] | None = None,
) -> str:
    lines = [
        f"# {title}",
        "",
        "## Kết luận nhanh",
        summary,
        "",
        "## Tín hiệu tốt",
        *(f"- {item}" for item in good),
        "",
        "## Điểm chưa tốt",
        *(f"- {item}" for item in issues),
        "",
        "## Rủi ro cần chú ý",
        *(f"- {item}" for item in risks),
        "",
        "## Chỉ số chính",
        *(
            f"- {key}: {value}"
            for key, value in metrics.items()
            if key
            not in {
                "watchlist",
                "bottlenecks",
                "weak_programs",
                "weak_sections",
                "deep_insights",
                "root_causes",
                "action_plan",
                "program_stats",
                "course_stats",
                "section_stats",
                "best_programs",
                "generation_tool_calls",
            }
        ),
    ]
    if metrics.get("bottlenecks"):
        lines.extend(
            [
                "",
                "## Môn nghẽn",
                *(
                    f"- [{item['course']}]({item.get('href', '#')}): {item['failed']} lượt chưa đạt"
                    for item in metrics["bottlenecks"]
                ),
            ]
        )
    if metrics.get("weak_programs"):
        lines.extend(
            [
                "",
                "## Ngành cần phân tích sâu",
                *(
                    f"- [{item['program']}]({item.get('href', '#')}): {item['failed']} lượt chưa đạt"
                    for item in metrics["weak_programs"]
                ),
            ]
        )
    if metrics.get("weak_sections"):
        lines.extend(
            [
                "",
                "## Lớp học phần cần phân tích sâu",
                *(
                    f"- [{item['section']}]({item.get('href', '#')}): tỷ lệ đạt {item['pass_rate']}%, cỡ mẫu {item['sample']}"
                    for item in metrics["weak_sections"]
                ),
            ]
        )
    if metrics.get("deep_insights"):
        lines.extend(["", "## Phân tích sâu từ dữ liệu"])
        for item in metrics["deep_insights"]:
            href = item.get("href")
            title = f"[{item['title']}]({href})" if href else item["title"]
            lines.extend(
                [
                    "",
                    f"### {title}",
                    f"- Nhận định: {item['finding']}",
                    f"- Bằng chứng: {item['evidence']}",
                    f"- Hành động: {item['action']}",
                ]
            )
    if metrics.get("root_causes"):
        lines.extend(["", "## Nguyên nhân khả dĩ cần kiểm chứng"])
        for item in metrics["root_causes"]:
            href = item.get("href")
            next_check = f"[{item['next_check']}]({href})" if href else item["next_check"]
            lines.extend(
                [
                    "",
                    f"- Dấu hiệu từ dữ liệu: {item['evidence']}",
                    f"- Giả thuyết: {item['hypothesis']}",
                    f"- Cần kiểm chứng: {next_check}",
                ]
            )
    if watchlist:
        lines.extend(
            [
                "",
                "## Danh sách cần can thiệp",
                *(
                    f"- {item['student_code']} - {item['full_name']}: {item['reason']} ({item['grade']})"
                    for item in watchlist[:10]
                ),
            ]
        )
    if metrics.get("action_plan"):
        lines.extend(["", "## Kế hoạch hành động"])
        lines.extend(["", "| Phụ trách | Hành động | Lý do | Ưu tiên | Hạn | Link |", "|---|---|---|---|---|---|"])
        for item in metrics["action_plan"]:
            href = item.get("href") or ""
            link = f"[Mở]({href})" if href else "-"
            lines.append(
                f"| {item.get('owner', '-')} | {item.get('task', '-')} | {item.get('reason', '-')} | "
                f"{item.get('priority', '-')} | {item.get('deadline', '-')} | {link} |"
            )
    else:
        lines.extend(["", "## Hành động đề xuất", *(f"- {item}" for item in actions)])
    return _join_lines(lines)


_LLM_SYSTEM_PROMPT = (
    "Bạn là chuyên gia phân tích & đảm bảo chất lượng giáo dục đại học theo chuẩn OBE "
    "(Outcome-Based Education) tại Việt Nam. Nhiệm vụ: viết phần diễn giải cho một báo cáo học vụ "
    "bằng tiếng Việt tự nhiên, mạch lạc, đúng văn phong báo cáo hành chính - học thuật, "
    "KHÔNG liệt kê khô khan như máy.\n\n"
    "QUY TẮC BẮT BUỘC:\n"
    "1. CHỈ dùng số liệu có trong JSON đầu vào. TUYỆT ĐỐI không bịa thêm chỉ số, tên, con số.\n"
    "2. Viết thành câu hoàn chỉnh, có chủ ngữ - vị ngữ, có nhận định và liên hệ nguyên nhân; "
    "không viết kiểu 'X = Y'.\n"
    "3. Nếu có dữ liệu CLO (clo_attainment, weak_clos, clo_components): giải thích VÌ SAO CLO yếu "
    "dựa trên điểm thành phần, nêu hướng cải thiện cụ thể.\n"
    "4. Nếu có dữ liệu PLO (plo_attainment): nhận xét sức khỏe chương trình theo chuẩn kiểm định, "
    "chỉ rõ PLO nào rủi ro.\n"
    "5. Mỗi hành động phải cụ thể: AI làm – LÀM GÌ – MỨC ƯU TIÊN.\n"
    "6. Nếu dữ liệu thiếu/cỡ mẫu nhỏ, phải nói rõ là chưa đủ cơ sở kết luận.\n\n"
    "ĐỊNH DẠNG ĐẦU RA: trả về DUY NHẤT một object JSON hợp lệ (không kèm văn bản nào khác, "
    "không bọc trong ```), gồm đúng các khóa sau:\n"
    "{\n"
    '  "summary": "đoạn 3-5 câu tóm tắt điều hành, nêu kết luận chính + con số quan trọng + điểm nghẽn + hướng xử lý",\n'
    '  "good_signals": ["câu hoàn chỉnh", ...],\n'
    '  "issues": ["câu hoàn chỉnh nêu vấn đề + nguyên nhân", ...],\n'
    '  "risks": ["câu hoàn chỉnh nêu rủi ro + hệ quả nếu không xử lý", ...],\n'
    '  "root_causes": [{"evidence": "dấu hiệu từ dữ liệu", "hypothesis": "giả thuyết cần kiểm chứng", "next_check": "cần mở dữ liệu nào", "href": "/manager/analytics/... hoặc null"}],\n'
    '  "deep_insights": [{"title": "tên insight", "finding": "nhận định", "evidence": "số liệu", "action": "hành động", "href": "/manager/analytics/... hoặc null"}],\n'
    '  "action_plan": [{"owner": "ai phụ trách", "task": "làm gì", "reason": "vì sao", "priority": "Cao/Trung bình/Thấp", "deadline": "7 ngày/14 ngày/30 ngày", "href": "/manager/analytics/... hoặc null"}],\n'
    '  "actions": ["câu hoàn chỉnh tóm tắt action_plan để tương thích UI cũ"]\n'
    "}\n"
    "Mỗi mảng nên có 2-5 mục, ưu tiên chất lượng hơn số lượng. Không bịa số liệu ngoài JSON đầu vào."
)


def _parse_llm_json(content: str) -> dict[str, Any] | None:
    """Parse the LLM response into a dict, tolerating ```json fences and surrounding prose."""
    text = content.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if text.count("```") >= 2 else text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, ValueError):
        return None


def _clean_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _clean_dict_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [dict(item) for item in value if isinstance(item, dict)]


_NUMBER_RE = re.compile(r"(?<![\w/.-])\d+(?:[.,]\d+)?%?")
_STATIC_REPORT_NUMBERS = {"0", "1", "2", "3", "4", "5", "7", "10", "14", "30", "70"}


def _normalize_number_token(value: str) -> str:
    token = value.strip().replace("%", "").replace(",", ".")
    try:
        number = float(token)
    except ValueError:
        return token
    if number.is_integer():
        return str(int(number))
    return f"{number:.4f}".rstrip("0").rstrip(".")


def _number_tokens_from_text(value: str) -> set[str]:
    return {_normalize_number_token(match.group(0)) for match in _NUMBER_RE.finditer(value)}


def _llm_grounding_text(parsed: dict[str, Any]) -> str:
    fields = [
        parsed.get("summary"),
        parsed.get("good_signals"),
        parsed.get("issues"),
        parsed.get("risks"),
        parsed.get("root_causes"),
        parsed.get("deep_insights"),
        parsed.get("actions"),
    ]
    # Action deadlines use fixed policy labels (7/14/30 days), so only validate action evidence/reason/task text.
    action_plan = parsed.get("action_plan")
    if isinstance(action_plan, list):
        fields.append(
            [
                {
                    "owner": item.get("owner"),
                    "task": item.get("task"),
                    "reason": item.get("reason"),
                    "priority": item.get("priority"),
                }
                for item in action_plan
                if isinstance(item, dict)
            ]
        )
    return json.dumps(fields, ensure_ascii=False, default=str)


def _validate_llm_grounding(
    parsed: dict[str, Any],
    payload: ReportPayload,
    generation_tool_calls: list[dict[str, Any]],
) -> dict[str, Any]:
    """Check that numbers in LLM prose are grounded in deterministic metrics/tool outputs."""
    source_text = json.dumps(
        {
            "title": payload.get("title"),
            "summary": payload.get("summary"),
            "metrics": payload.get("metrics_json") or {},
            "tool_outputs": generation_tool_calls,
        },
        ensure_ascii=False,
        default=str,
    )
    source_numbers = _number_tokens_from_text(source_text) | _STATIC_REPORT_NUMBERS
    output_numbers = _number_tokens_from_text(_llm_grounding_text(parsed))
    ungrounded = sorted(output_numbers - source_numbers)
    return {
        "checked": True,
        "output_number_count": len(output_numbers),
        "ungrounded_numbers": ungrounded[:20],
    }


def _sync_content_markdown(payload: ReportPayload) -> ReportPayload:
    metrics = payload.get("metrics_json") or {}
    good = list(metrics.get("good_signals") or [])
    issues = list(metrics.get("issues") or [])
    risks = list(metrics.get("risks") or [])
    actions = list(metrics.get("actions") or [])
    existing = payload.get("content_markdown", "")
    clo_block = ""
    if "## Chi tiết chuẩn đầu ra (CLO)" in existing:
        clo_block = "\n\n## Chi tiết chuẩn đầu ra (CLO)" + existing.split("## Chi tiết chuẩn đầu ra (CLO)", 1)[1]
    payload["content_markdown"] = (
        _format_report(payload["title"], payload["summary"], metrics, good, issues, risks, actions) + clo_block
    )
    return payload


async def _maybe_enhance_with_llm(
    payload: ReportPayload,
    report_type: str,
    actor_role: str,
    generation_tool_calls: list[dict[str, Any]],
) -> ReportPayload:
    """Use the LLM to rewrite the narrative fields in natural Vietnamese.

    The model returns structured JSON whose fields (summary, good_signals, issues, risks, actions)
    REPLACE the rule-based ones — these are exactly what the report document renders — while every
    numeric metric in metrics_json is preserved untouched. Falls back to the deterministic narrative
    on any error or when no LLM key is configured.
    """
    settings = get_settings()
    if not settings.llm_api_key or settings.llm_provider.lower().strip() != "openai":
        payload["metrics_json"] = {
            **payload["metrics_json"],
            "llm_enhanced": False,
            "llm_generation_stage": "skipped_no_openai_key",
        }
        return payload

    try:
        llm_kwargs: dict[str, Any] = {
            "model": settings.llm_model,
            "api_key": settings.llm_api_key,
            "temperature": 0,
            "model_kwargs": {"response_format": {"type": "json_object"}},
        }
        if settings.llm_base_url:
            llm_kwargs["base_url"] = settings.llm_base_url
        llm = ChatOpenAI(**llm_kwargs)
        messages = [
            SystemMessage(content=_LLM_SYSTEM_PROMPT),
            HumanMessage(
                content=json.dumps(
                    {
                        "report_type": report_type,
                        "actor_role": actor_role,
                        "title": payload["title"],
                        "rule_based_summary": payload["summary"],
                        "metrics": payload["metrics_json"],
                        "tool_outputs": generation_tool_calls,
                        "required_report_format": {
                            "summary": "executive narrative, 3-5 complete Vietnamese sentences",
                            "good_signals": "2-5 complete Vietnamese observations",
                            "issues": "2-5 complete Vietnamese problem statements with evidence",
                            "risks": "2-5 complete Vietnamese risk statements with consequence",
                            "root_causes": "2-5 objects with evidence/hypothesis/next_check/href",
                            "deep_insights": "2-5 objects with title/finding/evidence/action/href",
                            "action_plan": "2-5 objects with owner/task/reason/priority/deadline/href",
                            "actions": "2-5 compatibility strings summarizing action_plan",
                        },
                    },
                    ensure_ascii=False,
                )
            ),
        ]
        response = await llm.ainvoke(messages)
        parsed = _parse_llm_json(str(response.content))
        if not parsed:
            raise ValueError("LLM did not return parseable JSON")
        grounding = _validate_llm_grounding(parsed, payload, generation_tool_calls)
        if grounding["ungrounded_numbers"]:
            raise ValueError(f"LLM returned ungrounded numbers: {grounding['ungrounded_numbers']}")

        summary = str(parsed.get("summary") or "").strip() or payload["summary"]
        good = _clean_str_list(parsed.get("good_signals")) or list(payload["metrics_json"].get("good_signals") or [])
        issues = _clean_str_list(parsed.get("issues")) or list(payload["metrics_json"].get("issues") or [])
        risks = _clean_str_list(parsed.get("risks")) or list(payload["metrics_json"].get("risks") or [])
        root_causes = _clean_dict_list(parsed.get("root_causes")) or list(payload["metrics_json"].get("root_causes") or [])
        deep_insights = _clean_dict_list(parsed.get("deep_insights")) or list(
            payload["metrics_json"].get("deep_insights") or []
        )
        action_plan = _clean_dict_list(parsed.get("action_plan")) or list(payload["metrics_json"].get("action_plan") or [])
        actions = _clean_str_list(parsed.get("actions"))
        if not actions and action_plan:
            actions = [_action_text(item) for item in action_plan if {"owner", "task", "reason", "priority", "deadline"} <= item.keys()]
        if not actions:
            actions = list(payload["metrics_json"].get("actions") or [])

        # Merge LLM prose into the fields the document renders; keep all numeric metrics intact.
        metrics = {**payload["metrics_json"]}
        metrics.update(
            good_signals=good,
            issues=issues,
            risks=risks,
            root_causes=root_causes,
            deep_insights=deep_insights,
            action_plan=action_plan,
            actions=actions,
            llm_enhanced=True,
            llm_generation_stage="tool_outputs_to_llm_to_report",
            llm_grounding=grounding,
        )
        payload["summary"] = summary
        payload["metrics_json"] = metrics
        # Rebuild the markdown export from the LLM-written fields so it matches the document.
        clo_section = payload.get("content_markdown", "")
        clo_block = ""
        if "## Chi tiết chuẩn đầu ra (CLO)" in clo_section:
            clo_block = "\n\n" + clo_section.split("## Chi tiết chuẩn đầu ra (CLO)", 1)[1]
            clo_block = "\n\n## Chi tiết chuẩn đầu ra (CLO)" + clo_block
        payload["content_markdown"] = (
            _format_report(payload["title"], summary, metrics, good, issues, risks, actions) + clo_block
        )
    except Exception as exc:
        logger.exception("LLM report enhancement failed; falling back to deterministic report")
        payload["metrics_json"] = {
            **payload["metrics_json"],
            "llm_enhanced": False,
            "llm_generation_stage": "failed_fallback",
            "llm_error": str(exc)[:500],
        }
    return payload

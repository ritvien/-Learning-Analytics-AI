"""Report generation service with deterministic analytics and optional LLM polish.

The numbers are always computed from the database first. If an LLM key is configured,
the model may rewrite the narrative from those facts, but it must not invent metrics.
"""

from __future__ import annotations

import json
import logging
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


def _apply_clo_enrichment(payload: ReportPayload, enrichment: dict[str, Any]) -> ReportPayload:
    """Merge CLO attainment + component detail + improvement suggestions into a section report."""
    metrics = {**payload["metrics_json"]}
    metrics["clo_attainment"] = enrichment["clo_attainment"]
    metrics["clo_components"] = enrichment.get("clo_components", {})
    metrics["weak_clo_count"] = len(enrichment["weak_clos"])
    metrics["issues"] = enrichment["improvement_issues"] + list(metrics.get("issues") or [])
    metrics["actions"] = enrichment["improvement_actions"] + list(metrics.get("actions") or [])
    payload["metrics_json"] = metrics
    clo_section = _format_clo_section(enrichment)
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
            lines.append(
                f"**{code}**{f' — {name}' if name else ''}: "
                f"chỉ có **{pct}%** sinh viên đạt chuẩn "
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


async def generate_report(
    db: AsyncSession,
    report_type: str,
    actor_role: str,
    generated_by: str | None,
    scope_type: str | None = None,
    scope_id: str | None = None,
    semester_id: int | None = None,
) -> Report:
    """Generate, optionally enhance, persist, and return a report."""
    data = await _load_data(db)
    generation_tool_calls: list[dict[str, Any]] = [
        {
            "tool_name": "load_report_dataset",
            "status": "success",
            "tool_output": {
                "students": len(data["students"]),
                "enrollments": len(data["enrollments"]),
                "sections": len(data["sections"]),
                "semesters": len(data["semesters"]),
                "courses": len(data["courses"]),
                "programs": len(data["programs"]),
                "departments": len(data["departments"]),
                "teachers": len(data["teachers"]),
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
                payload = _apply_clo_enrichment(payload, enrichment)
                generation_tool_calls.append(
                    {
                        "tool_name": "apply_clo_enrichment",
                        "status": "success",
                        "tool_output": {"enrichment": enrichment},
                    }
                )
    else:
        raise ValueError("Unsupported report type")

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

    generation_tool_calls = _json_safe(generation_tool_calls)
    payload["metrics_json"] = {
        **payload["metrics_json"],
        "generation_tool_calls": generation_tool_calls,
    }

    payload = await _maybe_enhance_with_llm(payload, report_type, actor_role, generation_tool_calls)
    report = Report(
        id=str(uuid4()),
        report_type=report_type,
        actor_role=actor_role,
        scope_type=scope_type,
        scope_id=scope_id,
        generated_by=generated_by,
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
    active_students = [student for student in students if student.status == "active"]
    valid = [enrollment for enrollment in enrollments if enrollment.is_passed is not None]
    passed_count = len([item for item in valid if item.is_passed])
    failed_count = len(valid) - passed_count
    pass_rate = _pct(passed_count, len(valid))
    avg_gpa = _avg([float(student.gpa_cumulative) for student in active_students if student.gpa_cumulative is not None])
    at_risk = [
        student for student in active_students if student.gpa_cumulative is not None and student.gpa_cumulative < 2
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
    }
    good = [
        f"Hệ thống đang có {len(active_students)} sinh viên active trên {len(programs)} chương trình.",
        f"GPA trung bình toàn trường là {avg_gpa}, đủ dùng để theo dõi sức khỏe học vụ ở mức tổng quan.",
    ]
    issues = [
        f"Có {failed_count} lượt học phần chưa đạt trong dữ liệu đã hoàn tất.",
        f"Có {len(at_risk)} sinh viên GPA dưới 2.0 cần đưa vào danh sách theo dõi.",
    ]
    risks = [
        f"Mức rủi ro hiện tại: {risk_level}.",
        "Nếu các học phần có tỉ lệ trượt cao không được tách ra, báo cáo toàn trường sẽ che mất điểm nghẽn thật.",
    ]
    actions = [
        "Mở báo cáo theo chương trình cho các ngành có nhiều sinh viên GPA dưới 2.0.",
        "Ưu tiên kiểm tra các lớp học phần có pass rate dưới 70% trước khi chốt kỳ tiếp theo.",
        "Giao cố vấn học tập xác nhận nguyên nhân: thiếu nền tảng, vắng học, hoặc cách đánh giá chưa phù hợp.",
    ]
    summary = (
        f"Toàn trường có pass rate {pass_rate}% với {len(at_risk)} sinh viên nguy cơ. "
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
            "course": course_map.get(course_id).name if course_map.get(course_id) else str(course_id),
            "failed": failed,
        }
        for course_id, failed in sorted(failed_by_course.items(), key=lambda item: item[1], reverse=True)[:5]
    ]
    weak_programs = [
        {
            "program": program_map.get(program_id).name if program_map.get(program_id) else str(program_id),
            "failed": failed,
        }
        for program_id, failed in sorted(failed_by_program.items(), key=lambda item: item[1], reverse=True)[:5]
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
    }
    good = [
        f"Khoa {department.name} co {len(department_programs)} nganh va {len(department_students)} sinh vien active.",
        f"Pass rate hien tai la {pass_rate}%, can doc cung cac nganh va mon co nhieu luot truot.",
    ]
    issues = [
        f"Co {len(at_risk_students)} sinh vien GPA duoi 2.0 trong pham vi khoa.",
        "Nhom mon nghẽn chinh: "
        + (", ".join(f"{item['course']} ({item['failed']} luot)" for item in bottlenecks) or "chua co du lieu truot"),
    ]
    risks = [
        f"Muc rui ro khoa: {risk_level}.",
        "Neu khong tach theo nganh va mon, khoa co the bo sot diem nghẽn trong chuong trinh dao tao.",
    ]
    actions = [
        "Truong khoa uu tien review cac nganh co nhieu luot truot va danh sach sinh vien GPA duoi 2.0.",
        "Phan cong truong nganh lam viec voi giang vien cac mon nghẽn trong ky gan nhat.",
        "Kiem tra lai ma tran CLO/PLO cua cac mon co fail rate cao de tim chuan dau ra dang yeu.",
    ]
    summary = (
        f"Khoa {department.name} co pass rate {pass_rate}%, GPA trung binh {avg_gpa}, "
        f"{len(at_risk_students)} sinh vien nguy co. Muc rui ro: {risk_level}."
    )
    content = _format_report(
        f"Bao cao suc khoe khoa: {department.name}",
        summary,
        metrics,
        good,
        issues,
        risks,
        actions,
    )
    return {
        "title": f"Bao cao suc khoe khoa - {department.name}",
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
    bottlenecks = [
        {
            "course": course_map.get(course_id).name if course_map.get(course_id) else str(course_id),
            "failed": failed,
        }
        for course_id, failed in sorted(failed_by_course.items(), key=lambda item: item[1], reverse=True)[:5]
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
    }
    good = [
        f"Ngành {program.name} có {len(program_students)} sinh viên active, đủ mẫu để theo dõi xu hướng.",
        f"Pass rate hiện tại là {pass_rate}%, cần đọc cùng nhóm môn đang gây trượt để không kết luận quá rộng.",
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
    actions = [
        "Tách danh sách sinh viên GPA dưới 2.0 để cố vấn gọi theo nhóm nguyên nhân.",
        "Làm việc với giảng viên các môn nghẽn để xem phân bố điểm thành phần và điều kiện dự thi.",
        "So sánh lại pass rate theo khóa để biết rủi ro tập trung ở một khóa hay lan toàn ngành.",
    ]
    summary = (
        f"Ngành {program.name} có pass rate {pass_rate}%, GPA trung bình {avg_gpa}, "
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
    for section in course_sections:
        section_rows = [item for item in rows if item.section_id == section.id]
        section_passed = len([item for item in section_rows if item.is_passed])
        section_pass_rate = _pct(section_passed, len(section_rows))
        if section_rows and section_pass_rate < 70:
            teacher = teacher_map.get(section.teacher_id) if section.teacher_id is not None else None
            weak_sections.append(
                {
                    "section": section.section_code,
                    "teacher": teacher.full_name if teacher else "Chua gan giang vien",
                    "pass_rate": section_pass_rate,
                    "sample": len(section_rows),
                }
            )
    weak_sections.sort(key=lambda item: item["pass_rate"])

    enrichment = _build_clo_enrichment(clo_rows or [])
    weak_clos = enrichment.get("weak_clos", [])
    risk_level = _risk_level(pass_rate, len(weak_sections), avg_grade)
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
    }
    if enrichment:
        metrics["clo_attainment"] = enrichment["clo_attainment"]
        metrics["weak_clo_count"] = len(weak_clos)

    good = [
        f"Mon {course.name} co {len(course_sections)} lop hoc phan va {len(rows)} luot hoc phan da co ket qua.",
        f"Diem trung binh mon hien tai la {avg_grade}, pass rate la {pass_rate}%.",
    ]
    issues = []
    if weak_sections:
        issues.append(
            "Cac lop hoc phan can chu y: "
            + ", ".join(f"{item['section']} ({item['pass_rate']}%)" for item in weak_sections[:5])
        )
    else:
        issues.append("Chua thay lop hoc phan nao duoi nguong pass rate 70% trong du lieu da hoan tat.")
    if weak_clos:
        issues.append(
            "CLO chua dat nguong 70%: " + ", ".join(f"{item['code']} ({item['attainment']}%)" for item in weak_clos)
        )
    elif clo_rows:
        issues.append("Cac CLO co du lieu hien dang dat nguong theo cau hinh hien tai.")
    else:
        issues.append("Chua co du lieu CLO du de danh gia chuan dau ra mon hoc.")

    risks = [
        f"Muc rui ro mon hoc: {risk_level}.",
        "Neu cac lop yeu tap trung o cung mot thanh phan diem, can ra lai de, rubric va hoat dong on tap.",
    ]
    actions = [
        "Truong bo mon so sanh cac lop co pass rate thap voi mat bang chung cua mon.",
        "Giang vien phu trach lop yeu kiem tra diem thanh phan va danh sach sinh vien can ho tro.",
        "Cap nhat mapping thanh phan diem -> CLO neu bao cao chua co du lieu chuan dau ra.",
    ]
    if enrichment.get("improvement_actions"):
        actions = list(enrichment["improvement_actions"]) + actions

    summary = (
        f"Mon {course.name} co pass rate {pass_rate}%, diem trung binh {avg_grade}, "
        f"{len(weak_sections)} lop hoc phan can chu y. Muc rui ro: {risk_level}."
    )
    content = _format_report(
        f"Bao cao suc khoe mon hoc: {course.name}",
        summary,
        metrics,
        good,
        issues,
        risks,
        actions,
    )
    clo_section = _format_clo_section(enrichment)
    if clo_section:
        content = content + "\n\n" + clo_section
    return {
        "title": f"Bao cao suc khoe mon hoc - {course.name}",
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
        issues.append(f"Pass rate lớp chỉ đạt {pass_rate}%, thấp hơn ngưỡng an toàn 70%.")
    elif len(valid) < len(rows):
        issues.append(f"Còn {len(rows) - len(valid)} sinh viên chưa có kết quả hoàn tất.")
    else:
        issues.append("Chưa thấy dấu hiệu pass rate thấp trong dữ liệu hiện tại.")

    risks = [f"Mức rủi ro lớp: {risk_level}."]
    if risk_level == "Thấp":
        risks.append("Rủi ro chính là dữ liệu lớp quá ít hoặc chưa đủ điểm thành phần để kết luận sâu.")
    else:
        risks.append("Nhóm cận rủi ro có thể trượt nếu bài cuối kỳ hoặc điều kiện dự thi không được can thiệp sớm.")

    actions = []
    if watchlist:
        actions.append("Giảng viên lọc watchlist và liên hệ sinh viên trong tuần này.")
    else:
        actions.append("Tiếp tục theo dõi sau khi có thêm điểm thành phần hoặc kết quả học phần tiếp theo.")
    actions.extend(
        [
            "Kiểm tra điểm thành phần để biết sinh viên yếu ở chuyên cần, giữa kỳ hay cuối kỳ.",
            "Nếu nhiều sinh viên cùng thấp ở một phần đánh giá, cần rà lại đề, rubric hoặc hoạt động ôn tập.",
        ]
    )
    summary = (
        f"Lớp {section.section_code} có pass rate {pass_rate}%, điểm trung bình {avg_grade}, "
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
        *(f"- {key}: {value}" for key, value in metrics.items() if key not in {"watchlist", "bottlenecks"}),
    ]
    if metrics.get("bottlenecks"):
        lines.extend(
            [
                "",
                "## Môn nghẽn",
                *(f"- {item['course']}: {item['failed']} lượt chưa đạt" for item in metrics["bottlenecks"]),
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
    '  "summary": "đoạn 2-4 câu tóm tắt điều hành, nêu kết luận chính + con số quan trọng",\n'
    '  "good_signals": ["câu hoàn chỉnh", ...],\n'
    '  "issues": ["câu hoàn chỉnh nêu vấn đề + nguyên nhân", ...],\n'
    '  "risks": ["câu hoàn chỉnh nêu rủi ro + hệ quả nếu không xử lý", ...],\n'
    '  "actions": ["câu hoàn chỉnh: ai – làm gì – ưu tiên", ...]\n'
    "}\n"
    "Mỗi mảng nên có 2-5 mục, ưu tiên chất lượng hơn số lượng."
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
        llm = ChatOpenAI(
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            temperature=0.3,
            model_kwargs={"response_format": {"type": "json_object"}},
        )
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
                            "summary": "executive narrative, 2-4 complete Vietnamese sentences",
                            "good_signals": "2-5 complete Vietnamese observations",
                            "issues": "2-5 complete Vietnamese problem statements with evidence",
                            "risks": "2-5 complete Vietnamese risk statements with consequence",
                            "actions": "2-5 concrete actions with owner/action/priority",
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

        summary = str(parsed.get("summary") or "").strip() or payload["summary"]
        good = _clean_str_list(parsed.get("good_signals")) or list(payload["metrics_json"].get("good_signals") or [])
        issues = _clean_str_list(parsed.get("issues")) or list(payload["metrics_json"].get("issues") or [])
        risks = _clean_str_list(parsed.get("risks")) or list(payload["metrics_json"].get("risks") or [])
        actions = _clean_str_list(parsed.get("actions")) or list(payload["metrics_json"].get("actions") or [])

        # Merge LLM prose into the fields the document renders; keep all numeric metrics intact.
        metrics = {**payload["metrics_json"]}
        metrics.update(
            good_signals=good,
            issues=issues,
            risks=risks,
            actions=actions,
            llm_enhanced=True,
            llm_generation_stage="tool_outputs_to_llm_to_report",
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

"""Report generation service with deterministic analytics and optional LLM polish.

The numbers are always computed from the database first. If an LLM key is configured,
the model may rewrite the narrative from those facts, but it must not invent metrics.
"""

from __future__ import annotations

import json
import logging
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


async def _fetch_clo_breakdown(db: AsyncSession, course_id: int) -> list[dict[str, Any]]:
    """Fetch per-CLO attainment rows for a course (raw, may be empty)."""
    result = await db.execute(
        _CLO_BREAKDOWN_SQL, {"course_id": course_id, "threshold": CLO_ACHIEVED_THRESHOLD}
    )
    return [dict(row) for row in result.mappings().all()]


def _build_clo_enrichment(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Pure transform: per-CLO rows → attainment map + course-improvement suggestions.

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
    improvement_issues = [
        f"{item['code']} chỉ đạt {item['attainment']}% (dưới ngưỡng 70%)." for item in weak
    ]
    improvement_actions = [
        (
            f"Cải thiện {item['code']}"
            + (f" ({item['name']})" if item['name'] else "")
            + f": rà lại rubric và đề của các bài đánh giá gắn với CLO này (hiện đạt {item['attainment']}%), "
            "bổ sung hoạt động luyện tập bám sát chuẩn đầu ra cho lần dạy sau."
        )
        for item in weak
    ]
    return {
        "clo_attainment": clo_attainment,
        "weak_clos": weak,
        "improvement_issues": improvement_issues,
        "improvement_actions": improvement_actions,
    }


def _apply_clo_enrichment(payload: ReportPayload, enrichment: dict[str, Any]) -> ReportPayload:
    """Merge CLO attainment + improvement suggestions into a section report payload."""
    metrics = {**payload["metrics_json"]}
    metrics["clo_attainment"] = enrichment["clo_attainment"]
    metrics["weak_clo_count"] = len(enrichment["weak_clos"])
    metrics["issues"] = enrichment["improvement_issues"] + list(metrics.get("issues") or [])
    metrics["actions"] = enrichment["improvement_actions"] + list(metrics.get("actions") or [])
    payload["metrics_json"] = metrics
    return payload


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
) -> Report:
    """Generate, optionally enhance, persist, and return a report."""
    data = await _load_data(db)
    if report_type == "school_overview":
        payload = _school_overview(data)
        scope_type = scope_type or "school"
    elif report_type == "program_health":
        payload = _program_health(data, int(scope_id or 0))
        scope_type = scope_type or "program"
    elif report_type == "section_intervention":
        section_id = int(scope_id or 0)
        payload = _section_intervention(data, section_id)
        scope_type = scope_type or "section"
        # T32 — enrich with per-CLO attainment + course-improvement suggestions.
        section = next((item for item in data["sections"] if item.id == section_id), None)
        if section is not None:
            try:
                enrichment = _build_clo_enrichment(await _fetch_clo_breakdown(db, section.course_id))
            except Exception:
                logger.exception("CLO breakdown failed; skipping course-improvement enrichment")
                enrichment = {}
            if enrichment:
                payload = _apply_clo_enrichment(payload, enrichment)
    else:
        raise ValueError("Unsupported report type")

    payload = await _maybe_enhance_with_llm(payload, report_type, actor_role)
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
        student
        for student in active_students
        if student.gpa_cumulative is not None and student.gpa_cumulative < 2
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


def _program_health(data: dict[str, list[Any]], program_id: int) -> ReportPayload:
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
        student
        for student in students
        if student.program_id == program_id and student.status == "active"
    ]
    student_ids = {student.id for student in program_students}
    rows = [item for item in enrollments if item.student_id in student_ids and item.is_passed is not None]
    passed_count = len([item for item in rows if item.is_passed])
    pass_rate = _pct(passed_count, len(rows))
    avg_gpa = _avg([
        float(student.gpa_cumulative)
        for student in program_students
        if student.gpa_cumulative is not None
    ])
    at_risk_students = [
        student
        for student in program_students
        if student.gpa_cumulative is not None and student.gpa_cumulative < 2
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
    return {
        "title": f"Báo cáo sức khỏe ngành - {program.name}",
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
            watchlist.append({
                "student_code": student.student_code if student else str(row.student_id),
                "full_name": student.full_name if student else "Unknown",
                "grade": grade,
                "reason": "Không đạt" if row.is_passed is False else "Cận rủi ro",
            })
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
    actions.extend([
        "Kiểm tra điểm thành phần để biết sinh viên yếu ở chuyên cần, giữa kỳ hay cuối kỳ.",
        "Nếu nhiều sinh viên cùng thấp ở một phần đánh giá, cần rà lại đề, rubric hoặc hoạt động ôn tập.",
    ])
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
        lines.extend([
            "",
            "## Môn nghẽn",
            *(f"- {item['course']}: {item['failed']} lượt chưa đạt" for item in metrics["bottlenecks"]),
        ])
    if watchlist:
        lines.extend([
            "",
            "## Danh sách cần can thiệp",
            *(
                f"- {item['student_code']} - {item['full_name']}: {item['reason']} ({item['grade']})"
                for item in watchlist[:10]
            ),
        ])
    lines.extend(["", "## Hành động đề xuất", *(f"- {item}" for item in actions)])
    return _join_lines(lines)


async def _maybe_enhance_with_llm(payload: ReportPayload, report_type: str, actor_role: str) -> ReportPayload:
    settings = get_settings()
    if not settings.llm_api_key or settings.llm_provider.lower().strip() != "openai":
        payload["metrics_json"] = {**payload["metrics_json"], "llm_enhanced": False}
        return payload

    try:
        llm = ChatOpenAI(model=settings.llm_model, api_key=settings.llm_api_key, temperature=0.2)
        messages = [
            SystemMessage(content=(
                "Bạn là analyst học vụ. Viết báo cáo tiếng Việt ngắn, rõ, có nhận định. "
                "Chỉ dùng số liệu trong JSON. Không bịa chỉ số. Luôn có các mục: "
                "Kết luận nhanh, Tín hiệu tốt, Điểm chưa tốt, Rủi ro cần chú ý, Hành động đề xuất."
            )),
            HumanMessage(content=json.dumps({
                "report_type": report_type,
                "actor_role": actor_role,
                "title": payload["title"],
                "summary": payload["summary"],
                "metrics": payload["metrics_json"],
            }, ensure_ascii=False)),
        ]
        response = await llm.ainvoke(messages)
        content = str(response.content).strip()
        if content:
            payload["content_markdown"] = content
            payload["metrics_json"] = {**payload["metrics_json"], "llm_enhanced": True}
    except Exception:
        logger.exception("LLM report enhancement failed; falling back to deterministic report")
        payload["metrics_json"] = {**payload["metrics_json"], "llm_enhanced": False}
    return payload

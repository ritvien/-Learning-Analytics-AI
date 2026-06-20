"""Academic tree endpoints with roll-up metrics for dashboard nodes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.access_control import is_admin, user_department_ids
from app.dependencies import CurrentUser, DBSession
from app.models.academic import Course, Department, Program
from app.models.people import Student
from app.models.teaching import Enrollment, Section

router = APIRouter()


TreeNode = dict[str, Any]


def _pct(part: int, total: int) -> float:
    return round(part / total * 100, 1) if total else 0.0


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


def _health_score(avg_gpa: float, fail_rate: float) -> float:
    gpa_score = min(max(avg_gpa / 4 * 100, 0), 100)
    pass_score = max(0, 100 - fail_rate)
    return round((gpa_score * 0.5) + (pass_score * 0.5), 2)


def _metrics(students: list[Student], enrollments: list[Enrollment], courses: list[Course]) -> dict[str, Any]:
    completed = [item for item in enrollments if item.is_passed is not None]
    passed = [item for item in completed if item.is_passed]
    failed = len(completed) - len(passed)
    grades = [float(item.final_grade) for item in completed if item.final_grade is not None]
    avg_gpa = _avg([float(item.gpa_cumulative) for item in students if item.gpa_cumulative is not None])
    fail_rate = _pct(failed, len(completed))
    return {
        "student_count": len(students),
        "course_count": len(courses),
        "completed_enrollments": len(completed),
        "passed_enrollments": len(passed),
        "failed_enrollments": failed,
        "pass_rate": _pct(len(passed), len(completed)),
        "fail_rate": fail_rate,
        "avg_gpa": avg_gpa,
        "avg_grade": _avg(grades),
        "health_score": _health_score(avg_gpa, fail_rate),
    }


async def _load_visible_tree_data(db: DBSession, current_user: CurrentUser) -> dict[str, list[Any]]:
    department_scope = set[int]()
    if not is_admin(current_user):
        department_scope = await user_department_ids(db, current_user)

    department_query = select(Department).where(Department.is_active == True)  # noqa: E712
    program_query = select(Program).where(Program.is_active == True)  # noqa: E712
    course_query = select(Course).options(selectinload(Course.programs)).where(Course.is_active == True)  # noqa: E712

    if department_scope:
        department_query = department_query.where(Department.id.in_(department_scope))
        program_query = program_query.where(Program.department_id.in_(department_scope))
        course_query = course_query.where(Course.department_id.in_(department_scope))

    departments = list((await db.execute(department_query.order_by(Department.name))).scalars().all())
    programs = list((await db.execute(program_query.order_by(Program.name))).scalars().all())
    courses = list((await db.execute(course_query.order_by(Course.name))).unique().scalars().all())

    visible_program_ids = {item.id for item in programs}
    visible_course_ids = {item.id for item in courses}
    students = (
        list((await db.execute(select(Student).where(Student.program_id.in_(visible_program_ids)))).scalars().all())
        if visible_program_ids
        else []
    )
    sections = (
        list((await db.execute(select(Section).where(Section.course_id.in_(visible_course_ids)))).scalars().all())
        if visible_course_ids
        else []
    )
    section_ids = {item.id for item in sections}
    enrollments = (
        list((await db.execute(select(Enrollment).where(Enrollment.section_id.in_(section_ids)))).scalars().all())
        if section_ids
        else []
    )

    return {
        "departments": departments,
        "programs": programs,
        "courses": courses,
        "students": students,
        "sections": sections,
        "enrollments": enrollments,
    }


def _build_tree(data: dict[str, list[Any]]) -> TreeNode:
    departments: list[Department] = data["departments"]
    programs: list[Program] = data["programs"]
    courses: list[Course] = data["courses"]
    students: list[Student] = data["students"]
    sections: list[Section] = data["sections"]
    enrollments: list[Enrollment] = data["enrollments"]

    students_by_program: dict[int, list[Student]] = {}
    for student in students:
        students_by_program.setdefault(student.program_id, []).append(student)

    sections_by_course: dict[int, list[Section]] = {}
    for section in sections:
        sections_by_course.setdefault(section.course_id, []).append(section)

    enrollments_by_section: dict[int, list[Enrollment]] = {}
    for enrollment in enrollments:
        enrollments_by_section.setdefault(enrollment.section_id, []).append(enrollment)

    programs_by_department: dict[int, list[Program]] = {}
    for program in programs:
        programs_by_department.setdefault(program.department_id, []).append(program)

    course_ids_by_program: dict[int, set[int]] = {}
    for course in courses:
        for program in course.programs:
            course_ids_by_program.setdefault(program.id, set()).add(course.id)

    course_map = {course.id: course for course in courses}
    nodes: list[TreeNode] = []

    for department in departments:
        department_programs = programs_by_department.get(department.id, [])
        department_students: list[Student] = []
        department_courses: dict[int, Course] = {}
        department_enrollments: list[Enrollment] = []
        program_nodes: list[TreeNode] = []

        for program in department_programs:
            program_students = students_by_program.get(program.id, [])
            program_courses = [
                course_map[cid] for cid in course_ids_by_program.get(program.id, set()) if cid in course_map
            ]
            program_course_ids = {course.id for course in program_courses}
            program_section_ids = {section.id for section in sections if section.course_id in program_course_ids}
            program_enrollments = [
                item for section_id in program_section_ids for item in enrollments_by_section.get(section_id, [])
            ]
            course_nodes: list[TreeNode] = []

            for course in sorted(program_courses, key=lambda item: item.name):
                course_section_ids = {section.id for section in sections_by_course.get(course.id, [])}
                course_enrollments = [
                    item for section_id in course_section_ids for item in enrollments_by_section.get(section_id, [])
                ]
                course_student_ids = {item.student_id for item in course_enrollments}
                course_students = [item for item in students if item.id in course_student_ids]
                course_nodes.append(
                    {
                        "id": course.id,
                        "type": "course",
                        "code": course.code,
                        "label": course.name,
                        "metrics": _metrics(course_students, course_enrollments, [course]),
                        "children": [],
                    }
                )

            department_students.extend(program_students)
            department_courses.update({course.id: course for course in program_courses})
            department_enrollments.extend(program_enrollments)
            program_nodes.append(
                {
                    "id": program.id,
                    "type": "program",
                    "code": program.code,
                    "label": program.name,
                    "metrics": _metrics(program_students, program_enrollments, program_courses),
                    "children": course_nodes,
                }
            )

        nodes.append(
            {
                "id": department.id,
                "type": "department",
                "code": department.code,
                "label": department.name,
                "metrics": _metrics(department_students, department_enrollments, list(department_courses.values())),
                "children": program_nodes,
            }
        )

    return {
        "id": "school",
        "type": "school",
        "code": "ROOT",
        "label": "Academic Tree",
        "metrics": _metrics(students, enrollments, courses),
        "children": nodes,
    }


def _find_node(node: TreeNode, node_type: str, node_id: str) -> TreeNode | None:
    if node["type"] == node_type and str(node["id"]) == node_id:
        return node
    for child in node.get("children", []):
        found = _find_node(child, node_type, node_id)
        if found is not None:
            return found
    return None


@router.get("")
async def get_academic_tree(db: DBSession, current_user: CurrentUser) -> TreeNode:
    """Return Department -> Program -> Course tree with roll-up metrics."""
    return _build_tree(await _load_visible_tree_data(db, current_user))


@router.get("/{node_type}/{node_id}/metrics")
async def get_tree_node_metrics(
    node_type: str, node_id: str, db: DBSession, current_user: CurrentUser
) -> dict[str, Any]:
    """Return metrics for one tree node."""
    tree = _build_tree(await _load_visible_tree_data(db, current_user))
    node = _find_node(tree, node_type, node_id)
    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tree node not found")
    return {"id": node["id"], "type": node["type"], "label": node["label"], "metrics": node["metrics"]}

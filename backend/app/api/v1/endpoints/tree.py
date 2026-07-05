"""Academic tree endpoints with roll-up metrics for dashboard nodes."""

from __future__ import annotations

from time import monotonic
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.dependencies import CurrentUser, DBSession
from app.models.academic import Course, Department, Program, Specialization
from app.models.people import Student
from app.models.teaching import Enrollment, Section

router = APIRouter()


TreeNode = dict[str, Any]
TREE_CACHE_TTL_SECONDS = get_settings().tree_cache_ttl_seconds
_TREE_CACHE: dict[str, tuple[float, TreeNode]] = {}

# _load_visible_tree_data ignores the user entirely, so the tree is identical
# for every role — one shared entry lets a background prewarm serve everyone.
_TREE_CACHE_KEY = "institution_overview"


def _get_cached_tree(current_user: CurrentUser) -> TreeNode | None:
    _ = current_user
    cached = _TREE_CACHE.get(_TREE_CACHE_KEY)
    if cached is None:
        return None
    created_at, tree = cached
    if monotonic() - created_at > TREE_CACHE_TTL_SECONDS:
        _TREE_CACHE.pop(_TREE_CACHE_KEY, None)
        return None
    return tree


def _set_cached_tree(current_user: CurrentUser, tree: TreeNode) -> TreeNode:
    _ = current_user
    _TREE_CACHE[_TREE_CACHE_KEY] = (monotonic(), tree)
    return tree


def invalidate_tree_cache() -> None:
    """Drop the shared tree so the next read (or prewarm sweep) rebuilds it."""
    _TREE_CACHE.clear()


async def prewarm_academic_tree(db: DBSession, current_user: CurrentUser) -> None:
    """Force-rebuild the shared tree; called by the dashboard prewarm worker."""
    _set_cached_tree(current_user, _build_tree(await _load_visible_tree_data(db, current_user)))


def _pct(part: int, total: int) -> float:
    return round(part / total * 100, 1) if total else 0.0


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


def _health_score(avg_gpa: float, fail_rate: float) -> float:
    gpa_score = min(max(avg_gpa / 4 * 100, 0), 100)
    pass_score = max(0, 100 - fail_rate)
    return round((gpa_score * 0.5) + (pass_score * 0.5), 2)


def _metrics(students: list[Student], enrollments: list[Enrollment], courses: list[Course]) -> dict[str, Any]:
    students = list({item.id: item for item in students}.values())
    enrollments = list({item.id: item for item in enrollments}.values())
    courses = list({item.id: item for item in courses}.values())
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
    _ = current_user
    department_query = select(Department).where(Department.is_active == True)  # noqa: E712
    program_query = select(Program).where(Program.is_active == True)  # noqa: E712
    specialization_query = (
        select(Specialization)
        .options(selectinload(Specialization.courses))
        .where(Specialization.is_active == True)  # noqa: E712
    )
    course_query = select(Course).options(selectinload(Course.programs)).where(Course.is_active == True)  # noqa: E712

    departments = list((await db.execute(department_query.order_by(Department.name))).scalars().all())
    programs = list((await db.execute(program_query.order_by(Program.name))).scalars().all())
    specializations = list(
        (await db.execute(specialization_query.order_by(Specialization.name))).unique().scalars().all()
    )
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
        "specializations": specializations,
        "courses": courses,
        "students": students,
        "sections": sections,
        "enrollments": enrollments,
    }


def _build_tree(data: dict[str, list[Any]]) -> TreeNode:
    departments: list[Department] = data["departments"]
    programs: list[Program] = data["programs"]
    specializations: list[Specialization] = data["specializations"]
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

    specializations_by_program: dict[int, list[Specialization]] = {}
    for specialization in specializations:
        specializations_by_program.setdefault(specialization.program_id, []).append(specialization)

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
            program_student_ids = {student.id for student in program_students}
            program_courses = [
                course_map[cid] for cid in course_ids_by_program.get(program.id, set()) if cid in course_map
            ]
            program_course_ids = {course.id for course in program_courses}
            program_section_ids = {section.id for section in sections if section.course_id in program_course_ids}
            program_enrollments = [
                item
                for section_id in program_section_ids
                for item in enrollments_by_section.get(section_id, [])
                if item.student_id in program_student_ids
            ]
            specialization_nodes: list[TreeNode] = []

            for specialization in specializations_by_program.get(program.id, []):
                if specialization.is_placeholder:
                    specialization_students = [
                        student for student in program_students if student.specialization_id is None
                    ]
                else:
                    specialization_students = [
                        student for student in program_students if student.specialization_id == specialization.id
                    ]
                specialization_student_ids = {student.id for student in specialization_students}
                specialization_courses = [
                    course
                    for course in specialization.courses
                    if course.id in program_course_ids and course.id in course_map
                ]
                specialization_enrollments: list[Enrollment] = []
                course_nodes: list[TreeNode] = []

                for course in sorted(specialization_courses, key=lambda item: item.name):
                    course_section_ids = {section.id for section in sections_by_course.get(course.id, [])}
                    course_enrollments = [
                        item
                        for section_id in course_section_ids
                        for item in enrollments_by_section.get(section_id, [])
                        if item.student_id in specialization_student_ids
                    ]
                    course_student_ids = {item.student_id for item in course_enrollments}
                    course_students = [
                        item for item in specialization_students if item.id in course_student_ids
                    ]
                    specialization_enrollments.extend(course_enrollments)
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

                specialization_nodes.append(
                    {
                        "id": specialization.id,
                        "type": "specialization",
                        "code": specialization.code,
                        "label": specialization.name,
                        "is_placeholder": specialization.is_placeholder,
                        "metrics": _metrics(
                            specialization_students,
                            specialization_enrollments,
                            specialization_courses,
                        ),
                        "children": course_nodes,
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
                    "children": specialization_nodes,
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
    """Return Department -> Program -> Specialization -> Course tree with roll-up metrics."""
    cached = _get_cached_tree(current_user)
    if cached is not None:
        return cached
    return _set_cached_tree(current_user, _build_tree(await _load_visible_tree_data(db, current_user)))


@router.get("/{node_type}/{node_id}/metrics")
async def get_tree_node_metrics(
    node_type: str, node_id: str, db: DBSession, current_user: CurrentUser
) -> dict[str, Any]:
    """Return metrics for one tree node."""
    if node_type == "course":
        data = await _load_visible_tree_data(db, current_user)
        try:
            course_id = int(node_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tree node not found") from exc
        course = next((item for item in data["courses"] if item.id == course_id), None)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tree node not found")
        section_ids = {item.id for item in data["sections"] if item.course_id == course_id}
        course_enrollments = [item for item in data["enrollments"] if item.section_id in section_ids]
        student_ids = {item.student_id for item in course_enrollments}
        course_students = [item for item in data["students"] if item.id in student_ids]
        return {
            "id": course.id,
            "type": "course",
            "label": course.name,
            "metrics": _metrics(course_students, course_enrollments, [course]),
        }

    tree = _get_cached_tree(current_user)
    if tree is None:
        tree = _set_cached_tree(current_user, _build_tree(await _load_visible_tree_data(db, current_user)))
    node = _find_node(tree, node_type, node_id)
    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tree node not found")
    return {"id": node["id"], "type": node["type"], "label": node["label"], "metrics": node["metrics"]}

"""Seed default users for all roles on startup."""

import asyncio
import logging
from uuid import uuid4

from sqlalchemy import func, or_, select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.dependencies import hash_password
from app.models.academic import Course, Department, Program
from app.models.people import HomeroomAssignment, Student, Teacher, User, UserRole
from app.models.teaching import Enrollment, Section

logger = logging.getLogger(__name__)
settings = get_settings()

DEFAULT_USERS = [
    {
        "email": "superadmin@epu.edu.vn",
        "name": "System Super Admin",
        "role": UserRole.superadmin,
    },
    {
        "email": "admin@epu.edu.vn",
        "name": "System Admin",
        "role": UserRole.admin,
    },
    {
        "email": "manager@epu.edu.vn",
        "name": "Department Manager",
        "role": UserRole.manager,
    },
    {
        "email": "lecturer@epu.edu.vn",
        "name": "Lecturer",
        "role": UserRole.lecturer,
    },
    {
        "email": "viewer@epu.edu.vn",
        "name": "Viewer",
        "role": UserRole.viewer,
    },
]

DEMO_MIN_LECTURERS_PER_DEPARTMENT = 2
DEMO_SECTIONS_PER_LECTURER = 8
DEMO_LECTURER_TITLES = ("ThS", "TS")

async def seed_default_users() -> None:
    """Create default users if they don't exist."""
    async with AsyncSessionLocal() as db:
        users_by_email: dict[str, User] = {}
        for user_data in DEFAULT_USERS:
            email = user_data["email"]
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if user is None:
                new_user = User(
                    id=str(uuid4()),
                    email=email,
                    hashed_password=hash_password(settings.seed_password),
                    full_name=user_data["name"],
                    role=user_data["role"],
                )
                db.add(new_user)
                users_by_email[email] = new_user
                logger.info(f"Created default user: {email} with role {user_data['role'].value}")
            else:
                # Startup seeding must never overwrite a password changed by an administrator.
                user.role = user_data["role"]
                users_by_email[email] = user
                logger.info(f"Kept existing default user credentials: {email}")

        await _ensure_demo_lecturer_catalog(db, users_by_email)
        await _assign_demo_scopes(db, users_by_email)

        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to seed users: {e}")


async def _assign_demo_scopes(db, users_by_email: dict[str, User]) -> None:
    """Attach scoped demo users to existing academic data."""
    department = (
        await db.execute(
            select(Department)
            .where(Department.is_active == True)  # noqa: E712
            .order_by(Department.id)
            .limit(1)
        )
    ).scalar_one_or_none()
    if department is None:
        logger.warning("Skipped demo scopes: no department data found")
        return

    manager = users_by_email.get("manager@epu.edu.vn")
    viewer = users_by_email.get("viewer@epu.edu.vn")
    lecturer_user = users_by_email.get("lecturer@epu.edu.vn")
    if manager is not None:
        manager.department_id = department.id
        manager.position = "department_manager"
    if viewer is not None:
        viewer.department_id = department.id

    if lecturer_user is None:
        return

    teacher = await _pick_or_create_demo_teacher(db, department.id)
    if teacher is None:
        lecturer_user.department_id = department.id
        logger.warning("Linked lecturer demo user to department only: no section data found")
        return

    previous_links = await db.execute(
        select(Teacher).where(Teacher.user_id == lecturer_user.id, Teacher.id != teacher.id)
    )
    for previous_teacher in previous_links.scalars().all():
        previous_teacher.user_id = None
    teacher.user_id = lecturer_user.id
    lecturer_user.department_id = teacher.department_id
    used_class_codes = {
        row[0]
        for row in (
            await db.execute(
                select(HomeroomAssignment.class_code).where(HomeroomAssignment.is_active == True)  # noqa: E712
            )
        ).all()
    }
    class_code = await _assign_homeroom_class(db, teacher, used_class_codes)
    logger.info(
        "Assigned demo scopes: manager/viewer department=%s, lecturer teacher=%s department=%s homeroom=%s",
        department.id,
        teacher.id,
        teacher.department_id,
        class_code or "-",
    )


async def _ensure_demo_lecturer_catalog(db, users_by_email: dict[str, User]) -> None:
    """Create deterministic lecturer demo accounts, section assignments, and homeroom classes."""
    departments = list(
        (
            await db.execute(
                select(Department)
                .where(Department.is_active == True)  # noqa: E712
                .order_by(Department.id)
            )
        )
        .scalars()
        .all()
    )
    if not departments:
        logger.warning("Skipped demo lecturer catalog: no active departments found")
        return

    used_class_codes = {
        row[0]
        for row in (
            await db.execute(select(HomeroomAssignment.class_code).where(HomeroomAssignment.is_active == True))  # noqa: E712
        ).all()
    }
    configs = await _build_demo_lecturer_configs(db, departments)
    for config, department in configs:
        user = await _ensure_lecturer_user(db, config["email"], config["name"], department.id)
        users_by_email[config["email"]] = user
        teacher = await _ensure_demo_teacher(db, config, department.id, user)
        sections = await _assign_sections_to_teacher(db, teacher, limit=DEMO_SECTIONS_PER_LECTURER)
        class_code = await _assign_homeroom_class(db, teacher, used_class_codes)
        if class_code:
            used_class_codes.add(class_code)
        logger.info(
            "Ensured demo lecturer catalog: teacher=%s user=%s department=%s sections=%s homeroom=%s",
            teacher.id,
            user.email,
            teacher.department_id,
            len(sections),
            class_code or "-",
        )


async def _build_demo_lecturer_configs(db, departments: list[Department]) -> list[tuple[dict[str, str], Department]]:
    configs: list[tuple[dict[str, str], Department]] = []
    for department in departments:
        programs = list(
            (
                await db.execute(
                    select(Program)
                    .where(Program.department_id == department.id)
                    .where(Program.is_active == True)  # noqa: E712
                    .order_by(Program.id)
                )
            )
            .scalars()
            .all()
        )
        lecturer_count = max(len(programs), DEMO_MIN_LECTURERS_PER_DEPARTMENT)
        for slot in range(1, lecturer_count + 1):
            program = programs[(slot - 1) % len(programs)] if programs else None
            focus = program.name if program is not None else department.name
            dept_key = department.code.lower().replace("dept", "dept-")
            configs.append(
                (
                    {
                        "email": f"demo.lecturer.{dept_key}.{slot:02d}@epu.edu.vn",
                        "code": f"DEMO-{department.code}-L{slot:02d}",
                        "name": f"Demo Lecturer {department.code}-{slot:02d}",
                        "title": DEMO_LECTURER_TITLES[(slot - 1) % len(DEMO_LECTURER_TITLES)],
                        "specialization": f"{department.code} - {focus}",
                    },
                    department,
                )
            )
    return configs


async def _ensure_lecturer_user(db, email: str, full_name: str, department_id: int) -> User:
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(
            id=str(uuid4()),
            email=email,
            hashed_password=hash_password(settings.seed_password),
            full_name=full_name,
            role=UserRole.lecturer,
            department_id=department_id,
        )
        db.add(user)
        await db.flush()
    else:
        user.hashed_password = hash_password(settings.seed_password)
        user.full_name = full_name
        user.role = UserRole.lecturer
        user.department_id = department_id
        user.is_active = True
    return user


async def _ensure_demo_teacher(db, config: dict[str, str], department_id: int, user: User) -> Teacher:
    teacher = (await db.execute(select(Teacher).where(Teacher.code == config["code"]))).scalar_one_or_none()
    if teacher is None:
        teacher = (await db.execute(select(Teacher).where(Teacher.email == config["email"]))).scalar_one_or_none()
    if teacher is None:
        teacher = Teacher(
            department_id=department_id,
            code=config["code"],
            full_name=config["name"],
            email=config["email"],
            academic_title=config["title"],
            specialization=config["specialization"],
            is_active=True,
        )
        db.add(teacher)
        await db.flush()

    previous_links = await db.execute(select(Teacher).where(Teacher.user_id == user.id, Teacher.id != teacher.id))
    for previous_teacher in previous_links.scalars().all():
        previous_teacher.user_id = None

    teacher.department_id = department_id
    teacher.user_id = user.id
    teacher.full_name = config["name"]
    teacher.email = config["email"]
    teacher.academic_title = config["title"]
    teacher.specialization = config["specialization"]
    teacher.is_active = True
    return teacher


async def _assign_sections_to_teacher(db, teacher: Teacher, limit: int) -> list[Section]:
    current_rows = await _section_rows_for_demo_assignment(
        db,
        department_id=teacher.department_id,
        teacher_id=teacher.id,
    )
    current_with_data = [section for section, completed_count in current_rows if completed_count > 0]
    current_without_data = [section for section, completed_count in current_rows if completed_count == 0]
    if len(current_with_data) >= limit:
        return current_with_data[:limit]

    unassigned_rows = await _section_rows_for_demo_assignment(
        db,
        department_id=teacher.department_id,
        unassigned_only=True,
    )
    selected = current_with_data
    for section, completed_count in unassigned_rows:
        if completed_count == 0 or len(selected) >= limit:
            continue
        section.teacher_id = teacher.id
        selected.append(section)

    for section, completed_count in unassigned_rows:
        if completed_count > 0 or len(selected) >= limit:
            continue
        section.teacher_id = teacher.id
        selected.append(section)

    return (selected + current_without_data)[:limit]


async def _section_rows_for_demo_assignment(
    db,
    *,
    department_id: int,
    teacher_id: int | None = None,
    unassigned_only: bool = False,
) -> list[tuple[Section, int]]:
    """Return sections ordered by analytics usefulness for lecturer demo accounts."""
    completed_count = func.count(Enrollment.id).label("completed_count")
    query = (
        select(Section, completed_count)
        .join(Course, Course.id == Section.course_id)
        .outerjoin(
            Enrollment,
            (Enrollment.section_id == Section.id)
            & (Enrollment.final_grade.is_not(None))
            & (Enrollment.is_passed.is_not(None)),
        )
        .where(Course.department_id == department_id)
        .group_by(Section.id)
        .order_by(completed_count.desc(), Section.id)
    )
    if teacher_id is not None:
        query = query.where(Section.teacher_id == teacher_id)
    if unassigned_only:
        query = query.where(Section.teacher_id.is_(None))

    rows = (await db.execute(query)).all()
    return [(section, int(count or 0)) for section, count in rows]


async def _assign_homeroom_class(
    db,
    teacher: Teacher,
    used_class_codes: set[str],
    min_students: int = 10,
) -> str | None:
    existing = (
        await db.execute(
            select(HomeroomAssignment)
            .where(HomeroomAssignment.teacher_id == teacher.id)
            .where(HomeroomAssignment.is_active == True)  # noqa: E712
            .order_by(HomeroomAssignment.id)
            .limit(1)
        )
    ).scalar_one_or_none()
    if existing is not None:
        if await _class_belongs_to_department(db, existing.class_code, teacher.department_id, min_students):
            return existing.class_code
        used_class_codes.discard(existing.class_code)
        await db.delete(existing)
        await db.flush()

    class_code = await _pick_homeroom_class_code(db, teacher.department_id, used_class_codes, min_students)
    if class_code is None:
        return None
    assignment = HomeroomAssignment(teacher_id=teacher.id, class_code=class_code, is_active=True)
    db.add(assignment)
    await db.flush()
    return class_code


async def _class_belongs_to_department(db, class_code: str, department_id: int, min_students: int) -> bool:
    count = (
        await db.execute(
            select(func.count(Student.id))
            .join(Program, Program.id == Student.program_id)
            .where(Student.class_code == class_code)
            .where(Student.status == "active")
            .where(Student.is_active == True)  # noqa: E712
            .where(Program.department_id == department_id)
        )
    ).scalar_one()
    return count >= min_students


async def _pick_homeroom_class_code(
    db,
    department_id: int,
    used_class_codes: set[str],
    min_students: int,
) -> str | None:
    rows = (
        await db.execute(
            select(Student.class_code)
            .join(Program, Program.id == Student.program_id)
            .where(Student.class_code.is_not(None))
            .where(Student.status == "active")
            .where(Student.is_active == True)  # noqa: E712
            .where(Program.department_id == department_id)
            .group_by(Student.class_code)
            .having(func.count(Student.id) >= min_students)
            .order_by(func.count(Student.id).desc(), Student.class_code)
        )
    ).scalars().all()
    for class_code in rows:
        if class_code and class_code not in used_class_codes:
            return class_code
    return None


async def _pick_or_create_demo_teacher(db, department_id: int) -> Teacher | None:
    teacher = (
        await db.execute(
            select(Teacher)
            .join(Section, Section.teacher_id == Teacher.id)
            .where(Teacher.department_id == department_id)
            .where(Teacher.is_active == True)  # noqa: E712
            .where(or_(Teacher.user_id.is_(None), Teacher.email == "demo.lecturer@epu.edu.vn"))
            .order_by(Teacher.department_id, Teacher.id)
            .limit(1)
        )
    ).scalar_one_or_none()

    if teacher is None:
        teacher = (
            await db.execute(
                select(Teacher)
                .where(Teacher.department_id == department_id, Teacher.is_active == True)  # noqa: E712
                .order_by(Teacher.id)
                .limit(1)
            )
        ).scalar_one_or_none()
    if teacher is None:
        teacher = Teacher(
            department_id=department_id,
            code="DEMO-LECTURER",
            full_name="Demo Lecturer",
            email="demo.lecturer@epu.edu.vn",
            academic_title="ThS",
            specialization="Academic analytics",
            is_active=True,
        )
        db.add(teacher)
        await db.flush()

    sections = await _assign_sections_to_teacher(db, teacher, limit=DEMO_SECTIONS_PER_LECTURER)
    if not sections:
        return None
    return teacher

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_default_users())

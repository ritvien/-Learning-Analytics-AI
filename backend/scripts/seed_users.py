"""Seed default users for all roles on startup."""

import asyncio
import logging
from uuid import uuid4

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.dependencies import hash_password
from app.models.academic import Course, Department
from app.models.people import Teacher, User, UserRole
from app.models.teaching import Section
from app.config import get_settings

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
                # Update password just in case it was changed
                user.hashed_password = hash_password(settings.seed_password)
                user.role = user_data["role"]
                users_by_email[email] = user
                logger.info(f"Updated default user: {email}")

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
    logger.info(
        "Assigned demo scopes: manager/viewer department=%s, lecturer teacher=%s department=%s",
        department.id,
        teacher.id,
        teacher.department_id,
    )


async def _pick_or_create_demo_teacher(db, department_id: int) -> Teacher | None:
    teacher = (
        await db.execute(
            select(Teacher)
            .join(Section, Section.teacher_id == Teacher.id)
            .where(Teacher.is_active == True)  # noqa: E712
            .order_by(Teacher.department_id, Teacher.id)
            .limit(1)
        )
    ).scalar_one_or_none()
    if teacher is not None:
        return teacher

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

    sections = (
        await db.execute(
            select(Section)
            .join(Course, Course.id == Section.course_id)
            .where(Course.department_id == teacher.department_id)
            .where(Section.teacher_id.is_(None))
            .order_by(Section.id)
            .limit(8)
        )
    ).scalars().all()
    for section in sections:
        section.teacher_id = teacher.id

    if not sections:
        has_any_section = (
            await db.execute(select(Section).where(Section.teacher_id == teacher.id).limit(1))
        ).scalar_one_or_none()
        if has_any_section is None:
            return None
    return teacher

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_default_users())

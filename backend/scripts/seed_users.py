"""Seed default users for all roles on startup."""

import asyncio
import logging
from uuid import uuid4

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.dependencies import hash_password
from app.models.people import User, UserRole
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
                logger.info(f"Created default user: {email} with role {user_data['role'].value}")
            else:
                # Update password just in case it was changed
                user.hashed_password = hash_password(settings.seed_password)
                user.role = user_data["role"]
                logger.info(f"Updated default user: {email}")
        
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to seed users: {e}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_default_users())

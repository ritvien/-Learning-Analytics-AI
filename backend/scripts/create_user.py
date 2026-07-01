"""Create or update an auth user from the command line.

Usage example:
python scripts/create_user.py --email admin@epu.edu.vn --password password123 --name "System Admin" --role admin
"""

import argparse
import asyncio
from uuid import uuid4

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.dependencies import hash_password
from app.models.people import User, UserRole


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(description="Create or update an EduInsight auth user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--role", choices=[role.value for role in UserRole], default=UserRole.admin.value)
    parser.add_argument("--department-id", type=int, default=None)
    return parser.parse_args()


async def main() -> None:
    """Create or update the requested user."""
    args = parse_args()
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == args.email))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                id=str(uuid4()),
                email=args.email,
                hashed_password=hash_password(args.password),
                full_name=args.name,
                role=UserRole(args.role),
                department_id=args.department_id,
            )
            db.add(user)
            action = "Created"
        else:
            user.hashed_password = hash_password(args.password)
            user.full_name = args.name
            user.role = UserRole(args.role)
            user.department_id = args.department_id
            user.is_active = True
            action = "Updated"
        await db.commit()
        print(f"{action} user {user.email} with role {user.role.value}")


if __name__ == "__main__":
    asyncio.run(main())

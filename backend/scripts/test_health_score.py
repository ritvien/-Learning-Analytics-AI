import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.analytics.health_score import (
    get_course_health_score,
    get_program_health_score,
    get_department_health_score
)

async def test_health():
    async with AsyncSessionLocal() as session:
        print("--- Testing Course 1 ---")
        c1 = await get_course_health_score(session, 1)
        print(c1)
        
        print("--- Testing Program 1 ---")
        p1 = await get_program_health_score(session, 1)
        print(p1)
        
        print("--- Testing Department 1 ---")
        d1 = await get_department_health_score(session, 1)
        print(d1)

asyncio.run(test_health())

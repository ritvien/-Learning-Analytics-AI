import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.people import User
from passlib.context import CryptContext

async def test_login():
    engine = create_async_engine("postgresql+asyncpg://eduinsight:eduinsight_dev@localhost:5433/eduinsight")
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.email == 'admin@epu.edu.vn')
        )
        user = result.scalar_one_or_none()
        
        if not user:
            print("User not found")
            return
            
        print("User found:", user.email)
        
        try:
            is_valid = pwd_context.verify('password', user.hashed_password)
            print("Password valid:", is_valid)
        except Exception as e:
            print("Password verify exception:", e)

asyncio.run(test_login())

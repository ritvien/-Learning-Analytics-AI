import asyncio
import asyncpg
from passlib.context import CryptContext

async def insert():
    pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
    hashed = pwd_context.hash('password')
    conn = await asyncpg.connect('postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight')
    
    await conn.execute('''
        INSERT INTO users (id, email, hashed_password, full_name, role, is_active, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
        ON CONFLICT (email) DO NOTHING
    ''', 'uuid-1234', 'admin@epu.edu.vn', hashed, 'Admin EPU', 'superadmin', True)
    
    print("User 'admin@epu.edu.vn' created with password 'password'.")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(insert())

import asyncio
import asyncpg

async def test():
    try:
        conn = await asyncpg.connect('postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight')
        result = await conn.fetch('SELECT count(*) FROM users')
        print("Success, users count:", result)
        await conn.close()
    except Exception as e:
        print("Connection failed:", e)

asyncio.run(test())

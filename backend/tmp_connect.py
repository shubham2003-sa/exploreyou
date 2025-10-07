import asyncio
import os
import traceback

from dotenv import load_dotenv
import asyncpg

load_dotenv('backend/.env')

async def main():
    conn = None
    try:
        conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
        print('connected')
    except Exception:
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

asyncio.run(main())

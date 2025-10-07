import asyncio
import os
import traceback

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv('backend/.env')

async def main():
    try:
        engine = create_async_engine(os.getenv('DATABASE_URL'), echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: None)
        print('connected via sqlalchemy')
    except Exception:
        traceback.print_exc()

asyncio.run(main())

"""
Run this script to migrate users from data/users.json into the Postgres users table.
Usage (powerShell):
  set DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/exploreyou"; python migrate_users.py

Note: ensure requirements are installed and the DB is reachable.
"""
import os
import asyncio
import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from main import Base, UserDB, DATABASE_URL, hash_password

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "users.json")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def migrate():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            users = json.load(f)
    except FileNotFoundError:
        print("No users.json file found; nothing to migrate.")
        return

    async with AsyncSessionLocal() as session:
        for u in users:
            email = u.get("email")
            name = u.get("name") or ""
            password = u.get("password") or ""
            if not email or not password:
                print(f"Skipping user with missing email or password: {u}")
                continue
            # check if exists
            result = await session.execute(select(UserDB).where(UserDB.email == email))
            existing = result.scalar_one_or_none()
            if existing:
                print(f"User already exists in DB: {email}")
                continue
            hashed = hash_password(password)
            new_user = UserDB(name=name, email=email, password_hash=hashed, created_at=datetime.utcnow())
            session.add(new_user)
        await session.commit()
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())

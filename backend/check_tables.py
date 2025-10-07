import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DSN = os.getenv('DATABASE_URL')
if not DSN:
    print('DATABASE_URL not set')
    raise SystemExit(1)
# psycopg2 expects a regular postgresql:// URL (no +asyncpg)
if '+asyncpg' in DSN:
    DSN = DSN.replace('+asyncpg', '')

print('Using DSN:', DSN)
try:
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public';")
    rows = cur.fetchall()
    print('Public tables:', rows)
    cur.close()
    conn.close()
except Exception as e:
    print('Error connecting/listing tables:', type(e).__name__, str(e))
    raise

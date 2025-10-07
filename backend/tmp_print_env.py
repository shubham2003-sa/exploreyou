import os
from dotenv import load_dotenv
load_dotenv("backend/.env")
print(repr(os.getenv("DATABASE_URL")))

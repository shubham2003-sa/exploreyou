"""Debug script to check for problematic environment variables."""
import os
from dotenv import load_dotenv

load_dotenv()

print("Checking environment variables...")
print()

keys_to_check = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "DATABASE_URL",
]

for key in keys_to_check:
    value = os.getenv(key)
    if value:
        # Check for leading/trailing whitespace
        if value != value.strip():
            print(f"[ERROR] {key}: Has leading/trailing whitespace!")
            print(f"   Length: {len(value)}, Stripped length: {len(value.strip())}")
        else:
            print(f"[OK] {key}: Length {len(value)}")
    else:
        print(f"[WARN] {key}: Not set")

print()
print("Done.")


import requests
import time

BASE = "http://127.0.0.1:8000"

# start session
r = requests.post(f"{BASE}/page-sessions/start", json={"page": "/test-smoke"})
print('start status', r.status_code, r.text)
psid = r.json().get('id')

# send click event
r2 = requests.post(f"{BASE}/page-sessions/{psid}/event", json={"event_type": "click", "x": 10, "y": 20})
print('event status', r2.status_code, r2.text)

# end session
r3 = requests.post(f"{BASE}/page-sessions/{psid}/end", json={"duration_seconds": 5})
print('end status', r3.status_code, r3.text)

# fetch tables via check_tables (we'll just print success)
print('smoke test done')

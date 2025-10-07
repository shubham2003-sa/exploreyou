import requests

BASE = "http://127.0.0.1:8000"
s = requests.Session()

# login
r = s.post(f"{BASE}/login", json={"email": "test@example.com", "password": "111111"})
print('login', r.status_code, r.text)

# check /me
r2 = s.get(f"{BASE}/me")
print('me after login', r2.status_code, r2.text)

# logout
r3 = s.post(f"{BASE}/logout")
print('logout', r3.status_code, r3.text)

# check /me again
r4 = s.get(f"{BASE}/me")
print('me after logout', r4.status_code, r4.text)

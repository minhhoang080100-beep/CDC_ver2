import requests
import json

BASE = "http://localhost:8000"

# Login
r = requests.post(f"{BASE}/api/auth/login", json={"username": "superadmin", "password": "Admin@123"})
print("Login:", r.status_code)
token = r.json().get("token")
headers = {"Authorization": f"Bearer {token}"}

# Create quiz survey
payload = {
    "title": "Test Quiz API",
    "isQuiz": True,
    "questions": [
        {
            "content": "2+2=?",
            "type": "SINGLE_CHOICE",
            "options": ["3", "4"],
            "isRequired": True,
            "correctAnswer": "4"
        },
        {
            "content": "Du doan so nguoi dung",
            "type": "GUESS_NUMBER",
            "options": [],
            "isRequired": True
        }
    ]
}

print("\nPayload:", json.dumps(payload, indent=2))
r = requests.post(f"{BASE}/api/surveys", json=payload, headers=headers)
print(f"\nCreate survey: {r.status_code}")
print("Response:", r.text)

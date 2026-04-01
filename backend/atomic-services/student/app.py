from pathlib import Path
import sys

_SWAGGER_PATH_CANDIDATES = [Path(__file__).resolve().parent, Path(__file__).resolve().parent.parent]
for _candidate in _SWAGGER_PATH_CANDIDATES:
    if (_candidate / "swagger_helper.py").exists():
        _candidate_str = str(_candidate)
        if _candidate_str not in sys.path:
            sys.path.append(_candidate_str)
        break

from swagger_helper import register_swagger
import os

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS


PORT = int(os.getenv("PORT", "3001"))
OUTSYSTEMS_BASE_URL = os.getenv(
    "OUTSYSTEMS_BASE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student",
)

app = Flask(__name__)
CORS(app)


def proxy_request(path, method="GET", payload=None):
    response = requests.request(
        method=method,
        url=f"{OUTSYSTEMS_BASE_URL}{path}",
        json=payload,
        timeout=15,
    )

    try:
        data = response.json()
    except ValueError:
        data = {"message": response.text or "Empty response"}

    return jsonify(data), response.status_code
register_swagger(app, 'student-service')

@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "student-service"})
@app.get("/api/students")
def get_students():
    return proxy_request("/student/")
@app.get("/api/students/<int:student_id>")
def get_student(student_id):
    return proxy_request(f"/student/{student_id}/")
@app.post("/api/students")
def create_student():
    return proxy_request("/student/", method="POST", payload=request.get_json())
@app.put("/api/students/<int:student_id>")
def update_student(student_id):
    return proxy_request(
        f"/student/{student_id}/", method="PUT", payload=request.get_json()
    )
@app.delete("/api/students/<int:student_id>")
def delete_student(student_id):
    return proxy_request(f"/student/{student_id}/", method="DELETE")
@app.post("/api/students/bulk-info")
def get_students_bulk():
    return proxy_request(
        "/students/bulk-info", method="POST", payload=request.get_json()
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)


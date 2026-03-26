import os

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS


PORT = int(os.getenv("PORT", "3017"))
OUTSYSTEMS_BASE_URL = os.getenv(
    "OUTSYSTEMS_BASE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Course/rest/Course",
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


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "course-service"})


@app.get("/api/courses")
def get_courses():
    return proxy_request("/course/")


@app.get("/api/courses/<int:course_id>")
def get_course(course_id):
    return proxy_request(f"/course/{course_id}/")


@app.post("/api/courses")
def create_course():
    return proxy_request("/course/", method="POST", payload=request.get_json())


@app.put("/api/courses/<int:course_id>")
def update_course(course_id):
    return proxy_request(
        f"/course/{course_id}/", method="PUT", payload=request.get_json()
    )


@app.delete("/api/courses/<int:course_id>")
def delete_course(course_id):
    return proxy_request(f"/course/{course_id}/", method="DELETE")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)

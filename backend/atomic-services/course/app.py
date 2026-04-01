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


PORT = int(os.getenv("PORT", "3017"))
OUTSYSTEMS_BASE_URL = os.getenv(
    "OUTSYSTEMS_BASE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Course/rest/Course",
)

app = Flask(__name__)
CORS(app)


def proxy_request(path, method="GET", payload=None):
    url = f"{OUTSYSTEMS_BASE_URL}{path}"
    print(f"Proxying request to: {url} with method {method}")
    response = requests.request(
        method=method,
        url=url,
        json=payload,
        timeout=15,
    )
    try:
        data = response.json()
    except ValueError:
        data = {"message": response.text or "Empty response"}

    return jsonify(data), response.status_code


register_swagger(app, 'course-service')

@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "course-service"})


@app.get("/api/courses")
def get_courses():
    return proxy_request("/course/")


@app.get("/api/courses/<string:course_code>")
def get_course(course_code):
    return proxy_request(f"/course/{course_code}")


@app.post("/api/courses")
def create_course():
    return proxy_request("/course/", method="POST", payload=request.get_json())


@app.put("/api/courses/<string:course_code>")
def update_course(course_code):
    return proxy_request(
        f"/course/{course_code}", method="PUT", payload=request.get_json()
    )


@app.delete("/api/courses/<string:course_code>")
def delete_course(course_code):
    return proxy_request(f"/course/{course_code}/", method="DELETE")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)


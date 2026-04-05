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
from analytics_engine import compute_section_metrics, compute_team_metrics

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import json

app = Flask(__name__)
CORS(app)

# â”€â”€ Upstream service URLs (overridden via docker-compose env) â”€â”€â”€â”€â”€â”€â”€â”€

TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team")
STUDENT_PROFILE_URL = os.getenv("STUDENT_PROFILE_URL", "http://localhost:4001/student-profile")
STUDENT_FORM_SUBMISSIONS_URL = os.getenv(
    "STUDENT_FORM_SUBMISSIONS_URL", "http://localhost:3015/student-form/submissions"
)
FORMATION_CONFIG_URL = os.getenv("FORMATION_CONFIG_URL", "http://localhost:4000/formation-config")
COURSES_URL = os.getenv(
    "COURSES_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Course/rest/Course/course",
)
# Prefer internal Docker service hostnames when running under compose
SECTIONS_URL = os.getenv("SECTION_URL", "http://section-service:3018/section")
ENROLLMENT_URL = os.getenv("ENROLLMENT_URL", "http://enrollment-service:3005/enrollment")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", 8))


def _fetch(url, params=None, label="service"):
    """GET helper with error handling."""
    try:
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        try:
            return resp.json(), None
        except ValueError:
            # Some upstreams (eg. OutSystems) may return JSON with a UTF-8 BOM.
            # Try decoding with utf-8-sig and parse explicitly.
            try:
                text = resp.content.decode("utf-8-sig")
            except Exception:
                text = resp.text
            try:
                return json.loads(text), None
            except Exception as exc:
                return None, f"failed to parse {label} response: {str(exc)}"
    except requests.exceptions.RequestException as e:
        return None, f"failed to fetch {label}: {str(e)}"


def _build_student_lookup(students):
    student_lookup = {}
    for student in students:
        student_id = student.get("student_id")
        profile = student.get("profile", {})
        if student_id is not None and profile:
            student_lookup[student_id] = profile
    return student_lookup


def _normalize_metrics_payload(section_id, team_metrics, section_metrics):
    return {
        "code": 200,
        "data": {
            "section_id": section_id,
            "team_analytics": team_metrics,
            "section_analytics": section_metrics,
        },
    }


register_swagger(app, 'dashboard-orchestrator-service')

@app.route("/dashboard", methods=["GET"])
def get_dashboard():
    section_id = request.args.get("section_id")
    # If no section_id provided, return a global dashboard summary
    if not section_id:
        # Fetch courses, sections, and enrollments and compute totals
        # Fetch courses directly from OutSystems.
        courses_data, err = _fetch(COURSES_URL, label="courses service")
        if err or not courses_data:
            return jsonify({"code": 502, "message": err or "failed to fetch courses"}), 502

        sections_data, err = _fetch(SECTIONS_URL, label="sections service")
        if err:
            return jsonify({"code": 502, "message": err}), 502

        enrollments_data, err = _fetch(ENROLLMENT_URL, label="enrollment service")
        if err:
            return jsonify({"code": 502, "message": err}), 502

        courses = courses_data.get("data", {}).get("Courses", []) if isinstance(courses_data, dict) else []
        sections = sections_data.get("data", []) if isinstance(sections_data, dict) else []
        enrollments = enrollments_data.get("data", []) if isinstance(enrollments_data, dict) else []

        total_courses = len(courses)
        total_groups = len([s for s in sections if s.get("is_active") is True])
        total_students = len(enrollments)

        return jsonify({
            "code": 200,
            "data": {
                "totalCourses": total_courses,
                "totalGroups": total_groups,
                "totalStudents": total_students,
                "pendingSwapRequests": 0,
            },
        }), 200

    #  1. Fetch teams 
    team_data, err = _fetch(
        TEAM_URL, params={"section_id": section_id}, label="team service"
    )
    if err:
        return jsonify({"code": 502, "message": err}), 502

    teams = team_data.get("data", {}).get("teams", [])
    if not teams:
        return jsonify({
            "code": 200,
            "data": {
                "section_id": section_id,
                "team_analytics": [],
                "section_analytics": {},
                "message": "no teams found for this section"
            }
        }), 200

    #  2. Fetch student profiles 
    profile_data, err = _fetch(
        STUDENT_PROFILE_URL, params={"section_id": section_id}, label="student profile service"
    )
    if err:
        return jsonify({"code": 502, "message": err}), 502

    students = profile_data.get("data", {}).get("students", [])

    # 2b. Fetch student form submissions (optional) 
    form_submissions_data, err = _fetch(
        STUDENT_FORM_SUBMISSIONS_URL,
        params={"section_id": section_id},
        label="student form service",
    )
    form_submissions = []
    if form_submissions_data:
        form_submissions = form_submissions_data.get("data", [])

    #  3. Fetch formation config (criteria + skills + topics) 
    formation_config_data, err = _fetch(
        FORMATION_CONFIG_URL,
        params={"section_id": section_id},
        label="formation config service",
    )
    if err:
        return jsonify({"code": 502, "message": err}), 502
    if not isinstance(formation_config_data, dict):
        return jsonify({"code": 502, "message": "invalid formation config response"}), 502

    criteria = formation_config_data.get("criteria")
    if not isinstance(criteria, dict):
        criteria = {}

    topics = formation_config_data.get("topics")
    if not isinstance(topics, list):
        topics = []

    skills = formation_config_data.get("skills")
    if not isinstance(skills, list):
        skills = []

    student_lookup = _build_student_lookup(students)
    team_metrics = [
        compute_team_metrics(team, student_lookup, skills)
        for team in teams
    ]
    section_metrics = compute_section_metrics(team_metrics)

    return jsonify(_normalize_metrics_payload(section_id, team_metrics, section_metrics)), 200

@app.route("/dashboard/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "dashboard-orchestrator-service"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 4003)), debug=True)


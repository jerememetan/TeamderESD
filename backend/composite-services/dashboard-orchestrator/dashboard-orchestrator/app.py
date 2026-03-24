"""
Dashboard Orchestrator Composite Service

Orchestrates the instructor team dashboard flow:
1. Fetch teams from Team Service
2. Fetch student profiles from Student Profile composite
3. Fetch criteria from Criteria Service
4. Fetch skill definitions from Skill Service
5. Fetch topic definitions from Topic Service
6. POST assembled payload to Analytics Service
7. Return analytics to the Instructor UI
"""

from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

# ── Upstream service URLs (overridden via docker-compose env) ────────

TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team")
STUDENT_PROFILE_URL = os.getenv("STUDENT_PROFILE_URL", "http://localhost:4001/student-profile")
STUDENT_FORM_SUBMISSIONS_URL = os.getenv(
    "STUDENT_FORM_SUBMISSIONS_URL", "http://localhost:3015/student-form/submissions"
)
CRITERIA_URL = os.getenv("CRITERIA_URL", "http://localhost:3004/criteria")
SKILL_URL = os.getenv("SKILL_URL", "http://localhost:3002/skill")
TOPIC_URL = os.getenv("TOPIC_URL", "http://localhost:3003/topic")
ANALYTICS_URL = os.getenv("ANALYTICS_URL", "http://localhost:3014/analytics")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", 8))


def _fetch(url, params=None, label="service"):
    """GET helper with error handling."""
    try:
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json(), None
    except requests.exceptions.RequestException as e:
        return None, f"failed to fetch {label}: {str(e)}"


@app.route("/dashboard", methods=["GET"])
def get_dashboard():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"code": 400, "message": "section_id is required"}), 400

    # ── 1. Fetch teams ───────────────────────────────────────────────
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

    # ── 2. Fetch student profiles ────────────────────────────────────
    profile_data, err = _fetch(
        STUDENT_PROFILE_URL, params={"section_id": section_id}, label="student profile service"
    )
    if err:
        return jsonify({"code": 502, "message": err}), 502

    students = profile_data.get("data", {}).get("students", [])

    # ── 2b. Fetch student form submissions (optional) ────────────────
    form_submissions_data, err = _fetch(
        STUDENT_FORM_SUBMISSIONS_URL,
        params={"section_id": section_id},
        label="student form service",
    )
    form_submissions = []
    if form_submissions_data:
        form_submissions = form_submissions_data.get("data", [])

    # ── 3. Fetch criteria ────────────────────────────────────────────
    criteria_data, err = _fetch(
        CRITERIA_URL, params={"section_id": section_id}, label="criteria service"
    )
    # Criteria is optional for analytics — proceed even if it fails
    criteria = {}
    if criteria_data:
        crit_list = criteria_data.get("data", [])
        if isinstance(crit_list, list) and crit_list:
            criteria = crit_list[0]
        elif isinstance(crit_list, dict):
            criteria = crit_list

    # ── 4. Fetch skill definitions ───────────────────────────────────
    skill_data, err = _fetch(
        SKILL_URL, params={"section_id": section_id}, label="skill service"
    )
    skills = []
    if skill_data:
        for s in skill_data.get("data", []):
            skills.append({
                "skill_id": s.get("skill_id"),
                "skill_label": s.get("skill_label"),
                "skill_importance": s.get("skill_importance"),
            })

    # ── 5. Fetch topic definitions ───────────────────────────────────
    topic_data, err = _fetch(
        TOPIC_URL, params={"section_id": section_id}, label="topic service"
    )
    topics = []
    if topic_data:
        for t in topic_data.get("data", []):
            topics.append({
                "topic_id": t.get("topic_id"),
                "topic_label": t.get("topic_label"),
            })

    # ── 6. POST to Analytics Service ─────────────────────────────────
    analytics_payload = {
        "section_id": section_id,
        "teams": teams,
        "students": students,
        "student_form_submissions": form_submissions,
        "criteria": criteria,
        "skills": skills,
        "topics": topics,
    }

    try:
        analytics_resp = requests.post(
            ANALYTICS_URL,
            json=analytics_payload,
            timeout=REQUEST_TIMEOUT,
        )
        analytics_resp.raise_for_status()
        analytics_result = analytics_resp.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"code": 502, "message": f"failed to compute analytics: {str(e)}"}), 502

    return jsonify(analytics_result), analytics_result.get("code", 200)


@app.route("/dashboard/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "dashboard-orchestrator-service"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 4003)), debug=True)

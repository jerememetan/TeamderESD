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
from flask_cors import CORS
import requests
import os
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# â”€â”€ Upstream service URLs (overridden via docker-compose env) â”€â”€â”€â”€â”€â”€â”€â”€

TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team")
STUDENT_PROFILE_URL = os.getenv("STUDENT_PROFILE_URL", "http://localhost:4001/student-profile")
STUDENT_FORM_SUBMISSIONS_URL = os.getenv(
    "STUDENT_FORM_SUBMISSIONS_URL", "http://localhost:3015/student-form/submissions"
)
CRITERIA_URL = os.getenv("CRITERIA_URL", "http://localhost:3004/criteria")
SKILL_URL = os.getenv("SKILL_URL", "http://localhost:3002/skill")
TOPIC_URL = os.getenv("TOPIC_URL", "http://localhost:3003/topic")
ANALYTICS_URL = os.getenv("ANALYTICS_URL", "http://localhost:3014/analytics")
COURSES_URL = os.getenv("COURSES_URL", "https://personal-0wtj3pne.outsystemscloud.com/Course/rest/Course/")
# Prefer internal Docker service hostnames when running under compose
SECTIONS_URL = os.getenv("SECTION_URL", "http://section-service:3018/section")
ENROLLMENT_URL = os.getenv("ENROLLMENT_URL", "http://enrollment-service:3005/enrollment")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", 8))
PEER_EVAL_URL = os.getenv("PEER_EVAL_URL", "http://localhost:3020/peer-eval")
NOTIFICATION_URL = os.getenv("NOTIFICATION_URL", "http://localhost:3016/notification")


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

    # â”€â”€ 1. Fetch teams â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    # â”€â”€ 2. Fetch student profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    profile_data, err = _fetch(
        STUDENT_PROFILE_URL, params={"section_id": section_id}, label="student profile service"
    )
    if err:
        return jsonify({"code": 502, "message": err}), 502

    students = profile_data.get("data", {}).get("students", [])

    # â”€â”€ 2b. Fetch student form submissions (optional) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    form_submissions_data, err = _fetch(
        STUDENT_FORM_SUBMISSIONS_URL,
        params={"section_id": section_id},
        label="student form service",
    )
    form_submissions = []
    if form_submissions_data:
        form_submissions = form_submissions_data.get("data", [])

    # â”€â”€ 3. Fetch criteria â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    criteria_data, err = _fetch(
        CRITERIA_URL, params={"section_id": section_id}, label="criteria service"
    )
    # Criteria is optional for analytics â€” proceed even if it fails
    criteria = {}
    if criteria_data:
        crit_list = criteria_data.get("data", [])
        if isinstance(crit_list, list) and crit_list:
            criteria = crit_list[0]
        elif isinstance(crit_list, dict):
            criteria = crit_list

    # â”€â”€ 4. Fetch skill definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    # â”€â”€ 5. Fetch topic definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    # â”€â”€ 6. POST to Analytics Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

@app.route("/dashboard/peer-eval/initiate", methods=["POST"])
def initiate_peer_eval():
    """
    Instructor initiates a peer evaluation round.

    Flow:
    1. Create round in Peer Evaluation Service
    2. Fetch team rosters from Team Service
    3. Fetch student profiles (for emails) from Student Profile Service
    4. Send notification emails via Notification Service (fire-and-forget)
    5. Return the created round info
    """
    payload = request.get_json()
    if not payload:
        return jsonify({"code": 400, "message": "request body is required"}), 400

    section_id = payload.get("section_id")
    if not section_id:
        return jsonify({"code": 400, "message": "section_id is required"}), 400

    title = payload.get("title", f"Peer Evaluation — Section {section_id[:8]}")
    due_at = payload.get("due_at")

    # ── 1. Create round in Peer Evaluation Service ────────────────────
    try:
        round_resp = requests.post(
            f"{PEER_EVAL_URL}/rounds",
            json={"section_id": section_id, "title": title, "due_at": due_at},
            timeout=REQUEST_TIMEOUT,
        )
        round_data = round_resp.json()
        if round_resp.status_code == 409:
            return jsonify(round_data), 409
        round_resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        return jsonify({"code": 502, "message": f"failed to create peer eval round: {str(e)}"}), 502

    created_round = round_data.get("data", {})
    round_id = created_round.get("round_id")

    # ── 2. Fetch team rosters ─────────────────────────────────────────
    team_data, err = _fetch(
        TEAM_URL, params={"section_id": section_id}, label="team service"
    )
    if err:
        return jsonify({
            "code": 200,
            "data": {
                "round": created_round,
                "notification_status": "skipped — could not fetch teams",
            },
        }), 200

    teams = team_data.get("data", {}).get("teams", [])

    # ── 3. Fetch student profiles for emails ──────────────────────────
    profile_data, err = _fetch(
        STUDENT_PROFILE_URL, params={"section_id": section_id}, label="student profile service"
    )

    student_email_map = {}
    if profile_data:
        for s in profile_data.get("data", {}).get("students", []):
            sid = s.get("student_id")
            email = s.get("profile", {}).get("email")
            if sid and email:
                student_email_map[sid] = email

    # ── 4. Send notification emails ───────────────────────────────────
    eval_link = payload.get("eval_link", f"http://localhost:5173/student/peer-evaluation/{round_id}")
    notification_results = {"sent": 0, "failed": 0, "skipped": 0}

    for team in teams:
        for student in team.get("students", []):
            sid = student.get("student_id")
            email = student_email_map.get(sid)
            if not email:
                notification_results["skipped"] += 1
                continue

            email_payload = {
                "to": email,
                "subject": f"Peer Evaluation Round — {title}",
                "body": (
                    f"Hello,\n\n"
                    f"A new peer evaluation round has been initiated for your section.\n\n"
                    f"Please evaluate your teammates using the link below:\n"
                    f"{eval_link}\n\n"
                    f"Due date: {due_at or 'To be announced'}\n\n"
                    f"Thank you."
                ),
                "metadata": {
                    "event_type": "PeerEvalInitiated",
                    "round_id": round_id,
                    "student_id": sid,
                    "section_id": section_id,
                },
            }

            try:
                notif_resp = requests.post(
                    f"{NOTIFICATION_URL}/publish-email",
                    json=email_payload,
                    timeout=REQUEST_TIMEOUT,
                )
                if notif_resp.status_code == 200:
                    notification_results["sent"] += 1
                else:
                    notification_results["failed"] += 1
            except Exception:
                notification_results["failed"] += 1

    # ── 5. Return result ──────────────────────────────────────────────
    return jsonify({
        "code": 201,
        "data": {
            "round": created_round,
            "teams_count": len(teams),
            "notification_results": notification_results,
        },
    }), 201


@app.route("/dashboard/peer-eval/close", methods=["POST"])
def close_peer_eval():
    """
    Instructor closes a peer evaluation round.

    Flow:
    1. Close the round in Peer Evaluation Service (returns reputation deltas)
    2. Push each delta to the Reputation Service
    3. Return summary
    """
    payload = request.get_json()
    if not payload:
        return jsonify({"code": 400, "message": "request body is required"}), 400

    round_id = payload.get("round_id")
    if not round_id:
        return jsonify({"code": 400, "message": "round_id is required"}), 400

    REPUTATION_URL = os.getenv("REPUTATION_URL", "http://localhost:3006/reputation")

    # ── 1. Close round and get deltas ─────────────────────────────────
    try:
        close_resp = requests.post(
            f"{PEER_EVAL_URL}/rounds/{round_id}/close",
            json={},
            timeout=REQUEST_TIMEOUT,
        )
        close_data = close_resp.json()
        close_resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        return jsonify({"code": 502, "message": f"failed to close peer eval round: {str(e)}"}), 502

    round_info = close_data.get("data", {}).get("round", {})
    deltas = close_data.get("data", {}).get("reputation_deltas", [])

    # ── 2. Push deltas to Reputation Service ──────────────────────────
    reputation_results = {"updated": 0, "failed": 0}

    for delta_entry in deltas:
        student_id = delta_entry.get("student_id")
        delta = delta_entry.get("delta", 0)

        if delta == 0:
            continue

        try:
            rep_resp = requests.put(
                f"{REPUTATION_URL}/{student_id}",
                json={"delta": delta},
                timeout=REQUEST_TIMEOUT,
            )
            if rep_resp.status_code == 200:
                reputation_results["updated"] += 1
            else:
                reputation_results["failed"] += 1
        except Exception:
            reputation_results["failed"] += 1

    return jsonify({
        "code": 200,
        "data": {
            "round": round_info,
            "reputation_deltas": deltas,
            "reputation_update_results": reputation_results,
        },
    }), 200


@app.route("/dashboard/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "dashboard-orchestrator-service"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 4003)), debug=True)


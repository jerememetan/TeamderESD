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
from peer_eval_weight_analyzer import analyze_peer_eval_weight_recommendations

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import json

app = Flask(__name__)
CORS(app)

# Upstream service URLs
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
PEER_EVAL_URL = os.getenv("PEER_EVAL_URL", "http://localhost:3020/peer-eval")
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


def _normalize_metrics_payload(
    section_id,
    team_metrics,
    section_metrics,
    peer_eval_reputation=None,
    weight_recommendations=None,
):
    return {
        "code": 200,
        "data": {
            "section_id": section_id,
            "team_analytics": team_metrics,
            "section_analytics": section_metrics,
            "peer_eval_reputation": peer_eval_reputation
            or {
                "has_peer_eval": False,
                "round": None,
                "deltas": [],
                "message": "No peer evaluation data available for this section yet.",
            },
            "weight_recommendations": weight_recommendations
            or {
                "has_peer_eval": False,
                "message": "No peer evaluation data available for this section yet.",
                "criteria_recommendations": [],
            },
        },
    }


def _normalize_round_payload(round_payload):
    if not isinstance(round_payload, dict):
        return None

    round_id = round_payload.get("round_id") or round_payload.get("id")
    if not round_id:
        return None

    title = (
        round_payload.get("title")
        or round_payload.get("name")
        or "Peer Evaluation"
    )
    return {
        "id": str(round_id),
        "title": str(title),
    }


def _build_reputation_delta_report(round_payload, submissions):
    normalized_round = _normalize_round_payload(round_payload)
    if not normalized_round:
        return {
            "has_peer_eval": False,
            "round": None,
            "deltas": [],
            "message": "Peer evaluation round metadata is incomplete.",
        }

    if not isinstance(submissions, list) or not submissions:
        return {
            "has_peer_eval": False,
            "round": normalized_round,
            "deltas": [],
            "message": "Peer evaluation round exists, but no submissions were found.",
        }

    ratings_by_student = {}
    for submission in submissions:
        evaluatee_id = submission.get("evaluateeId", submission.get("evaluatee_id"))
        rating = submission.get("rating")

        try:
            evaluatee_id = int(evaluatee_id)
            rating = float(rating)
        except (TypeError, ValueError):
            continue

        ratings_by_student.setdefault(evaluatee_id, []).append(rating)

    deltas = []
    for student_id, ratings in ratings_by_student.items():
        if not ratings:
            continue

        avg_rating = sum(ratings) / len(ratings)
        deltas.append(
            {
                "studentId": student_id,
                "avgRating": round(avg_rating, 4),
                "numEvaluations": len(ratings),
                "delta": round((avg_rating - 3.0) * 10),
            }
        )

    deltas.sort(
        key=lambda item: (
            -abs(item.get("delta", 0)),
            -(item.get("avgRating") or 0),
        )
    )

    return {
        "has_peer_eval": bool(deltas),
        "round": normalized_round,
        "deltas": deltas,
        "message": (
            "Peer evaluation data available."
            if deltas
            else "Peer evaluation submissions were invalid for reputation analysis."
        ),
    }


def _build_weight_recommendations(team_metrics, criteria, round_payload, submissions):
    normalized_round = _normalize_round_payload(round_payload)
    if not normalized_round:
        return {
            "has_peer_eval": False,
            "message": "Peer evaluation round metadata is incomplete.",
            "criteria_recommendations": [],
        }

    if not isinstance(submissions, list) or not submissions:
        return {
            "has_peer_eval": False,
            "peer_eval_round_id": normalized_round["id"],
            "message": "Peer evaluation round exists, but no submissions were found.",
            "criteria_recommendations": [],
        }

    recommendations = analyze_peer_eval_weight_recommendations(
        team_metrics=team_metrics,
        criteria=criteria,
        submissions=submissions,
    )
    recommendations["peer_eval_round_id"] = normalized_round["id"]
    return recommendations


def _build_peer_eval_analytics_payload(section_id, team_metrics, criteria):
    rounds_payload, err = _fetch(
        f"{PEER_EVAL_URL}/rounds",
        params={"section_id": section_id, "status": "closed"},
        label="peer evaluation service rounds",
    )
    if err:
        return {
            "reputation": {
                "has_peer_eval": False,
                "round": None,
                "deltas": [],
                "message": "Peer evaluation analytics unavailable for this section.",
            },
            "weight_recommendations": {
                "has_peer_eval": False,
                "message": "Peer evaluation analytics unavailable for this section.",
                "criteria_recommendations": [],
            },
        }

    rounds = rounds_payload.get("data", []) if isinstance(rounds_payload, dict) else []
    latest_round = rounds[0] if rounds else None

    if not latest_round:
        return {
            "reputation": {
                "has_peer_eval": False,
                "round": None,
                "deltas": [],
                "message": "No closed peer evaluation data available for this section yet.",
            },
            "weight_recommendations": {
                "has_peer_eval": False,
                "message": "No closed peer evaluation data available for this section yet.",
                "criteria_recommendations": [],
            },
        }

    normalized_round = _normalize_round_payload(latest_round)
    if not normalized_round:
        return {
            "reputation": {
                "has_peer_eval": False,
                "round": None,
                "deltas": [],
                "message": "Peer evaluation round metadata is incomplete.",
            },
            "weight_recommendations": {
                "has_peer_eval": False,
                "message": "Peer evaluation round metadata is incomplete.",
                "criteria_recommendations": [],
            },
        }

    submissions_payload, err = _fetch(
        f"{PEER_EVAL_URL}/rounds/{normalized_round['id']}/submissions",
        label="peer evaluation service submissions",
    )
    if err:
        return {
            "reputation": {
                "has_peer_eval": False,
                "round": normalized_round,
                "deltas": [],
                "message": "Peer evaluation submissions are not available right now.",
            },
            "weight_recommendations": {
                "has_peer_eval": False,
                "peer_eval_round_id": normalized_round["id"],
                "message": "Peer evaluation submissions are not available right now.",
                "criteria_recommendations": [],
            },
        }

    submissions = submissions_payload.get("data", []) if isinstance(submissions_payload, dict) else []
    return {
        "reputation": _build_reputation_delta_report(normalized_round, submissions),
        "weight_recommendations": _build_weight_recommendations(
            team_metrics=team_metrics,
            criteria=criteria,
            round_payload=normalized_round,
            submissions=submissions,
        ),
    }


register_swagger(app, "dashboard-orchestrator-service")


@app.route("/dashboard", methods=["GET"])
def get_dashboard():
    section_id = request.args.get("section_id")
    # If no section_id provided, return a global dashboard summary
    if not section_id:
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

        return jsonify(
            {
                "code": 200,
                "data": {
                    "totalCourses": total_courses,
                    "totalGroups": total_groups,
                    "totalStudents": total_students,
                    "pendingSwapRequests": 0,
                },
            }
        ), 200

    # 1. Fetch teams
    team_data, err = _fetch(TEAM_URL, params={"section_id": section_id}, label="team service")
    if err:
        return jsonify({"code": 502, "message": err}), 502

    teams = team_data.get("data", {}).get("teams", []) if isinstance(team_data, dict) else []
    if not teams:
        return jsonify(
            {
                "code": 200,
                "data": {
                    "section_id": section_id,
                    "team_analytics": [],
                    "section_analytics": {},
                    "peer_eval_reputation": {
                        "has_peer_eval": False,
                        "round": None,
                        "deltas": [],
                        "message": "No teams found for this section.",
                    },
                    "weight_recommendations": {
                        "has_peer_eval": False,
                        "message": "No teams found for this section.",
                        "criteria_recommendations": [],
                    },
                    "message": "no teams found for this section",
                },
            }
        ), 200

    # 2. Fetch student profiles
    profile_data, err = _fetch(
        STUDENT_PROFILE_URL,
        params={"section_id": section_id},
        label="student profile service",
    )
    if err:
        return jsonify({"code": 502, "message": err}), 502

    students = profile_data.get("data", {}).get("students", []) if isinstance(profile_data, dict) else []

    # 2b. Fetch student form submissions (optional)
    _fetch(
        STUDENT_FORM_SUBMISSIONS_URL,
        params={"section_id": section_id},
        label="student form service",
    )

    # 3. Fetch formation config (criteria + skills + topics)
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

    skills = formation_config_data.get("skills")
    if not isinstance(skills, list):
        skills = []

    student_lookup = _build_student_lookup(students)
    team_metrics = [compute_team_metrics(team, student_lookup, skills) for team in teams]
    section_metrics = compute_section_metrics(team_metrics)

    peer_eval_analytics = _build_peer_eval_analytics_payload(
        section_id=section_id,
        team_metrics=team_metrics,
        criteria=criteria,
    )

    payload = _normalize_metrics_payload(
        section_id,
        team_metrics,
        section_metrics,
        peer_eval_reputation=peer_eval_analytics.get("reputation"),
        weight_recommendations=peer_eval_analytics.get("weight_recommendations"),
    )
    return jsonify(payload), 200


@app.route("/dashboard/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "dashboard-orchestrator-service"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 4003)), debug=True)

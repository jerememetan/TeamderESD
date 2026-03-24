"""
Analytics Atomic Service

Accepts a POST payload with teams, student profiles, and formation config.
Returns per-team metrics and section-wide summary analytics.
No database, no external calls — pure computation.
"""

from flask import Flask, request, jsonify
import os
from analytics.engine import compute_team_metrics, compute_section_metrics


app = Flask(__name__)


@app.route("/analytics", methods=["POST"])
def analyse():
    payload = request.get_json()
    if not payload:
        return jsonify({"code": 400, "message": "request body is required"}), 400

    section_id = payload.get("section_id")
    teams = payload.get("teams", [])
    students = payload.get("students", [])
    skills = payload.get("skills", [])

    if not section_id:
        return jsonify({"code": 400, "message": "section_id is required"}), 400
    if not teams:
        return jsonify({"code": 400, "message": "teams array is required"}), 400
    if not students:
        return jsonify({"code": 400, "message": "students array is required"}), 400

    # Build student lookup: student_id -> profile
    student_lookup = {}
    for s in students:
        sid = s.get("student_id")
        profile = s.get("profile", {})
        if sid is not None and profile:
            student_lookup[sid] = profile

    # Build skill definitions from formation config
    # The orchestrator passes skills with skill_id included
    skill_definitions = skills if skills else []

    # Compute per-team metrics
    team_metrics = []
    for team in teams:
        metrics = compute_team_metrics(team, student_lookup, skill_definitions)
        team_metrics.append(metrics)

    # Compute section-wide metrics
    section_metrics = compute_section_metrics(team_metrics)

    return jsonify({
        "code": 200,
        "data": {
            "section_id": section_id,
            "team_analytics": team_metrics,
            "section_analytics": section_metrics,
        }
    }), 200


@app.route("/analytics/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "analytics-service"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 3014)), debug=True)

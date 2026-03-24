import logging
import os
from uuid import uuid4
from typing import Any, Dict, Optional

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

from solver import filter_solver_result_for_api, is_solver_success_status, solve_teams

app = Flask(__name__)
CORS(
    app,
    resources={r"/team-formation*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")}},
)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("team-formation-service")

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "8"))
STUDENT_PROFILE_URL = os.getenv(
    "STUDENT_PROFILE_URL", "http://localhost:4001/student-profile"
).rstrip("/")
FORMATION_CONFIG_URL = os.getenv(
    "FORMATION_CONFIG_URL", "http://localhost:4000/formation-config"
).rstrip("/")
TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team").rstrip("/")
SOLVER_TIME_LIMIT_S = float(os.getenv("SOLVER_TIME_LIMIT_S", "10"))

DEBUG_HEADER = "X-Debug-Mode"
TRUTHY_VALUES = {"1", "true", "yes", "on"}


def safe_json(response: requests.Response) -> Dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def is_debug_mode() -> bool:
    raw = request.headers.get(DEBUG_HEADER, "")
    return str(raw).strip().lower() in TRUTHY_VALUES


def http_get(url: str, params: Optional[Dict[str, Any]] = None) -> requests.Response:
    return requests.get(url, params=params, timeout=REQUEST_TIMEOUT)


def http_post(url: str, payload: Dict[str, Any]) -> requests.Response:
    return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)


def build_team_post_payload(solver_result: Dict[str, Any]) -> Dict[str, Any]:
    section_id = solver_result.get("section_id")
    teams = solver_result.get("teams")
    if not isinstance(teams, list):
        teams = []

    post_teams = []
    for team in teams:
        if not isinstance(team, dict):
            continue
        student_ids = team.get("student_ids")
        if not isinstance(student_ids, list):
            student_ids = []
        post_teams.append(
            {
                "team_id": str(uuid4()),
                "students": [{"student_id": student_id} for student_id in student_ids],
            }
        )

    return {"section_id": section_id, "teams": post_teams}


def fetch_student_profile(section_id: str) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        response = http_get(STUDENT_PROFILE_URL, {"section_id": section_id})
    except requests.RequestException:
        logger.exception(
            "failed to call student-profile service",
            extra={"section_id": section_id, "url": STUDENT_PROFILE_URL},
        )
        return None, "failed to fetch student profile"

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        logger.error(
            "student-profile service returned non-2xx",
            extra={
                "section_id": section_id,
                "status_code": response.status_code,
                "payload": payload,
            },
        )
        return None, "failed to fetch student profile"

    if "data" not in payload:
        logger.error(
            "student-profile payload missing data",
            extra={"section_id": section_id, "payload": payload},
        )
        return None, "failed to fetch student profile"

    return payload, None


def fetch_formation_config(section_id: str) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        response = http_get(FORMATION_CONFIG_URL, {"section_id": section_id})
    except requests.RequestException:
        logger.exception(
            "failed to call formation-config service",
            extra={"section_id": section_id, "url": FORMATION_CONFIG_URL},
        )
        return None, "failed to fetch formation config"

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        logger.error(
            "formation-config service returned non-2xx",
            extra={
                "section_id": section_id,
                "status_code": response.status_code,
                "payload": payload,
            },
        )
        return None, "failed to fetch formation config"

    if "criteria" not in payload:
        logger.error(
            "formation-config payload missing criteria",
            extra={"section_id": section_id, "payload": payload},
        )
        return None, "failed to fetch formation config"

    return payload, None


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "team-formation-service"}), 200


@app.route("/team-formation", methods=["GET"])
def get_team_formation():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"code": 400, "message": "section_id is required"}), 400

    debug = is_debug_mode()

    student_profile, student_profile_error = fetch_student_profile(section_id)
    if student_profile is None:
        return jsonify({"code": 502, "message": student_profile_error}), 502

    formation_config, formation_config_error = fetch_formation_config(section_id)
    if formation_config is None:
        return jsonify({"code": 502, "message": formation_config_error}), 502

    solver_result = solve_teams(
        formation_config=formation_config,
        student_profile=student_profile,
        time_limit_s=SOLVER_TIME_LIMIT_S,
    )

    response_data = filter_solver_result_for_api(solver_result, debug=debug)
    if is_solver_success_status(solver_result.get("status")):
        payload = build_team_post_payload(solver_result)
        try:
            team_response = http_post(TEAM_URL, payload)
        except requests.RequestException:
            logger.exception(
                "failed to call team service",
                extra={"section_id": section_id, "url": TEAM_URL},
            )
            return jsonify({"code": 502, "message": "failed to persist teams"}), 502

        team_payload = safe_json(team_response)
        return jsonify(team_payload), team_response.status_code

    if debug:
        return (
            jsonify(
                {
                    "code": 422,
                    "message": "team formation could not be generated",
                    "data": response_data,
                }
            ),
            422,
        )
    return jsonify({"code": 422, "message": "team formation could not be generated"}), 422


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4002")), debug=True)

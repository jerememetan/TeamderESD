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
import logging
import os
from uuid import uuid4
from typing import Any, Dict, Optional

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

_p = Path(__file__).resolve()
# Climb ancestors until we find the composite root. Prefer a directory
# that contains `error_publisher.py` or is named `composite-services`.
_COMPOSITE_ROOT = None
for ancestor in [_p] + list(_p.parents):
    candidate = Path(ancestor)
    if (candidate / "error_publisher.py").exists() or candidate.name == "composite-services":
        _COMPOSITE_ROOT = candidate
        break
if _COMPOSITE_ROOT is None:
    _COMPOSITE_ROOT = _p.parents[2] if len(_p.parents) > 2 else _p.parent
if str(_COMPOSITE_ROOT) not in sys.path:
    sys.path.append(str(_COMPOSITE_ROOT))

from error_publisher import publish_error_event

from solver import filter_solver_result_for_api, is_solver_success_status, solve_teams
from schemas import (
    TeamFormationSuccessSchema,
    TeamFormationRequestSchema,
    ErrorSchema,
    TeamFormationDebugSchema,
)

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/team-formation*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")},
        r"/teams*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")},
    },
)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("team-formation-service")
SERVICE_NAME = "team-formation-service"

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "8"))
STUDENT_PROFILE_URL = os.getenv(
    "STUDENT_PROFILE_URL", "http://localhost:4001/student-profile"
).rstrip("/")
FORMATION_CONFIG_URL = os.getenv(
    "FORMATION_CONFIG_URL", "http://localhost:4000/formation-config"
).rstrip("/")
TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team").rstrip("/")
SECTION_URL = os.getenv("SECTION_URL", "http://localhost:3018/section").rstrip("/")
STUDENT_FORM_URL = os.getenv("STUDENT_FORM_URL", "http://localhost:3015/student-form").rstrip("/")
REPUTATION_URL = os.getenv("REPUTATION_URL", "http://localhost:3006/reputation").rstrip("/")
SOLVER_TIME_LIMIT_S = float(os.getenv("SOLVER_TIME_LIMIT_S", "10"))

DEBUG_HEADER = "X-Debug-Mode"
TRUTHY_VALUES = {"1", "true", "yes", "on"}


def safe_json(response: requests.Response) -> Dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def extract_data(payload: Dict[str, Any]) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def is_debug_mode() -> bool:
    raw = request.headers.get(DEBUG_HEADER, "")
    return str(raw).strip().lower() in TRUTHY_VALUES


def http_get(url: str, params: Optional[Dict[str, Any]] = None) -> requests.Response:
    return requests.get(url, params=params, timeout=REQUEST_TIMEOUT)


def http_post(url: str, payload: Dict[str, Any]) -> requests.Response:
    return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)


def http_put(url: str, payload: Dict[str, Any]) -> requests.Response:
    return requests.put(url, json=payload, timeout=REQUEST_TIMEOUT)


def http_delete(url: str, params: Optional[Dict[str, Any]] = None) -> requests.Response:
    return requests.delete(url, params=params, timeout=REQUEST_TIMEOUT)


def publish_downstream_error(
    downstream_service: str,
    error_code: str,
    error_message: str,
    *,
    request_context=None,
    http_status=None,
    response_payload=None,
):
    publish_error_event(
        source_service=SERVICE_NAME,
        downstream_service=downstream_service,
        error_code=error_code,
        error_message=error_message,
        request_context=request_context or {},
        http_status=http_status,
        response_payload=response_payload,
    )


def parse_student_id(value: Any) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed


def extract_valid_student_ids(student_profile: Dict[str, Any]) -> set[int]:
    data = extract_data(student_profile)
    if not isinstance(data, dict):
        return set()
    students = data.get("students", [])
    if not isinstance(students, list):
        return set()

    valid_ids = set()
    for row in students:
        if not isinstance(row, dict):
            continue
        student_id = parse_student_id(row.get("student_id"))
        if student_id is not None:
            valid_ids.add(student_id)
    return valid_ids


def extract_students_missing_reputation(student_profile: Dict[str, Any]) -> set[int]:
    data = extract_data(student_profile)
    if not isinstance(data, dict):
        return set()
    students = data.get("students", [])
    if not isinstance(students, list):
        return set()

    missing = set()
    for row in students:
        if not isinstance(row, dict):
            continue
        student_id = parse_student_id(row.get("student_id"))
        profile = row.get("profile", {})
        if student_id is None or not isinstance(profile, dict):
            continue
        if profile.get("reputation_score") is None:
            missing.add(student_id)
    return missing


def fetch_student_forms(section_id: str) -> tuple[Optional[list[Dict[str, Any]]], Optional[str]]:
    try:
        response = http_get(STUDENT_FORM_URL, {"section_id": section_id})
    except requests.RequestException:
        logger.exception(
            "failed to call student-form service (GET)",
            extra={"section_id": section_id, "url": STUDENT_FORM_URL},
        )
        publish_downstream_error(
            "student-form",
            "STUDENT_FORM_LOOKUP_UNREACHABLE",
            "failed to fetch student forms",
            request_context={"section_id": section_id, "operation": "fetch-student-forms"},
        )
        return None, "failed to fetch student forms"

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        logger.error(
            "student-form service GET returned non-2xx",
            extra={
                "section_id": section_id,
                "status_code": response.status_code,
                "payload": payload,
            },
        )
        publish_downstream_error(
            "student-form",
            "STUDENT_FORM_LOOKUP_FAILED",
            "failed to fetch student forms",
            request_context={"section_id": section_id, "operation": "fetch-student-forms"},
            http_status=response.status_code,
            response_payload=payload,
        )
        return None, "failed to fetch student forms"

    rows = extract_data(payload)
    if not isinstance(rows, list):
        rows = []
    return rows, None


def delete_student_forms(section_id: str) -> Optional[str]:
    try:
        response = http_delete(STUDENT_FORM_URL, {"section_id": section_id})
    except requests.RequestException:
        logger.exception(
            "failed to call student-form service (DELETE)",
            extra={"section_id": section_id, "url": STUDENT_FORM_URL},
        )
        publish_downstream_error(
            "student-form",
            "STUDENT_FORM_DELETE_UNREACHABLE",
            "failed to delete student forms",
            request_context={"section_id": section_id, "operation": "delete-student-forms"},
        )
        return "failed to delete student forms"

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        logger.error(
            "student-form service DELETE returned non-2xx",
            extra={
                "section_id": section_id,
                "status_code": response.status_code,
                "payload": payload,
            },
        )
        publish_downstream_error(
            "student-form",
            "STUDENT_FORM_DELETE_FAILED",
            "failed to delete student forms",
            request_context={"section_id": section_id, "operation": "delete-student-forms"},
            http_status=response.status_code,
            response_payload=payload,
        )
        return "failed to delete student forms"

    return None


def initialize_reputation(student_id: int) -> Optional[str]:
    try:
        response = http_post(REPUTATION_URL, {"student_id": student_id})
    except requests.RequestException:
        logger.exception(
            "failed to call reputation service (POST)",
            extra={"student_id": student_id, "url": REPUTATION_URL},
        )
        publish_downstream_error(
            "reputation",
            "REPUTATION_INIT_UNREACHABLE",
            "failed to initialize reputation",
            request_context={"student_id": student_id, "operation": "initialize-reputation"},
        )
        return "failed to initialize reputation"

    payload = safe_json(response)
    if response.status_code in (201, 409):
        return None

    logger.error(
        "reputation service POST returned non-success",
        extra={"student_id": student_id, "status_code": response.status_code, "payload": payload},
    )
    publish_downstream_error(
        "reputation",
        "REPUTATION_INIT_FAILED",
        "failed to initialize reputation",
        request_context={"student_id": student_id, "operation": "initialize-reputation"},
        http_status=response.status_code,
        response_payload=payload,
    )
    return "failed to initialize reputation"


def ensure_reputation_exists(student_id: int, known_missing: bool = False) -> Optional[str]:
    if known_missing:
        return initialize_reputation(student_id)

    try:
        response = http_get(f"{REPUTATION_URL}/{student_id}")
    except requests.RequestException:
        logger.exception(
            "failed to call reputation service (GET)",
            extra={"student_id": student_id, "url": REPUTATION_URL},
        )
        publish_downstream_error(
            "reputation",
            "REPUTATION_LOOKUP_UNREACHABLE",
            "failed to fetch reputation",
            request_context={"student_id": student_id, "operation": "fetch-reputation"},
        )
        return "failed to fetch reputation"

    if response.status_code == 200:
        return None

    if response.status_code == 404:
        return initialize_reputation(student_id)

    payload = safe_json(response)
    logger.error(
        "reputation service GET returned non-success",
        extra={"student_id": student_id, "status_code": response.status_code, "payload": payload},
    )
    publish_downstream_error(
        "reputation",
        "REPUTATION_LOOKUP_FAILED",
        "failed to fetch reputation",
        request_context={"student_id": student_id, "operation": "fetch-reputation"},
        http_status=response.status_code,
        response_payload=payload,
    )
    return "failed to fetch reputation"


def apply_reputation_delta(student_id: int, delta: int) -> Optional[str]:
    try:
        response = http_put(f"{REPUTATION_URL}/{student_id}", {"delta": delta})
    except requests.RequestException:
        logger.exception(
            "failed to call reputation service (PUT)",
            extra={"student_id": student_id, "delta": delta, "url": REPUTATION_URL},
        )
        publish_downstream_error(
            "reputation",
            "REPUTATION_UPDATE_UNREACHABLE",
            "failed to update reputation",
            request_context={"student_id": student_id, "delta": delta, "operation": "update-reputation"},
        )
        return "failed to update reputation"

    if response.status_code == 404:
        init_error = initialize_reputation(student_id)
        if init_error is not None:
            return init_error
        try:
            retry_response = http_put(f"{REPUTATION_URL}/{student_id}", {"delta": delta})
        except requests.RequestException:
            logger.exception(
                "failed to retry reputation update after initialization",
                extra={"student_id": student_id, "delta": delta, "url": REPUTATION_URL},
            )
            publish_downstream_error(
                "reputation",
                "REPUTATION_UPDATE_UNREACHABLE",
                "failed to update reputation",
                request_context={"student_id": student_id, "delta": delta, "operation": "retry-update-reputation"},
            )
            return "failed to update reputation"
        if retry_response.status_code == 200:
            return None
        payload = safe_json(retry_response)
        logger.error(
            "reputation service PUT retry returned non-success",
            extra={
                "student_id": student_id,
                "delta": delta,
                "status_code": retry_response.status_code,
                "payload": payload,
            },
        )
        publish_downstream_error(
            "reputation",
            "REPUTATION_UPDATE_FAILED",
            "failed to update reputation",
            request_context={"student_id": student_id, "delta": delta, "operation": "retry-update-reputation"},
            http_status=retry_response.status_code,
            response_payload=payload,
        )
        return "failed to update reputation"

    if response.status_code != 200:
        payload = safe_json(response)
        logger.error(
            "reputation service PUT returned non-success",
            extra={
                "student_id": student_id,
                "delta": delta,
                "status_code": response.status_code,
                "payload": payload,
            },
        )
        publish_downstream_error(
            "reputation",
            "REPUTATION_UPDATE_FAILED",
            "failed to update reputation",
            request_context={"student_id": student_id, "delta": delta, "operation": "update-reputation"},
            http_status=response.status_code,
            response_payload=payload,
        )
        return "failed to update reputation"

    return None


def orchestrate_form_submissions_and_reputation(
    section_id: str,
    student_profile: Dict[str, Any],
) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    student_forms, forms_error = fetch_student_forms(section_id)
    if student_forms is None:
        return None, forms_error

    if not student_forms:
        return student_profile, None

    delete_error = delete_student_forms(section_id)
    if delete_error is not None:
        return None, delete_error

    valid_student_ids = extract_valid_student_ids(student_profile)
    students_missing_reputation = extract_students_missing_reputation(student_profile)

    for form in student_forms:
        if not isinstance(form, dict):
            continue
        student_id = parse_student_id(form.get("student_id"))
        if student_id is None or student_id not in valid_student_ids:
            continue

        ensure_error = ensure_reputation_exists(
            student_id,
            known_missing=student_id in students_missing_reputation,
        )
        if ensure_error is not None:
            return None, ensure_error

        submitted = form.get("submitted") is True
        delta = 2 if submitted else -5
        update_error = apply_reputation_delta(student_id, delta)
        if update_error is not None:
            return None, update_error

    refreshed_profile, refresh_error = fetch_student_profile(section_id)
    if refreshed_profile is None:
        return None, refresh_error

    return refreshed_profile, None


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
        publish_downstream_error(
            "student-profile",
            "STUDENT_PROFILE_LOOKUP_UNREACHABLE",
            "failed to fetch student profile",
            request_context={"section_id": section_id, "operation": "fetch-student-profile"},
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
        publish_downstream_error(
            "student-profile",
            "STUDENT_PROFILE_LOOKUP_FAILED",
            "failed to fetch student profile",
            request_context={"section_id": section_id, "operation": "fetch-student-profile"},
            http_status=response.status_code,
            response_payload=payload,
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
        publish_downstream_error(
            "formation-config",
            "FORMATION_CONFIG_LOOKUP_UNREACHABLE",
            "failed to fetch formation config",
            request_context={"section_id": section_id, "operation": "fetch-formation-config"},
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
        publish_downstream_error(
            "formation-config",
            "FORMATION_CONFIG_LOOKUP_FAILED",
            "failed to fetch formation config",
            request_context={"section_id": section_id, "operation": "fetch-formation-config"},
            http_status=response.status_code,
            response_payload=payload,
        )
        return None, "failed to fetch formation config"

    if "criteria" not in payload:
        logger.error(
            "formation-config payload missing criteria",
            extra={"section_id": section_id, "payload": payload},
        )
        return None, "failed to fetch formation config"

    return payload, None


def set_section_completed(section_id: str) -> Optional[str]:
    try:
        response = http_put(f"{SECTION_URL}/{section_id}", {"stage": "formed"})
    except requests.RequestException:
        logger.exception(
            "failed to call section service (PUT)",
            extra={"section_id": section_id, "url": SECTION_URL},
        )
        publish_downstream_error(
            "section",
            "SECTION_UPDATE_UNREACHABLE",
            "failed to update section stage",
            request_context={"section_id": section_id, "operation": "set-section-completed"},
        )
        return "failed to update section stage"

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        logger.error(
            "section service PUT returned non-2xx",
            extra={
                "section_id": section_id,
                "status_code": response.status_code,
                "payload": payload,
            },
        )
        publish_downstream_error(
            "section",
            "SECTION_UPDATE_FAILED",
            "failed to update section stage",
            request_context={"section_id": section_id, "operation": "set-section-completed"},
            http_status=response.status_code,
            response_payload=payload,
        )
        return "failed to update section stage"

    return None


register_swagger(app, 'team-formation-service')

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "team-formation-service"}), 200



@app.route("/team-formation", methods=["POST"])
def get_team_formation():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        payload = {}

    section_id = payload.get("section_id")
    if not isinstance(section_id, str) or not section_id.strip():
        return jsonify({"code": 400, "message": "section_id is required"}), 400
    section_id = section_id.strip()

    debug = is_debug_mode()

    student_profile, student_profile_error = fetch_student_profile(section_id)
    if student_profile is None:
        return jsonify({"code": 502, "message": student_profile_error}), 502

    formation_config, formation_config_error = fetch_formation_config(section_id)
    if formation_config is None:
        return jsonify({"code": 502, "message": formation_config_error}), 502

    student_profile, form_orchestration_error = orchestrate_form_submissions_and_reputation(
        section_id,
        student_profile,
    )
    if student_profile is None:
        return jsonify({"code": 502, "message": form_orchestration_error}), 502

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

        if team_response.status_code < 200 or team_response.status_code >= 300:
            team_payload = safe_json(team_response)
            return jsonify(team_payload), team_response.status_code

        section_error = set_section_completed(section_id)
        if section_error is not None:
            return jsonify({"code": 502, "message": section_error}), 502

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


@app.route("/teams", methods=["GET"])
def proxy_get_teams():
    """Proxy to the atomic team service to expose persisted teams through the composite service.

    Accepts `section_id` query param and forwards it to the configured TEAM_URL.
    Returns the upstream payload and status code, or a 502 on failure.
    """
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"code": 400, "message": "section_id is required"}), 400

    try:
        upstream = http_get(TEAM_URL, {"section_id": section_id})
    except requests.RequestException:
        logger.exception(
            "failed to call team service (GET)",
            extra={"section_id": section_id, "url": TEAM_URL},
        )
        return jsonify({"code": 502, "message": "failed to fetch teams"}), 502

    payload = safe_json(upstream)
    status = upstream.status_code if isinstance(upstream, requests.Response) else 502
    return jsonify(payload), status


# attach OpenAPI response schemas
get_team_formation._openapi_response_schema = TeamFormationSuccessSchema
get_team_formation._openapi_request_schema = TeamFormationRequestSchema


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4002")), debug=True)


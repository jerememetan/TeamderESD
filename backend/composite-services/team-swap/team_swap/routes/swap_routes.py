import os
from uuid import UUID

import requests
from flask import Blueprint, jsonify, request

from ..schemas.swap_schema import OptimizeRequestSchema
from ..solver import solve_swaps
from ..constraints import check_all_constraints


swap_bp = Blueprint("swap", __name__)
optimize_schema = OptimizeRequestSchema()

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "10"))
TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team").rstrip("/")
SWAP_REQUEST_URL = os.getenv("SWAP_REQUEST_URL", "http://localhost:3011/swap-request").rstrip("/")
SECTION_URL = os.getenv("SECTION_URL", "http://localhost:3018/section").rstrip("/")
FORMATION_CONFIG_URL = os.getenv("FORMATION_CONFIG_URL", "http://localhost:4002/formation-config").rstrip("/")

REQUEST_STATUS_EXECUTED = "EXECUTED"
REQUEST_STATUS_FAILED = "FAILED"


def _safe_json(response):
    try:
        return response.json()
    except ValueError:
        return {}


def _extract_data(payload):
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def _extract_error_message(payload, fallback):
    if isinstance(payload, dict):
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message
        error = payload.get("error")
        if isinstance(error, str) and error.strip():
            return error
        if isinstance(error, dict):
            nested_message = error.get("message")
            if isinstance(nested_message, str) and nested_message.strip():
                return nested_message
    return fallback


def _http_json(method, url, label, params=None, payload=None):
    try:
        response = requests.request(
            method=method,
            url=url,
            params=params,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        return None, {
            "status": 502,
            "message": f"failed to call {label}: {str(error)}",
            "upstream_status": None,
            "upstream_payload": None,
        }

    response_payload = _safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        fallback = f"{label} returned {response.status_code}"
        return None, {
            "status": 502,
            "message": _extract_error_message(response_payload, fallback),
            "upstream_status": response.status_code,
            "upstream_payload": response_payload,
        }

    return response_payload, None


def _normalize_uuid(value, field_name):
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a valid UUID")


def _normalize_approved_ids(values):
    normalized = set()
    if not isinstance(values, list):
        return normalized

    for value in values:
        try:
            normalized.add(str(_normalize_uuid(value, "approved_request_ids")))
        except ValueError:
            continue

    return normalized


def _status_from_value(value):
    text = str(value or "").strip().upper()
    return text


def _int_or_none(value):
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _student_team_map(teams_by_id):
    mapping = {}
    if not isinstance(teams_by_id, dict):
        return mapping

    for team_id, students in teams_by_id.items():
        for student_id in students or []:
            mapping[int(student_id)] = str(team_id)
    return mapping


def _validate_execute_invariants(original_teams, updated_teams, approved_requests):
    original_map = _student_team_map(original_teams)
    updated_map = _student_team_map(updated_teams)

    if set(original_map.keys()) != set(updated_map.keys()):
        return False, "student roster changed during swap execution"

    approved_students = {int(req["student_id"]) for req in approved_requests}

    for student_id, original_team in original_map.items():
        updated_team = updated_map.get(student_id)
        moved = updated_team != original_team
        if moved and student_id not in approved_students:
            return False, f"non-approved student {student_id} moved"

    return True, None


def _build_new_team_roster(section_id, teams_by_id):
    return {
        "section_id": section_id,
        "teams": [
            {
                "team_id": team_id,
                "students": [{"student_id": sid} for sid in students],
            }
            for team_id, students in teams_by_id.items()
        ],
    }


def _fetch_section_row(section_id):
    payload, error = _http_json(
        "GET",
        f"{SECTION_URL}/{section_id}",
        label="section service",
    )
    if error:
        return None, error

    row = _extract_data(payload)
    if not isinstance(row, dict):
        return None, {"status": 502, "message": "section service returned invalid payload"}

    return row, None


def _update_section_stage(section_id, stage):
    payload, error = _http_json(
        "PUT",
        f"{SECTION_URL}/{section_id}",
        label="section service update",
        payload={"stage": stage},
    )
    if error:
        return None, error

    row = _extract_data(payload)
    if not isinstance(row, dict):
        return None, {"status": 502, "message": "section service update returned invalid payload"}

    return row, None


def _fetch_section_teams(section_id):
    team_payload, team_error = _http_json(
        "GET",
        TEAM_URL,
        label="team service",
        params={"section_id": section_id},
    )
    if team_error:
        return None, None, team_error

    teams_data = _extract_data(team_payload)
    teams_list = teams_data.get("teams") if isinstance(teams_data, dict) else None
    if not isinstance(teams_list, list):
        return None, None, {"status": 502, "message": "team service returned invalid payload"}

    current_teams = {}
    for team in teams_list:
        if not isinstance(team, dict):
            continue
        team_id = str(team.get("team_id")) if team.get("team_id") is not None else None
        if not team_id:
            continue
        students = team.get("students") or []
        student_ids = []
        for student in students:
            if isinstance(student, dict):
                sid = student.get("student_id")
            else:
                sid = student
            sid_int = _int_or_none(sid)
            if sid_int is None:
                continue
            student_ids.append(sid_int)
        current_teams[team_id] = student_ids

    section_team_ids = set(current_teams.keys())
    if not section_team_ids:
        return None, None, {"status": 400, "message": "no teams found for section"}

    return current_teams, section_team_ids, None


def _fetch_approved_requests(section_team_ids, approved_id_filter=None):
    request_payload, request_error = _http_json(
        "GET",
        SWAP_REQUEST_URL,
        label="swap-request service",
        params={"status": "APPROVED"},
    )
    if request_error:
        return None, request_error

    request_rows = _extract_data(request_payload)
    if isinstance(request_rows, dict):
        request_rows = [request_rows]
    if not isinstance(request_rows, list):
        request_rows = []

    approved_requests = []
    for row in request_rows:
        if not isinstance(row, dict):
            continue
        request_id = row.get("swap_request_id")
        current_team = row.get("current_team")
        student_id = row.get("student_id")
        if request_id is None or current_team is None or student_id is None:
            continue

        request_id_text = str(request_id)
        current_team_text = str(current_team)
        if approved_id_filter and request_id_text not in approved_id_filter:
            continue
        if current_team_text not in section_team_ids:
            continue

        student_id_int = _int_or_none(student_id)
        if student_id_int is None:
            continue

        approved_requests.append(
            {
                "swap_request_id": request_id_text,
                "student_id": student_id_int,
                "current_team": current_team_text,
            }
        )

    return approved_requests, None


def _fetch_formation_config(section_id):
    formation_payload, formation_error = _http_json(
        "GET",
        FORMATION_CONFIG_URL,
        label="formation-config service",
        params={"section_id": section_id},
    )
    if formation_error:
        return None
    return _extract_data(formation_payload)


def _run_swap_execution(current_teams, approved_requests):
    if not approved_requests:
        return {
            "new_teams": {team_id: list(students) for team_id, students in current_teams.items()},
            "per_request_result": [],
            "num_executed": 0,
        }, None

    original_teams = {team_id: list(students) for team_id, students in current_teams.items()}
    new_teams = {team_id: list(students) for team_id, students in current_teams.items()}
    valid_requests = []
    invalid_results = []

    for req in approved_requests:
        student_id = req["student_id"]
        current_team = req["current_team"]
        if student_id not in new_teams.get(current_team, []):
            invalid_results.append(
                {
                    "swap_request_id": req["swap_request_id"],
                    "student_id": student_id,
                    "status": REQUEST_STATUS_FAILED,
                    "reason": "Student is no longer in current team",
                }
            )
            continue
        valid_requests.append(req)

    executed_ids = set()
    used_indices = set()
    for i, req1 in enumerate(valid_requests):
        if i in used_indices:
            continue
        for j in range(i + 1, len(valid_requests)):
            if j in used_indices:
                continue
            req2 = valid_requests[j]
            if req1["current_team"] == req2["current_team"]:
                continue

            s1 = req1["student_id"]
            s2 = req2["student_id"]
            t1 = req1["current_team"]
            t2 = req2["current_team"]

            if s1 not in new_teams[t1] or s2 not in new_teams[t2]:
                continue

            new_teams[t1].remove(s1)
            new_teams[t1].append(s2)
            new_teams[t2].remove(s2)
            new_teams[t2].append(s1)

            used_indices.add(i)
            used_indices.add(j)
            executed_ids.add(req1["swap_request_id"])
            executed_ids.add(req2["swap_request_id"])
            break

    per_request_result = list(invalid_results)
    for req in valid_requests:
        if req["swap_request_id"] in executed_ids:
            per_request_result.append(
                {
                    "swap_request_id": req["swap_request_id"],
                    "student_id": req["student_id"],
                    "status": REQUEST_STATUS_EXECUTED,
                    "reason": None,
                }
            )
        else:
            per_request_result.append(
                {
                    "swap_request_id": req["swap_request_id"],
                    "student_id": req["student_id"],
                    "status": REQUEST_STATUS_FAILED,
                    "reason": "No compatible approved request from a different team",
                }
            )

    invariants_ok, invariants_error = _validate_execute_invariants(
        original_teams,
        new_teams,
        valid_requests,
    )
    if not invariants_ok:
        return None, {
            "status": 409,
            "message": f"swap invariants violated: {invariants_error}",
        }

    return {
        "new_teams": new_teams,
        "per_request_result": per_request_result,
        "num_executed": len(executed_ids),
    }, None


def _persist_team_roster(section_id, new_team_roster):
    persist_payload = {
        "section_id": section_id,
        "teams": new_team_roster["teams"],
    }
    persist_response, persist_error = _http_json(
        "POST",
        TEAM_URL,
        label="team service update",
        payload=persist_payload,
    )
    if persist_error:
        return None, persist_error

    return _extract_data(persist_response), None


def _execute_with_preloaded_requests(section_id, current_teams, approved_requests, formation_config_data):
    execution_state, execution_error = _run_swap_execution(current_teams, approved_requests)
    if execution_error:
        return None, execution_error

    new_team_roster = _build_new_team_roster(section_id, execution_state["new_teams"])
    payload = {
        "new_team_roster": new_team_roster,
        "per_request_result": execution_state["per_request_result"],
        "num_executed": execution_state["num_executed"],
        "formation_config": formation_config_data,
    }

    if approved_requests:
        team_update_response, persist_error = _persist_team_roster(section_id, new_team_roster)
        if persist_error:
            return None, persist_error
        payload["team_update_response"] = team_update_response

    return payload, None


def _update_swap_request_statuses(request_results):
    update_errors = []
    for result in request_results:
        if not isinstance(result, dict):
            continue

        swap_request_id = result.get("swap_request_id")
        status = _status_from_value(result.get("status"))
        if swap_request_id is None or status not in {REQUEST_STATUS_EXECUTED, REQUEST_STATUS_FAILED}:
            continue

        _, status_error = _http_json(
            "PATCH",
            f"{SWAP_REQUEST_URL}/{swap_request_id}/status",
            label="swap-request status update",
            payload={"status": status},
        )
        if status_error:
            update_errors.append({"swap_request_id": str(swap_request_id), "error": status_error})

    return update_errors

@swap_bp.route("/execute", methods=["POST"])
def execute_swaps_composite():
    payload = request.get_json() or {}

    try:
        section_id = str(_normalize_uuid(payload.get("section_id"), "section_id"))
    except ValueError as error:
        return jsonify({"code": 400, "message": str(error)}), 400

    approved_id_filter = _normalize_approved_ids(payload.get("approved_request_ids"))

    current_teams, section_team_ids, team_error = _fetch_section_teams(section_id)
    if team_error:
        return jsonify({"code": team_error.get("status", 502), "message": team_error.get("message")}), team_error.get("status", 502)

    approved_requests, request_error = _fetch_approved_requests(section_team_ids, approved_id_filter)
    if request_error:
        return jsonify({"code": request_error.get("status", 502), "message": request_error.get("message")}), request_error.get("status", 502)

    formation_config_data = _fetch_formation_config(section_id)
    execute_data, execute_error = _execute_with_preloaded_requests(
        section_id,
        current_teams,
        approved_requests,
        formation_config_data,
    )
    if execute_error:
        return jsonify({"code": execute_error.get("status", 502), "message": execute_error.get("message")}), execute_error.get("status", 502)

    if not approved_requests:
        return (
            jsonify(
                {
                    "code": 200,
                    "message": "No approved requests to execute",
                    "data": execute_data,
                }
            ),
            200,
        )

    return (
        jsonify(
            {
                "code": 200,
                "message": "Swap execution completed",
                "data": execute_data,
            }
        ),
        200,
    )


@swap_bp.route("/sections/<uuid:section_id>/confirm", methods=["POST"])
def confirm_section_swaps(section_id):
    section_id_text = str(section_id)

    section_row, section_error = _fetch_section_row(section_id_text)
    if section_error:
        return jsonify({"code": section_error.get("status", 502), "message": section_error.get("message")}), section_error.get("status", 502)

    stage = str(section_row.get("stage") or "").strip().lower()
    if stage != "formed":
        return jsonify({"code": 409, "message": "section must be in formed stage to confirm swaps", "data": {"stage": stage}}), 409

    current_teams, section_team_ids, team_error = _fetch_section_teams(section_id_text)
    if team_error:
        return jsonify({"code": team_error.get("status", 502), "message": team_error.get("message")}), team_error.get("status", 502)

    approved_requests, request_error = _fetch_approved_requests(section_team_ids)
    if request_error:
        return jsonify({"code": request_error.get("status", 502), "message": request_error.get("message")}), request_error.get("status", 502)

    if not approved_requests:
        updated_section, update_error = _update_section_stage(section_id_text, "confirmed")
        if update_error:
            return jsonify({"code": update_error.get("status", 502), "message": update_error.get("message")}), update_error.get("status", 502)

        return jsonify({
            "code": 200,
            "data": {
                "section": updated_section,
                "approved_request_count": 0,
                "executed_count": 0,
                "failed_count": 0,
                "message": "No approved requests; section confirmed",
            },
        }), 200

    formation_config_data = _fetch_formation_config(section_id_text)
    execute_data, execute_error = _execute_with_preloaded_requests(
        section_id_text,
        current_teams,
        approved_requests,
        formation_config_data,
    )
    if execute_error:
        return jsonify({"code": execute_error.get("status", 502), "message": execute_error.get("message")}), execute_error.get("status", 502)

    request_results = execute_data.get("per_request_result")
    if not isinstance(request_results, list):
        request_results = []

    update_errors = _update_swap_request_statuses(request_results)
    if update_errors:
        return (
            jsonify(
                {
                    "code": 502,
                    "message": "failed to apply one or more swap request status updates",
                    "data": {"errors": update_errors},
                }
            ),
            502,
        )

    updated_section, update_error = _update_section_stage(section_id_text, "confirmed")
    if update_error:
        return jsonify({"code": update_error.get("status", 502), "message": update_error.get("message")}), update_error.get("status", 502)

    executed_count = 0
    failed_count = 0
    for result in request_results:
        if not isinstance(result, dict):
            continue
        status = _status_from_value(result.get("status"))
        if status == REQUEST_STATUS_EXECUTED:
            executed_count += 1
        elif status == REQUEST_STATUS_FAILED:
            failed_count += 1

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "section": updated_section,
                    "approved_request_count": len(approved_requests),
                    "executed_count": executed_count,
                    "failed_count": failed_count,
                    "execution": execute_data,
                },
            }
        ),
        200,
    )

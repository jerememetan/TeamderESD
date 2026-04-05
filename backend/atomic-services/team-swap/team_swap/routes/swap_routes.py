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
FORMATION_CONFIG_URL = os.getenv("FORMATION_CONFIG_URL", "http://localhost:4002/formation-config").rstrip("/")


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


@swap_bp.route("/optimize", methods=["POST"])
def optimize_swaps():
    # HTTP endpoint: receives orchestrator payload with teams, approved requests, constraints, and student attributes.
    # Uses OR-Tools to find optimal swap selection that satisfies constraints.
    # Returns new roster and per-request execution status.

    payload = request.get_json() or {}

    try:
        data = optimize_schema.load(payload)
    except Exception as e:
        return jsonify({"code": 400, "message": f"Invalid payload: {str(e)}"}), 400

    section_id = data["section_id"]
    course_id = data["course_id"]
    module_id = data["module_id"]
    class_id = data["class_id"]
    teams_list = data["teams"]
    students_list = data["students"]
    approved_requests = data["approved_swap_requests"]
    constraints_dict = data["swap_constraints"]

    # Normalize teams into dict: team_id -> [student_ids]
    current_teams = {}
    for team in teams_list:
        current_teams[str(team["team_id"])] = team["students"]

    # Normalize students into dict: student_id -> {year, gender, gpa, skills}
    students_data = {}
    for student in students_list:
        students_data[student["student_id"]] = {
            "year": student["year"],
            "gender": student["gender"],
            "gpa": student.get("gpa"),
            "skills": student.get("skills", {}),
        }

    # Normalize approved requests.
    approved_requests_norm = [
        {
            "swap_request_id": str(req["swap_request_id"]),
            "student_id": req["student_id"],
            "current_team": str(req["current_team"]),
        }
        for req in approved_requests
    ]

    # Validate: each approved request student is in the current roster.
    for req in approved_requests_norm:
        sid = req["student_id"]
        team_id = req["current_team"]
        if sid not in students_data:
            return jsonify(
                {
                    "code": 400,
                    "message": f"Student {sid} in swap request not found in students list",
                }
            ), 400
        if team_id not in current_teams:
            return jsonify(
                {
                    "code": 400,
                    "message": f"Team {team_id} in swap request not found in teams list",
                }
            ), 400
        if sid not in current_teams[team_id]:
            return jsonify(
                {
                    "code": 400,
                    "message": f"Student {sid} not in current_team {team_id}",
                }
            ), 400

    # Solve: find optimal swap pairs.
    selected_pairs, objective_value = solve_swaps(
        approved_requests_norm,
        current_teams,
        students_data,
        constraints_dict,
        time_limit_s=10,
    )

    # Apply selected swaps to generate new rosters.
    new_teams = {}
    for tid, students in current_teams.items():
        new_teams[tid] = list(students)

    applied_swaps = []
    for s1, s2 in selected_pairs:
        # Find which team each student is in and swap.
        t1_id = None
        t2_id = None
        for tid, students in new_teams.items():
            if s1 in students:
                t1_id = tid
            if s2 in students:
                t2_id = tid

        if t1_id and t2_id and t1_id != t2_id:
            new_teams[t1_id].remove(s1)
            new_teams[t1_id].append(s2)
            new_teams[t2_id].remove(s2)
            new_teams[t2_id].append(s1)
            applied_swaps.append({"s1": s1, "s2": s2, "t1": t1_id, "t2": t2_id})

    # Generate per-request results.
    executed_request_ids = set()
    for s1, s2 in selected_pairs:
        for req in approved_requests_norm:
            if req["student_id"] == s1:
                executed_request_ids.add(req["swap_request_id"])
            if req["student_id"] == s2:
                executed_request_ids.add(req["swap_request_id"])

    per_request_result = []
    for req in approved_requests_norm:
        if req["swap_request_id"] in executed_request_ids:
            per_request_result.append(
                {
                    "swap_request_id": req["swap_request_id"],
                    "student_id": req["student_id"],
                    "status": "EXECUTED",
                    "reason": None,
                }
            )
        else:
            per_request_result.append(
                {
                    "swap_request_id": req["swap_request_id"],
                    "student_id": req["student_id"],
                    "status": "FAILED",
                    "reason": "Not selected in optimal solution or no feasible partner",
                }
            )

    # Build new_team_roster in same format as team service POST endpoint.
    new_team_roster = {
        "section_id": str(section_id),
        "teams": [
            {
                "team_id": tid,
                "students": [{"student_id": sid} for sid in students],
            }
            for tid, students in new_teams.items()
        ],
    }

    # Final validation: check new roster satisfies all constraints.
    new_teams_simple = {tid: students for tid, students in new_teams.items()}
    constraints_valid, constraint_reason = check_all_constraints(
        new_teams_simple, students_data, constraints_dict
    )

    return jsonify(
        {
            "code": 200,
            "message": "Swap optimization completed",
            "data": {
                "new_team_roster": new_team_roster,
                "per_request_result": per_request_result,
                "selected_pairs": applied_swaps,
                "solver_objective": objective_value,
                "num_executed": len(executed_request_ids),
                "constraints_satisfied": constraints_valid,
                "constraint_violation_reason": constraint_reason,
            },
        }
    ), 200


@swap_bp.route("/execute", methods=["POST"])
def execute_swaps_composite():
    payload = request.get_json() or {}

    try:
        section_id = str(_normalize_uuid(payload.get("section_id"), "section_id"))
    except ValueError as error:
        return jsonify({"code": 400, "message": str(error)}), 400

    approved_id_filter = _normalize_approved_ids(payload.get("approved_request_ids"))

    team_payload, team_error = _http_json(
        "GET",
        TEAM_URL,
        label="team service",
        params={"section_id": section_id},
    )
    if team_error:
        return jsonify({"code": team_error.get("status", 502), "message": team_error.get("message")}), team_error.get("status", 502)

    teams_data = _extract_data(team_payload)
    teams_list = teams_data.get("teams") if isinstance(teams_data, dict) else None
    if not isinstance(teams_list, list):
        return jsonify({"code": 502, "message": "team service returned invalid payload"}), 502

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
            try:
                student_ids.append(int(sid))
            except (TypeError, ValueError):
                continue
        current_teams[team_id] = student_ids

    section_team_ids = set(current_teams.keys())
    if not section_team_ids:
        return jsonify({"code": 400, "message": "no teams found for section"}), 400

    request_payload, request_error = _http_json(
        "GET",
        SWAP_REQUEST_URL,
        label="swap-request service",
        params={"status": "APPROVED"},
    )
    if request_error:
        return jsonify({"code": request_error.get("status", 502), "message": request_error.get("message")}), request_error.get("status", 502)

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

        try:
            approved_requests.append(
                {
                    "swap_request_id": request_id_text,
                    "student_id": int(student_id),
                    "current_team": current_team_text,
                }
            )
        except (TypeError, ValueError):
            continue

    formation_config_data = None
    formation_payload, formation_error = _http_json(
        "GET",
        FORMATION_CONFIG_URL,
        label="formation-config service",
        params={"section_id": section_id},
    )
    if not formation_error:
        formation_config_data = _extract_data(formation_payload)

    if not approved_requests:
        new_team_roster = {
            "section_id": section_id,
            "teams": [
                {
                    "team_id": team_id,
                    "students": [{"student_id": sid} for sid in students],
                }
                for team_id, students in current_teams.items()
            ],
        }
        return (
            jsonify(
                {
                    "code": 200,
                    "message": "No approved requests to execute",
                    "data": {
                        "new_team_roster": new_team_roster,
                        "per_request_result": [],
                        "num_executed": 0,
                        "formation_config": formation_config_data,
                    },
                }
            ),
            200,
        )

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
                    "status": "FAILED",
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
                    "status": "EXECUTED",
                    "reason": None,
                }
            )
        else:
            per_request_result.append(
                {
                    "swap_request_id": req["swap_request_id"],
                    "student_id": req["student_id"],
                    "status": "FAILED",
                    "reason": "No compatible approved request from a different team",
                }
            )

    invariants_ok, invariants_error = _validate_execute_invariants(
        original_teams,
        new_teams,
        valid_requests,
    )
    if not invariants_ok:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": f"swap invariants violated: {invariants_error}",
                }
            ),
            409,
        )

    new_team_roster = {
        "section_id": section_id,
        "teams": [
            {
                "team_id": team_id,
                "students": [{"student_id": sid} for sid in students],
            }
            for team_id, students in new_teams.items()
        ],
    }

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
        return jsonify({"code": persist_error.get("status", 502), "message": persist_error.get("message")}), persist_error.get("status", 502)

    return (
        jsonify(
            {
                "code": 200,
                "message": "Swap execution completed",
                "data": {
                    "new_team_roster": new_team_roster,
                    "team_update_response": _extract_data(persist_response),
                    "per_request_result": per_request_result,
                    "num_executed": len(executed_ids),
                    "formation_config": formation_config_data,
                },
            }
        ),
        200,
    )

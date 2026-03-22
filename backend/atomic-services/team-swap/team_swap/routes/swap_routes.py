from flask import Blueprint, jsonify, request

from ..schemas.swap_schema import OptimizeRequestSchema
from ..solver import solve_swaps
from ..constraints import check_all_constraints


swap_bp = Blueprint("swap", __name__)
optimize_schema = OptimizeRequestSchema()


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

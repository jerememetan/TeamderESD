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
import os
import uuid

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request


load_dotenv()

app = Flask(__name__)

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "10"))

SWAP_REQUEST_URL = os.getenv("SWAP_REQUEST_URL", "http://localhost:3011/swap-request").rstrip("/")
COURSE_SERVICE_URL = os.getenv(
    "COURSE_SERVICE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Course/rest/Course/course",
).rstrip("/")
SECTION_URL = os.getenv("SECTION_URL", "http://localhost:3018/section").rstrip("/")
TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team").rstrip("/")
TEAM_SWAP_EXECUTE_URL = os.getenv("TEAM_SWAP_EXECUTE_URL", "http://localhost:3013/team-swap/execute").rstrip("/")
STUDENT_SERVICE_URL = os.getenv(
    "STUDENT_SERVICE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student/student",
).rstrip("/")
STUDENT_BULK_URL = os.getenv(
    "STUDENT_BULK_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student/students/bulk-info",
).rstrip("/")

REQUEST_STATUS_PENDING = "PENDING"
REQUEST_STATUS_APPROVED = "APPROVED"
REQUEST_STATUS_REJECTED = "REJECTED"
REQUEST_STATUS_EXECUTED = "EXECUTED"
REQUEST_STATUS_FAILED = "FAILED"

VALID_DECISIONS = {REQUEST_STATUS_APPROVED, REQUEST_STATUS_REJECTED}
TERMINAL_REQUEST_STATUSES = {REQUEST_STATUS_REJECTED, REQUEST_STATUS_EXECUTED, REQUEST_STATUS_FAILED}


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


def _int_or_none(value):
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _pick_first(record, keys):
    if not isinstance(record, dict):
        return None
    for key in keys:
        if key in record and record.get(key) is not None:
            return record.get(key)
    return None


def _normalize_uuid(raw_value, field_name):
    try:
        return uuid.UUID(str(raw_value))
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a valid UUID")


def _status_from_value(value):
    text = str(value or "").strip().upper()
    return text if text else REQUEST_STATUS_PENDING


def _normalize_status_filter(value):
    if value is None:
        return None
    normalized = str(value).strip().upper()
    if not normalized or normalized == "ALL":
        return None
    allowed = {
        REQUEST_STATUS_PENDING,
        REQUEST_STATUS_APPROVED,
        REQUEST_STATUS_REJECTED,
        REQUEST_STATUS_EXECUTED,
        REQUEST_STATUS_FAILED,
    }
    if normalized not in allowed:
        raise ValueError("status must be one of all,pending,approved,rejected,executed,failed")
    return normalized


def _extract_student_records(payload):
    body = _extract_data(payload)

    if isinstance(body, list):
        return body

    if isinstance(body, dict):
        for key in (
            "students",
            "Students",
            "student_list",
            "StudentList",
            "items",
            "Items",
            "records",
            "Records",
            "results",
            "Results",
        ):
            rows = body.get(key)
            if isinstance(rows, list):
                return rows

        if _pick_first(body, ["student_id", "studentId", "StudentID", "id", "Id"]) is not None:
            return [body]

    return []


def _normalize_student_row(record):
    if not isinstance(record, dict):
        return None

    profile = record.get("profile")
    source = profile if isinstance(profile, dict) else record

    student_id = _int_or_none(
        _pick_first(record, ["student_id", "studentId", "StudentID", "id", "Id"])
    )
    if student_id is None:
        student_id = _int_or_none(
            _pick_first(source, ["student_id", "studentId", "StudentID", "id", "Id"])
        )

    if student_id is None:
        return None

    return {
        "student_id": student_id,
        "name": _pick_first(source, ["name", "Name"]),
        "email": _pick_first(source, ["email", "Email"]),
    }


def _fetch_student_row_by_id(student_id):
    payload, error = _http_json(
        "GET",
        f"{STUDENT_SERVICE_URL}/{student_id}",
        label=f"student-service({student_id})",
    )
    if error:
        return None

    rows = _extract_student_records(payload)
    if rows:
        normalized = _normalize_student_row(rows[0])
        if normalized:
            return normalized

    data = _extract_data(payload)
    normalized = _normalize_student_row(data)
    if normalized:
        return normalized

    return None


def _fetch_student_rows(student_ids):
    if not student_ids:
        return {}, None

    body = {"StudentIDList": student_ids}
    payload, error = _http_json(
        "POST",
        STUDENT_BULK_URL,
        label="student-service bulk-info",
        payload=body,
    )
    if error:
        return None, error

    rows = _extract_student_records(payload)
    by_student_id = {}
    for row in rows:
        normalized = _normalize_student_row(row)
        if normalized:
            by_student_id[normalized["student_id"]] = normalized

    missing_ids = [sid for sid in student_ids if sid not in by_student_id]
    for student_id in missing_ids:
        fallback_row = _fetch_student_row_by_id(student_id)
        if fallback_row:
            by_student_id[student_id] = fallback_row

    return by_student_id, None


def _extract_course_rows(payload):
    body = _extract_data(payload)

    if isinstance(body, list):
        return body

    if isinstance(body, dict):
        for key in (
            "Courses",
            "courses",
            "course_list",
            "CourseList",
            "items",
            "Items",
            "records",
            "Records",
            "results",
            "Results",
        ):
            rows = body.get(key)
            if isinstance(rows, list):
                return rows

        if _pick_first(
            body,
            [
                "course_id",
                "courseId",
                "CourseID",
                "id",
                "Id",
                "code",
                "Code",
                "course_code",
                "CourseCode",
            ],
        ) is not None:
            return [body]

    return []


def _course_row_key(row):
    if not isinstance(row, dict):
        return None

    candidate = _pick_first(
        row,
        [
            "course_id",
            "courseId",
            "CourseID",
            "id",
            "Id",
            "code",
            "Code",
            "course_code",
            "CourseCode",
        ],
    )
    if candidate is None:
        return None
    return str(candidate).strip()


def _course_row_name(row):
    if not isinstance(row, dict):
        return None

    candidate = _pick_first(
        row,
        [
            "course_name",
            "courseName",
            "CourseName",
            "name",
            "Name",
            "title",
            "Title",
        ],
    )
    if candidate is None:
        return None

    text = str(candidate).strip()
    return text if text else None


def _resolve_course_summary(course_id):
    course_id_text = str(course_id) if course_id is not None else ""
    fallback_name = f"Course {course_id_text}" if course_id_text else "Course"
    fallback_code = f"COURSE-{course_id_text}" if course_id_text else "COURSE"

    payload, error = _http_json(
        "GET",
        COURSE_SERVICE_URL,
        label="course-service",
    )
    if error:
        return {"course_name": fallback_name, "course_code": fallback_code}

    rows = _extract_course_rows(payload)
    if not rows:
        return {"course_name": fallback_name, "course_code": fallback_code}

    target_row = None
    for row in rows:
        if _course_row_key(row) == course_id_text:
            target_row = row
            break

    if not isinstance(target_row, dict):
        return {"course_name": fallback_name, "course_code": fallback_code}

    course_name = _course_row_name(target_row) or fallback_name
    course_code = _pick_first(
        target_row,
        [
            "course_code",
            "courseCode",
            "CourseCode",
            "code",
            "Code",
        ],
    )
    if course_code is None or not str(course_code).strip():
        course_code = fallback_code

    return {"course_name": course_name, "course_code": str(course_code).strip()}


def _fetch_section_row(section_id):
    payload, error = _http_json(
        "GET",
        f"{SECTION_URL}/{section_id}",
        label="section-service",
    )
    if error:
        return None, error

    row = _extract_data(payload)
    if not isinstance(row, dict):
        return None, {"status": 502, "message": "section-service returned invalid payload"}

    return row, None


def _update_section_stage(section_id, stage):
    payload, error = _http_json(
        "PUT",
        f"{SECTION_URL}/{section_id}",
        label="section-service update",
        payload={"stage": stage},
    )
    if error:
        return None, error

    row = _extract_data(payload)
    if not isinstance(row, dict):
        return None, {"status": 502, "message": "section-service update returned invalid payload"}

    return row, None


def _fetch_section_teams(section_id):
    payload, error = _http_json(
        "GET",
        TEAM_URL,
        label="team service",
        params={"section_id": str(section_id)},
    )
    if error:
        return None, error

    data = _extract_data(payload)
    if not isinstance(data, dict):
        return None, {"status": 502, "message": "team service returned unexpected payload"}

    teams = data.get("teams")
    if not isinstance(teams, list):
        teams = []

    normalized_teams = []
    for index, team in enumerate(teams, start=1):
        if not isinstance(team, dict):
            continue

        team_id = str(team.get("team_id")) if team.get("team_id") else None
        if not team_id:
            continue

        team_number = _int_or_none(team.get("team_number"))
        if team_number is None:
            team_number = index

        student_rows = team.get("students")
        if not isinstance(student_rows, list):
            student_rows = []

        parsed_student_ids = []
        for student_row in student_rows:
            if not isinstance(student_row, dict):
                continue
            student_id = _int_or_none(student_row.get("student_id"))
            if student_id is None:
                continue
            parsed_student_ids.append(student_id)

        normalized_teams.append(
            {
                "team_id": team_id,
                "team_number": team_number,
                "students": parsed_student_ids,
            }
        )

    return normalized_teams, None


def _team_name_from_lookup(team_id, team_name_by_id):
    team_id_text = str(team_id) if team_id is not None else ""
    if team_id_text in team_name_by_id:
        return team_name_by_id[team_id_text]

    suffix = team_id_text[-8:] if team_id_text else "Unknown"
    return f"Team {suffix}"


def _build_review_row(request_row, section_row, student_rows_by_id, team_name_by_id):
    section_id = str(section_row.get("id") or "")
    course_id = _int_or_none(section_row.get("course_id"))
    section_number = _int_or_none(section_row.get("section_number"))
    stage = str(section_row.get("stage") or "")

    course_summary = _resolve_course_summary(course_id)

    request_id = str(request_row.get("swap_request_id") or "")
    student_id_int = _int_or_none(request_row.get("student_id"))
    student_id = str(student_id_int) if student_id_int is not None else ""
    student_row = student_rows_by_id.get(student_id_int, {}) if isinstance(student_rows_by_id, dict) else {}
    student_name = student_row.get("name") if isinstance(student_row, dict) else None
    student_email = student_row.get("email") if isinstance(student_row, dict) else None

    if not isinstance(student_name, str) or not student_name.strip():
        student_name = f"Student {student_id}" if student_id else "Student"

    current_team_id = str(request_row.get("current_team") or "")
    status_text = _status_from_value(request_row.get("status")).lower()

    return {
        "id": request_id,
        "sectionId": section_id,
        "courseId": course_id,
        "courseCode": course_summary.get("course_code"),
        "courseName": course_summary.get("course_name"),
        "sectionNumber": section_number,
        "stage": stage,
        "studentId": student_id,
        "studentName": student_name,
        "studentEmail": student_email,
        "currentTeamId": current_team_id,
        "currentTeamName": _team_name_from_lookup(current_team_id, team_name_by_id),
        "reason": str(request_row.get("reason") or ""),
        "status": status_text,
        "createdAt": str(request_row.get("created_at") or ""),
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "swap-orchestrator-service"}), 200


@app.route("/swap-orchestrator/submission/requests", methods=["POST"])
def submit_swap_request_composite():
    payload = request.get_json() or {}

    try:
        section_id = _normalize_uuid(payload.get("section_id"), "section_id")
        current_team = _normalize_uuid(payload.get("current_team"), "current_team")
    except ValueError as error:
        return jsonify({"code": 400, "message": str(error)}), 400

    student_id = _int_or_none(payload.get("student_id"))
    reason = payload.get("reason")

    if student_id is None:
        return jsonify({"code": 400, "message": "student_id is required"}), 400
    if not isinstance(reason, str) or not reason.strip():
        return jsonify({"code": 400, "message": "reason is required"}), 400

    section_row, section_error = _fetch_section_row(section_id)
    if section_error:
        return jsonify({"code": section_error.get("status", 502), "message": section_error.get("message")}), section_error.get("status", 502)

    stage = str(section_row.get("stage") or "").strip().lower()
    if stage != "formed":
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "swap submissions are only allowed when section stage is formed",
                    "data": {"section_id": str(section_id), "stage": stage},
                }
            ),
            409,
        )

    section_teams, team_error = _fetch_section_teams(section_id)
    if team_error:
        return jsonify({"code": team_error.get("status", 502), "message": team_error.get("message")}), team_error.get("status", 502)

    team_found = False
    student_found = False
    for team in section_teams:
        team_id = str(team.get("team_id"))
        if team_id == str(current_team):
            team_found = True
            if student_id in (team.get("students") or []):
                student_found = True
            break

    if not team_found:
        return jsonify({"code": 400, "message": "current_team not found in section teams"}), 400
    if not student_found:
        return jsonify({"code": 400, "message": "student_id does not belong to current_team"}), 400

    create_payload = {
        "student_id": student_id,
        "current_team": str(current_team),
        "reason": reason.strip(),
    }

    created, create_error = _http_json(
        "POST",
        SWAP_REQUEST_URL,
        label="swap-request create",
        payload=create_payload,
    )
    if create_error:
        return jsonify({"code": create_error.get("status", 502), "message": create_error.get("message")}), create_error.get("status", 502)

    created_row = _extract_data(created)
    if not isinstance(created_row, dict):
        return jsonify({"code": 502, "message": "swap-request create returned invalid payload"}), 502

    return (
        jsonify(
            {
                "code": 201,
                "data": {
                    "section_id": str(section_id),
                    "stage": stage,
                    "swap_request": created_row,
                },
            }
        ),
        201,
    )


@app.route("/swap-orchestrator/review/requests", methods=["GET"])
def list_review_requests_composite():
    section_id_raw = request.args.get("section_id")
    if not section_id_raw:
        return jsonify({"code": 400, "message": "section_id is required"}), 400

    try:
        section_id = _normalize_uuid(section_id_raw, "section_id")
    except ValueError as error:
        return jsonify({"code": 400, "message": str(error)}), 400

    try:
        status_filter = _normalize_status_filter(request.args.get("status"))
    except ValueError as error:
        return jsonify({"code": 400, "message": str(error)}), 400

    section_row, section_error = _fetch_section_row(section_id)
    if section_error:
        return jsonify({"code": section_error.get("status", 502), "message": section_error.get("message")}), section_error.get("status", 502)

    section_teams, team_error = _fetch_section_teams(section_id)
    if team_error:
        return jsonify({"code": team_error.get("status", 502), "message": team_error.get("message")}), team_error.get("status", 502)

    team_name_by_id = {}
    section_team_ids = set()
    for team in section_teams:
        team_id = str(team.get("team_id"))
        section_team_ids.add(team_id)
        team_name_by_id[team_id] = f"Team {team.get('team_number')}"

    request_payload, request_error = _http_json(
        "GET",
        SWAP_REQUEST_URL,
        label="swap-request list",
    )
    if request_error:
        return jsonify({"code": request_error.get("status", 502), "message": request_error.get("message")}), request_error.get("status", 502)

    rows = _extract_data(request_payload)
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list):
        rows = []

    filtered_rows = []
    student_ids = []
    summary = {
        "total": 0,
        "pending": 0,
        "approved": 0,
        "rejected": 0,
        "executed": 0,
        "failed": 0,
    }

    for row in rows:
        if not isinstance(row, dict):
            continue

        current_team = str(row.get("current_team") or "")
        if current_team not in section_team_ids:
            continue

        status_upper = _status_from_value(row.get("status"))
        if status_filter and status_upper != status_filter:
            continue

        summary["total"] += 1
        if status_upper == REQUEST_STATUS_PENDING:
            summary["pending"] += 1
        elif status_upper == REQUEST_STATUS_APPROVED:
            summary["approved"] += 1
        elif status_upper == REQUEST_STATUS_REJECTED:
            summary["rejected"] += 1
        elif status_upper == REQUEST_STATUS_EXECUTED:
            summary["executed"] += 1
        elif status_upper == REQUEST_STATUS_FAILED:
            summary["failed"] += 1

        filtered_rows.append(row)
        sid = _int_or_none(row.get("student_id"))
        if sid is not None:
            student_ids.append(sid)

    student_rows_by_id, student_error = _fetch_student_rows(sorted(set(student_ids)))
    if student_error or not isinstance(student_rows_by_id, dict):
        student_rows_by_id = {}

    processed_rows = [
        _build_review_row(
            request_row=row,
            section_row=section_row,
            student_rows_by_id=student_rows_by_id,
            team_name_by_id=team_name_by_id,
        )
        for row in filtered_rows
    ]

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "section": {
                        "id": str(section_row.get("id") or section_id),
                        "course_id": _int_or_none(section_row.get("course_id")),
                        "section_number": _int_or_none(section_row.get("section_number")),
                        "stage": section_row.get("stage"),
                    },
                    "summary": summary,
                    "requests": processed_rows,
                },
            }
        ),
        200,
    )


@app.route("/swap-orchestrator/review/requests/<uuid:swap_request_id>/decision", methods=["PATCH"])
def decide_review_request_composite(swap_request_id):
    payload = request.get_json() or {}
    decision = str(payload.get("decision") or "").strip().upper()
    if decision not in VALID_DECISIONS:
        return jsonify({"code": 400, "message": "decision must be APPROVED or REJECTED"}), 400

    existing_row_payload, existing_error = _http_json(
        "GET",
        f"{SWAP_REQUEST_URL}/{swap_request_id}",
        label="swap-request get",
    )
    if existing_error:
        return jsonify({"code": existing_error.get("status", 502), "message": existing_error.get("message")}), existing_error.get("status", 502)

    existing_row = _extract_data(existing_row_payload)
    if not isinstance(existing_row, dict):
        return jsonify({"code": 502, "message": "swap-request payload missing data"}), 502

    existing_status = _status_from_value(existing_row.get("status"))
    if existing_status in TERMINAL_REQUEST_STATUSES:
        message = "rejected requests are terminal" if existing_status == REQUEST_STATUS_REJECTED else "request is already finalized"
        return jsonify({"code": 409, "message": message}), 409

    _, update_error = _http_json(
        "PATCH",
        f"{SWAP_REQUEST_URL}/{swap_request_id}/status",
        label="swap-request status update",
        payload={"status": decision},
    )
    if update_error:
        return jsonify({"code": update_error.get("status", 502), "message": update_error.get("message")}), update_error.get("status", 502)

    updated_row_payload, updated_error = _http_json(
        "GET",
        f"{SWAP_REQUEST_URL}/{swap_request_id}",
        label="swap-request get",
    )
    if updated_error:
        return jsonify({"code": updated_error.get("status", 502), "message": updated_error.get("message")}), updated_error.get("status", 502)

    updated_row = _extract_data(updated_row_payload)
    if not isinstance(updated_row, dict):
        return jsonify({"code": 502, "message": "swap-request payload missing data"}), 502
    return jsonify({"code": 200, "data": {"swap_request": updated_row}}), 200


@app.route("/swap-orchestrator/sections/<uuid:section_id>/confirm", methods=["POST"])
def confirm_section_swaps(section_id):
    section_row, section_error = _fetch_section_row(section_id)
    if section_error:
        return jsonify({"code": section_error.get("status", 502), "message": section_error.get("message")}), section_error.get("status", 502)

    stage = str(section_row.get("stage") or "").strip().lower()
    if stage not in {"formed", "confirmed"}:
        return jsonify({"code": 409, "message": "section must be in formed stage to confirm swaps", "data": {"stage": stage}}), 409

    course_id = _int_or_none(section_row.get("course_id"))

    section_teams, team_error = _fetch_section_teams(section_id)
    if team_error:
        return jsonify({"code": team_error.get("status", 502), "message": team_error.get("message")}), team_error.get("status", 502)

    section_team_ids = {str(team.get("team_id")) for team in section_teams}

    list_payload, list_error = _http_json(
        "GET",
        SWAP_REQUEST_URL,
        label="swap-request list",
        params={"status": REQUEST_STATUS_APPROVED},
    )
    if list_error:
        return jsonify({"code": list_error.get("status", 502), "message": list_error.get("message")}), list_error.get("status", 502)

    request_rows = _extract_data(list_payload)
    if isinstance(request_rows, dict):
        request_rows = [request_rows]
    if not isinstance(request_rows, list):
        request_rows = []

    approved_rows = []
    approved_request_ids = []
    for row in request_rows:
        if not isinstance(row, dict):
            continue

        current_team = str(row.get("current_team") or "")
        if current_team not in section_team_ids:
            continue

        request_id = row.get("swap_request_id")
        if request_id is None:
            continue

        approved_rows.append(row)
        approved_request_ids.append(str(request_id))

    if not approved_rows:
        updated_section, update_error = _update_section_stage(section_id, "confirmed")
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

    execute_payload = {
        "section_id": str(section_id),
        "course_id": course_id,
        "approved_request_ids": approved_request_ids,
    }
    execute_response, execute_error = _http_json(
        "POST",
        TEAM_SWAP_EXECUTE_URL,
        label="team-swap execute",
        payload=execute_payload,
    )
    if execute_error:
        return jsonify({"code": execute_error.get("status", 502), "message": execute_error.get("message")}), execute_error.get("status", 502)

    execute_data = _extract_data(execute_response)
    if not isinstance(execute_data, dict):
        return jsonify({"code": 502, "message": "team-swap execute returned invalid payload"}), 502

    request_results = execute_data.get("per_request_result")
    if not isinstance(request_results, list):
        request_results = []

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

    updated_section, update_error = _update_section_stage(section_id, "confirmed")
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
                    "approved_request_count": len(approved_rows),
                    "executed_count": executed_count,
                    "failed_count": failed_count,
                    "execution": execute_data,
                },
            }
        ),
        200,
    )


@app.route("/swap-orchestrator/student-team", methods=["GET"])
def get_student_team():
    section_id_raw = request.args.get("section_id")
    student_id = _int_or_none(request.args.get("student_id"))

    if section_id_raw is None:
        return jsonify({"code": 400, "message": "section_id is required"}), 400
    if student_id is None:
        return jsonify({"code": 400, "message": "student_id is required"}), 400

    try:
        section_id = _normalize_uuid(section_id_raw, "section_id")
    except ValueError as error:
        return jsonify({"code": 400, "message": str(error)}), 400

    section_teams, team_error = _fetch_section_teams(section_id)
    if team_error:
        return jsonify({"code": team_error.get("status", 502), "message": team_error.get("message")}), team_error.get("status", 502)

    for team in section_teams:
        if student_id in team.get("students", []):
            return (
                jsonify(
                    {
                        "code": 200,
                        "data": {
                            "section_id": str(section_id),
                            "student_id": student_id,
                            "team": {
                                "team_id": team.get("team_id"),
                                "team_number": team.get("team_number"),
                                "students": [{"student_id": sid} for sid in team.get("students", [])],
                            },
                        },
                    }
                ),
                200,
            )

    return jsonify({"code": 404, "message": "student is not assigned to any team in this section"}), 404


register_swagger(app, "swap-orchestrator-service")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4005")), debug=True)

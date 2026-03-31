import logging
import os
import re
from typing import Any, Dict, List, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

from amqp_helper import publish_notification_message
from invoke_http import call_http, extract_data

app = Flask(__name__)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [formation-notification-service] %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration and service endpoints used by this composite
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "4000"))
ENROLLMENT_URL = os.getenv("ENROLLMENT_URL", "http://localhost:3005/enrollment")
STUDENT_SERVICE_URL = os.getenv("STUDENT_SERVICE_URL", "http://localhost:3001/api/students")
STUDENT_FORM_URL = os.getenv("STUDENT_FORM_URL", "http://localhost:3015/student-form")
SECTION_URL = os.getenv("SECTION_URL", "http://localhost:3018/section")
FORM_LINK_URL_TEMPLATE = os.getenv(
    "FORM_LINK_URL_TEMPLATE",
    "http://localhost:5173/student/{student_id}/form/{form_id}",
)
FORM_LINK_SUBJECT = os.getenv(
    "FORM_LINK_SUBJECT",
    "Action Required: Complete Your Teamder Student Form",
)
FORM_LINK_TEMPLATE_KEY = os.getenv("FORM_LINK_TEMPLATE_KEY", "student_form_link_v1")
FORM_LINK_GENERIC_MESSAGE = os.getenv(
    "FORM_LINK_GENERIC_MESSAGE",
    "Please complete your Teamder student form using the link provided.",
)
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

# Simple validation patterns
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SECTION_ID_RE = re.compile(r"^[A-Za-z0-9._:-]+$")

# Allow the frontend origin for specific endpoints used by UI
CORS(
    app,
    resources={
        r"/formation-notifications.*": {"origins": [FRONTEND_ORIGIN]},
    },
)


def _is_valid_email(value: Any) -> bool:
    # Return True when the value is a non-empty, valid-looking email.
    # Used to guard publishing notifications; if a student lacks a valid email
    # we record a failure and skip publishing.
    return isinstance(value, str) and bool(EMAIL_RE.match(value.strip()))


def _determine_empty_section_reason(section_id: str) -> str:
    # When a section has no enrollments, probe the Section service to decide
    # whether it's truly empty or missing. This calls SECTION_URL/{section_id}
    # (expected statuses 200 or 404) and returns a human-readable reason used
    # in the 404 response for the caller.
    section_resp = call_http(
        method="GET",
        url=f"{SECTION_URL.rstrip('/')}/{section_id}",
        timeout=REQUEST_TIMEOUT,
        expected_statuses={200, 404},
    )

    if section_resp["ok"] and section_resp["status_code"] == 200:
        # Section exists but contains no enrolled students
        return "no enrolled students"
    if section_resp["status_code"] == 404:
        # Section not found
        return "section not found"

    # If the Section service returned an unexpected error, log and default
    logger.warning(
        "section existence check failed; defaulting to no enrollments",
        extra={
            "section_id": section_id,
            "status_code": section_resp.get("status_code"),
            "error": section_resp.get("error"),
        },
    )
    return "no enrolled students"


def _extract_student_email(student_payload: Any) -> Optional[str]:
    # Extract email field from the student service payload. `invoke_http.`
    # `extract_data` is used to normalize the payload shape; it may return a
    # dict or other structure depending on the service response.
    data = extract_data(student_payload)
    if not isinstance(data, dict):
        return None
    email = data.get("email")
    return email.strip() if isinstance(email, str) else None


def _create_form(section_id: str, student_id: int) -> Optional[str]:
    # Create a student form by POSTing to the Student Form service. On
    # success this returns the created form id (string). On failure, logs
    # error details and returns None so the caller can record a dependency
    # failure.
    # Primary contract: Student Form service expects `students` array.
    # Fallback retries with `student_id` for compatibility with older payloads.
    candidate_payloads = [
        {"section_id": section_id, "students": [student_id]},
        {"section_id": section_id, "student_id": student_id},
    ]

    form_resp: Dict[str, Any] = {}
    for idx, candidate_payload in enumerate(candidate_payloads):
        form_resp = call_http(
            method="POST",
            url=STUDENT_FORM_URL,
            payload=candidate_payload,
            timeout=REQUEST_TIMEOUT,
            expected_statuses={200, 201},
        )
        if form_resp["ok"]:
            break

        should_retry_legacy = idx == 0 and form_resp.get("status_code") == 400
        if should_retry_legacy:
            logger.warning(
                "student-form payload rejected; retrying compatibility payload "
                "section_id=%s student_id=%s status_code=%s error=%s",
                section_id,
                student_id,
                form_resp.get("status_code"),
                form_resp.get("error"),
            )
            continue

        logger.error(
            "student-form creation failed "
            "section_id=%s student_id=%s status_code=%s error=%s",
            section_id,
            student_id,
            form_resp.get("status_code"),
            form_resp.get("error"),
        )
        return None

    if not form_resp.get("ok"):
        logger.error(
            "student-form creation failed after payload retries "
            "section_id=%s student_id=%s status_code=%s error=%s",
            section_id,
            student_id,
            form_resp.get("status_code"),
            form_resp.get("error"),
        )
        return None

    # The student-form service may return either a list of rows or a single dict
    rows = extract_data(form_resp["payload"])
    if isinstance(rows, list) and rows:
        row = rows[0] if isinstance(rows[0], dict) else {}
    elif isinstance(rows, dict):
        row = rows
    else:
        row = {}

    form_id = row.get("id") or row.get("form_id")
    if form_id is None:
        return None
    return str(form_id)


def _build_response(section_id: str, created: List[Dict[str, Any]], failed: List[Dict[str, Any]]) -> Dict[str, Any]:
    # Construct the JSON response returned to the API caller.
    return {
        "section_id": section_id,
        "notifications_created": created,
        "notifications_failed": failed,
        "summary": {
            "total_students": len(created) + len(failed),
            "success_count": len(created),
            "failed_count": len(failed),
        },
    }


def _resolve_status_code(created: List[Dict[str, Any]], failed: List[Dict[str, Any]]) -> int:
    # Return appropriate HTTP status based on created/failed outcomes.
    #
    # - 201: all notifications published
    # - 207: partial success
    # - 404: nothing to do (no students)
    # - 502: dependency failures (student/form)
    # - 503: publish failures (notification system)
    if created and not failed:
        return 201
    if created and failed:
        return 207

    if not failed:
        return 404

    publish_failures = [row for row in failed if row.get("reason") == "notification publish failed"]
    if publish_failures and len(publish_failures) == len(failed):
        return 503

    dependency_failures = [
        row
        for row in failed
        if row.get("reason") in {"student details unavailable", "form creation failed"}
    ]
    if dependency_failures and len(dependency_failures) == len(failed):
        return 502

    return 207


@app.route("/health", methods=["GET"])
def health():
    # Basic health check for the formation-notification composite service.
    return jsonify({"status": "ok", "service": "formation-notification-service"}), 200


@app.route("/formation-notifications", methods=["POST"])
def create_formation_notifications():
    # Main orchestration endpoint.
    #
    # Steps:
    # 1. Validate `section_id` from the request payload.
    # 2. Call Enrollment service to list students in the section.
    # 3. For each student id:
    #    a. Call Student service to fetch details (email).
    #    b. Validate email; skip if missing/invalid.
    #    c. Call Student Form service to create a form for that student.
    #    d. Build a notification payload and publish it to AMQP via
    #       `amqp_helper`.
    #    e. Record successes and failures for the response body.
    payload = request.get_json(silent=True) or {}
    section_id = payload.get("section_id")
    print(f"{section_id} is the section_id")
    # Validate section id input
    if not isinstance(section_id, str) or not section_id.strip():
        return jsonify({"code": 400, "message": "section_id is required and must be a non-empty string"}), 400
    section_id = section_id.strip()
    if not SECTION_ID_RE.match(section_id):
        return jsonify({"code": 400, "message": "section_id format is invalid"}), 400

    logger.info(
        "formation notification request received",
        extra={"section_id": section_id},
    )

    # --- Enrollment service: fetch enrolled students for the section ---
    # External call: GET ENROLLMENT_URL?section_id={section_id}
    enrollment_resp = call_http(
        method="GET",
        url=ENROLLMENT_URL,
        params={"section_id": section_id},
        timeout=REQUEST_TIMEOUT,
    )
    if not enrollment_resp["ok"]:
        # Enrollment fetch failed; classify as timeout/connection or dependency error
        logger.error(
            "enrollment fetch failed",
            extra={
                "section_id": section_id,
                "status_code": enrollment_resp.get("status_code"),
                "error": enrollment_resp.get("error"),
            },
        )
        status = 503 if enrollment_resp.get("error_type") in {"timeout", "connection"} else 502
        return jsonify(
            {
                "code": status,
                "message": "failed to fetch enrollments",
                "section_id": section_id,
                "error": enrollment_resp.get("error"),
            }
        ), status

    enrollments = extract_data(enrollment_resp["payload"])
    if not isinstance(enrollments, list):
        enrollments = []

    # Normalize and deduplicate student ids
    student_ids: List[int] = []
    for row in enrollments:
        sid = row.get("student_id") if isinstance(row, dict) else None
        try:
            sid = int(sid)
        except (TypeError, ValueError):
            sid = None
        if sid is not None:
            student_ids.append(sid)
    student_ids = list(dict.fromkeys(student_ids))

    if not student_ids:
        # No students: probe Section service to give a helpful message
        reason = _determine_empty_section_reason(section_id)
        response = _build_response(section_id, created=[], failed=[])
        response["message"] = reason
        return jsonify(response), 404

    created: List[Dict[str, Any]] = []
    failed: List[Dict[str, Any]] = []

    # Process each student sequentially: fetch student -> create form -> publish
    for student_id in student_ids:
        # --- Student service: fetch student details (including email) ---
        student_resp = call_http(
            method="GET",
            url=f"{STUDENT_SERVICE_URL.rstrip('/')}/{student_id}",
            timeout=REQUEST_TIMEOUT,
        )
        if not student_resp["ok"]:
            # dependency failure: cannot fetch student details
            failed.append({"student_id": student_id, "reason": "student details unavailable"})
            continue

        email = _extract_student_email(student_resp["payload"])
        if not _is_valid_email(email):
            # missing or invalid email; record as a failed notification
            failed.append({"student_id": student_id, "reason": "missing email"})
            continue

        # --- Student-form service: create a form for this student ---
        form_id = _create_form(section_id, student_id)
        if not form_id:
            # dependency failure creating the form
            failed.append({"student_id": student_id, "reason": "form creation failed"})
            continue

        # Build the public-facing link and notification payload
        form_link = FORM_LINK_URL_TEMPLATE.format(student_id=student_id, form_id=form_id)
        message_payload = {
            # Primary notification payload contract consumed by
            # atomic notification service: to/subject/body.
            "to": email,
            "subject": FORM_LINK_SUBJECT,
            "body": f"{FORM_LINK_GENERIC_MESSAGE}\n\n{form_link}",
            "metadata": {
                "event_type": "FormLinkGenerated",
                "student_id": student_id,
                "section_id": section_id,
                "form_id": form_id,
                "template_key": FORM_LINK_TEMPLATE_KEY,
                "idempotency_key": f"{section_id}:{student_id}:{form_id}",
            },
            # Keep legacy fields for compatibility with existing consumers.
            "event_type": "FormLinkGenerated",
            "student_id": student_id,
            "email": email,
            "section_id": section_id,
            "form_id": form_id,
            "form_url": form_link,
            "message": FORM_LINK_GENERIC_MESSAGE,
            "template_key": FORM_LINK_TEMPLATE_KEY,
            "idempotency_key": f"{section_id}:{student_id}:{form_id}",
        }

        # --- Publish notification message via AMQP helper ---
        # `publish_notification_message` returns (ok, error). On failure we log
        # and record a publish failure.
        publish_ok, publish_error = publish_notification_message(message_payload)
        if not publish_ok:
            logger.error(
                "notification publish failed",
                extra={
                    "section_id": section_id,
                    "student_id": student_id,
                    "error": publish_error,
                },
            )
            failed.append({"student_id": student_id, "reason": "notification publish failed"})
            continue

        # Notification message published successfully
        created.append(
            {
                "student_id": student_id,
                "email": email,
                "form_id": form_id,
                "form_link": form_link,
            }
        )

    response_body = _build_response(section_id, created=created, failed=failed)
    status_code = _resolve_status_code(created=created, failed=failed)
    return jsonify(response_body), status_code


if __name__ == "__main__":
    # Run for local development. In production the app is run by a WSGI server.
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4004")), debug=True)

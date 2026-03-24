import os

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "10"))
ENROLLMENT_URL = os.getenv("ENROLLMENT_URL", "http://localhost:3005/enrollment")
STUDENT_FORM_TEMPLATE_URL = os.getenv(
    "STUDENT_FORM_TEMPLATE_URL", "http://localhost:3015/student-form/template"
)
STUDENT_FORM_LINK_BATCH_URL = os.getenv(
    "STUDENT_FORM_LINK_BATCH_URL", "http://localhost:3015/student-form/links/batch"
)
STUDENT_SERVICE_URL = os.getenv("STUDENT_SERVICE_URL", "http://localhost:3001/api/students")
NOTIFICATION_URL = os.getenv(
    "NOTIFICATION_URL", "http://localhost:3016/notification/send-form-link"
)
DEFAULT_FORM_BASE_URL = os.getenv(
    "DEFAULT_FORM_BASE_URL", "http://localhost:5173/student/fill-form"
)


def _safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {}


def _extract_data(payload):
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def _fetch_student_email(student_id):
    resp = requests.get(f"{STUDENT_SERVICE_URL}/{student_id}", timeout=REQUEST_TIMEOUT)
    if resp.status_code < 200 or resp.status_code >= 300:
        return None
    payload = _safe_json(resp)
    data = _extract_data(payload)
    if isinstance(data, dict):
        return data.get("email")
    return None


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "formation-notification-service"}), 200


@app.route("/formation-notification/send-form-links", methods=["POST"])
def send_form_links():
    payload = request.get_json() or {}
    section_id = payload.get("section_id")
    criteria = payload.get("criteria")
    custom_entries = payload.get("custom_entries", [])
    base_form_url = payload.get("base_form_url", DEFAULT_FORM_BASE_URL)

    if not section_id:
        return jsonify({"code": 400, "message": "section_id is required"}), 400
    if not isinstance(criteria, dict):
        return jsonify({"code": 400, "message": "criteria object is required"}), 400

    # 1) fetch enrolled students in section
    enrollment_resp = requests.get(
        ENROLLMENT_URL, params={"section_id": section_id}, timeout=REQUEST_TIMEOUT
    )
    if enrollment_resp.status_code < 200 or enrollment_resp.status_code >= 300:
        return jsonify({"code": 502, "message": "failed to fetch enrollments"}), 502

    enrollment_rows = _extract_data(_safe_json(enrollment_resp))
    if not isinstance(enrollment_rows, list):
        enrollment_rows = []
    student_ids = []
    for row in enrollment_rows:
        if isinstance(row, dict) and row.get("student_id") is not None:
            try:
                student_ids.append(int(row.get("student_id")))
            except (TypeError, ValueError):
                continue
    student_ids = list(dict.fromkeys(student_ids))
    if not student_ids:
        return jsonify(
            {
                "code": 200,
                "data": {
                    "section_id": section_id,
                    "message": "no students enrolled in section",
                    "success_count": 0,
                    "failure_count": 0,
                    "statuses": [],
                },
            }
        ), 200

    # 2) generate/persist section template and unique links
    template_payload = {
        "section_id": section_id,
        "criteria": criteria,
        "custom_entries": custom_entries,
    }
    template_resp = requests.post(
        STUDENT_FORM_TEMPLATE_URL, json=template_payload, timeout=REQUEST_TIMEOUT
    )
    if template_resp.status_code < 200 or template_resp.status_code >= 300:
        return jsonify({"code": 502, "message": "failed to generate student form template"}), 502

    link_resp = requests.post(
        STUDENT_FORM_LINK_BATCH_URL,
        json={
            "section_id": section_id,
            "student_ids": student_ids,
            "base_form_url": base_form_url,
        },
        timeout=REQUEST_TIMEOUT,
    )
    if link_resp.status_code < 200 or link_resp.status_code >= 300:
        return jsonify({"code": 502, "message": "failed to generate form links"}), 502

    link_rows = _extract_data(_safe_json(link_resp))
    if not isinstance(link_rows, list):
        link_rows = []
    link_by_student = {}
    for row in link_rows:
        if isinstance(row, dict) and row.get("student_id") is not None:
            link_by_student[int(row["student_id"])] = row.get("form_url")

    # 3) fetch relevant student details
    recipients = []
    lookup_failures = []
    for sid in student_ids:
        email = _fetch_student_email(sid)
        if not email:
            lookup_failures.append(
                {
                    "student_id": sid,
                    "email": None,
                    "delivery_status": "failed",
                    "message": "student email not found",
                }
            )
            continue
        recipients.append(
            {
                "section_id": section_id,
                "student_id": sid,
                "email": email,
                "form_url": link_by_student.get(sid),
            }
        )

    # 4/5) AMQP-backed notification service send + status feedback
    notify_resp = requests.post(
        NOTIFICATION_URL,
        json={"recipients": recipients},
        timeout=REQUEST_TIMEOUT,
    )
    if notify_resp.status_code < 200 or notify_resp.status_code >= 300:
        return jsonify({"code": 502, "message": "failed to send notifications"}), 502
    notify_data = _extract_data(_safe_json(notify_resp)) or {}

    statuses = list(notify_data.get("statuses", [])) + lookup_failures
    success_count = int(notify_data.get("success_count", 0))
    failure_count = int(notify_data.get("failure_count", 0)) + len(lookup_failures)

    # 6) response payload for instructor UI rendering
    return jsonify(
        {
            "code": 200,
            "data": {
                "section_id": section_id,
                "generated_links_count": len(link_rows),
                "attempted_notifications": len(recipients),
                "success_count": success_count,
                "failure_count": failure_count,
                "statuses": statuses,
            },
        }
    ), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4004")), debug=True)

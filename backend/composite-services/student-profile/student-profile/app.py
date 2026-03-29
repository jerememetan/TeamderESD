import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("student-profile-service")

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "8"))
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "20"))

OUTSYSTEMS_BASE_URL = os.getenv(
    "OUTSYSTEMS_BASE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student",
).rstrip("/")
ENROLLMENT_URL = os.getenv("ENROLLMENT_URL", "http://localhost:3005/enrollment")
STUDENT_BULK_URL = os.getenv(
    "STUDENT_BULK_URL", f"{OUTSYSTEMS_BASE_URL}/students/bulk-info"
)
FORM_DATA_URL = os.getenv("FORM_DATA_URL", "http://localhost:3010/form-data")
REPUTATION_URL = os.getenv("REPUTATION_URL", "http://localhost:3006/reputation")
TOPIC_PREFERENCE_URL = os.getenv(
    "TOPIC_PREFERENCE_URL", "http://localhost:3009/topic-preference"
)
COMPETENCE_URL = os.getenv("COMPETENCE_URL", "http://localhost:3008/competence")


def safe_json(response):
    try:
        return response.json()
    except ValueError:
        return {}


def extract_data(payload):
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def http_get(url, params=None):
    return requests.get(url, params=params, timeout=REQUEST_TIMEOUT)


def http_post(url, payload=None):
    return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)


def normalize_profile(record):
    if not isinstance(record, dict):
        return None

    student_id = record.get("student_id")
    if student_id is None:
        student_id = record.get("studentId")
    if student_id is None:
        student_id = record.get("id")

    if student_id is None:
        logger.warning("profile record missing student_id keys", extra={"record": record})
        return None

    try:
        student_id = int(student_id)
    except (TypeError, ValueError):
        logger.warning("profile student_id is invalid", extra={"record": record})
        return None

    return student_id, {
        "name": record.get("name"),
        "email": record.get("email"),
        "school_id": record.get("school_id"),
        "year": record.get("year"),
        "gpa": record.get("gpa"),
        "gender": record.get("gender"),
    }


def parse_bulk_records(payload):
    body = extract_data(payload)
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        for key in ("students", "Students", "student_list", "StudentList"):
            if isinstance(body.get(key), list):
                return body.get(key)
    logger.warning("unrecognized OutSystems bulk response shape", extra={"payload": payload})
    return []


def load_profiles(student_ids):
    response = http_post(STUDENT_BULK_URL, payload={"StudentIDList": student_ids})
    payload = safe_json(response)

    if response.status_code < 200 or response.status_code >= 300:
        message = (
            payload.get("message")
            if isinstance(payload, dict)
            else "student profile lookup failed"
        )
        return None, message

    profiles_by_student_id = {}
    for record in parse_bulk_records(payload):
        normalized = normalize_profile(record)
        if normalized is None:
            continue
        sid, profile = normalized
        if sid in student_ids:
            profiles_by_student_id[sid] = profile

    return profiles_by_student_id, None


def fetch_form_data(section_id, student_id):
    response = http_get(
        FORM_DATA_URL, params={"section_id": section_id, "student_id": student_id}
    )
    if response.status_code != 200:
        return None

    data = extract_data(safe_json(response))
    if not isinstance(data, dict):
        return None

    return {"buddy_id": data.get("buddy_id"), "mbti": data.get("mbti")}


def fetch_reputation(student_id):
    response = http_get(f"{REPUTATION_URL}/{student_id}")
    if response.status_code != 200:
        return None

    data = extract_data(safe_json(response))
    if not isinstance(data, dict):
        return None

    if "score" in data:
        return data.get("score")
    return data.get("reputation_score")


def fetch_topic_preferences(section_id, student_id):
    response = http_get(
        TOPIC_PREFERENCE_URL, params={"section_id": section_id, "student_id": student_id}
    )
    if response.status_code != 200:
        return None

    rows = extract_data(safe_json(response))
    if not isinstance(rows, list) or len(rows) == 0:
        return None

    ranked = sorted(rows, key=lambda item: item.get("rank", 10**9))
    return [item.get("topic_id") for item in ranked if item.get("topic_id") is not None]


def fetch_competences(section_id, student_id):
    response = http_get(
        COMPETENCE_URL, params={"section_id": section_id, "student_id": student_id}
    )
    if response.status_code != 200:
        return None

    rows = extract_data(safe_json(response))
    if not isinstance(rows, list) or len(rows) == 0:
        return None

    competences = []
    for row in rows:
        if isinstance(row, dict):
            competences.append(
                {
                    "skill_id": row.get("skill_id"),
                    "skill_level": row.get("skill_level"),
                }
            )
    return competences


def collect_student_details(section_id, student_id):
    result = {
        "buddy_id": None,
        "mbti": None,
        "reputation_score": None,
        "topic_preferences": None,
        "competences": None,
    }

    fetchers = {
        "form_data": lambda: fetch_form_data(section_id, student_id),
        "reputation_score": lambda: fetch_reputation(student_id),
        "topic_preferences": lambda: fetch_topic_preferences(section_id, student_id),
        "competences": lambda: fetch_competences(section_id, student_id),
    }

    with ThreadPoolExecutor(max_workers=4) as executor:
        future_map = {executor.submit(fn): key for key, fn in fetchers.items()}
        for future in as_completed(future_map):
            key = future_map[future]
            try:
                value = future.result()
            except Exception:
                logger.exception(
                    "downstream fetch failed",
                    extra={
                        "service_component": key,
                        "section_id": section_id,
                        "student_id": student_id,
                    },
                )
                continue

            if key == "form_data":
                if isinstance(value, dict):
                    result["buddy_id"] = value.get("buddy_id")
                    result["mbti"] = value.get("mbti")
            else:
                result[key] = value

    return result


def compose_profile(base_profile, details):
    return {
        "name": base_profile.get("name") if isinstance(base_profile, dict) else None,
        "email": base_profile.get("email") if isinstance(base_profile, dict) else None,
        "school_id": base_profile.get("school_id") if isinstance(base_profile, dict) else None,
        "year": base_profile.get("year") if isinstance(base_profile, dict) else None,
        "gpa": base_profile.get("gpa") if isinstance(base_profile, dict) else None,
        "gender": base_profile.get("gender") if isinstance(base_profile, dict) else None,
        "buddy_id": details.get("buddy_id"),
        "mbti": details.get("mbti"),
        "reputation_score": details.get("reputation_score"),
        "topic_preferences": details.get("topic_preferences"),
        "competences": details.get("competences"),
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "student-profile-service"}), 200


@app.route("/student-profile", methods=["GET"])
def get_student_profile():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"code": 400, "message": "section_id is required"}), 400

    try:
        enrollment_response = http_get(ENROLLMENT_URL, params={"section_id": section_id})
    except requests.RequestException:
        logger.exception("failed to call enrollment service", extra={"section_id": section_id})
        return jsonify({"code": 502, "message": "failed to fetch enrollments"}), 502

    enrollment_payload = safe_json(enrollment_response)
    if enrollment_response.status_code < 200 or enrollment_response.status_code >= 300:
        logger.error(
            "enrollment service returned non-2xx",
            extra={
                "section_id": section_id,
                "status_code": enrollment_response.status_code,
                "payload": enrollment_payload,
            },
        )
        return jsonify({"code": 502, "message": "failed to fetch enrollments"}), 502

    enrollments = extract_data(enrollment_payload)
    if not isinstance(enrollments, list):
        enrollments = []

    student_ids = []
    for enrollment in enrollments:
        sid = enrollment.get("student_id") if isinstance(enrollment, dict) else None
        try:
            sid = int(sid)
        except (TypeError, ValueError):
            sid = None
        if sid is not None:
            student_ids.append(sid)
    student_ids = list(dict.fromkeys(student_ids))

    if not student_ids:
        return jsonify({"code": 200, "data": {"section_id": section_id, "students": []}}), 200

    try:
        profiles_by_student_id, profile_error = load_profiles(student_ids)
    except requests.RequestException:
        logger.exception(
            "failed to call OutSystems student bulk endpoint",
            extra={"section_id": section_id, "url": STUDENT_BULK_URL},
        )
        return jsonify({"code": 502, "message": "failed to fetch student profiles"}), 502

    if profiles_by_student_id is None:
        logger.error(
            "OutSystems bulk endpoint returned non-2xx",
            extra={
                "section_id": section_id,
                "error": profile_error,
                "url": STUDENT_BULK_URL,
            },
        )
        return jsonify({"code": 502, "message": "failed to fetch student profiles"}), 502

    details_by_student_id = {}
    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, max(len(student_ids), 1))) as executor:
        future_map = {
            executor.submit(collect_student_details, section_id, sid): sid
            for sid in student_ids
        }
        for future in as_completed(future_map):
            sid = future_map[future]
            try:
                details_by_student_id[sid] = future.result()
            except Exception:
                logger.exception(
                    "failed to aggregate student details",
                    extra={"section_id": section_id, "student_id": sid},
                )
                details_by_student_id[sid] = {
                    "buddy_id": None,
                    "mbti": None,
                    "reputation_score": None,
                    "topic_preferences": None,
                    "competences": None,
                }

    students = []
    for sid in student_ids:
        details = details_by_student_id.get(
            sid,
            {
                "buddy_id": None,
                "mbti": None,
                "reputation_score": None,
                "topic_preferences": None,
                "competences": None,
            },
        )
        students.append(
            {
                "student_id": sid,
                "profile": compose_profile(profiles_by_student_id.get(sid), details),
            }
        )

    return jsonify({"code": 200, "data": {"section_id": section_id, "students": students}}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4001")), debug=True)

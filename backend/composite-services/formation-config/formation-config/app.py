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
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from .schemas import FormationRequestSchema, FormationResponseSchema, FormationGetResponseSchema


app = Flask(__name__)
CORS(
    app,
    resources={r"/formation-config*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")}},
)

def safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {}


def error_body_preview(resp, limit=300):
    try:
        text = (resp.text or "").strip()
    except Exception:
        return None
    if not text:
        return None
    return text[:limit]


def downstream_error(service_name, resp, fallback_message):
    payload = safe_json(resp)
    if payload:
        return jsonify(
            {
                "error": fallback_message,
                "details": {
                    "service": service_name,
                    "status_code": resp.status_code,
                    "payload": payload,
                },
            }
        ), 502
    return jsonify(
        {
            "error": fallback_message,
            "details": {
                "service": service_name,
                "status_code": resp.status_code,
                "raw_body": error_body_preview(resp),
            },
        }
    ), 502

CRITERIA_URL = os.getenv("CRITERIA_URL", "http://localhost:3004/criteria")
TOPIC_URL = os.getenv("TOPIC_URL", "http://localhost:3003/topic")
SKILL_URL = os.getenv("SKILL_URL", "http://localhost:3002/skill")

register_swagger(app, 'formation-config-service')

@app.route("/formation-config", methods=["POST"])
def aggregate():
    payload = request.get_json()
    if not payload or "course_id" not in payload or "section_id" not in payload:
        return jsonify({"error": "Missing course_id, section_id, or payload"}), 400
    course_id = payload["course_id"]
    section_id = payload["section_id"]
    results = {"criteria": None, "topics": [], "skills": []}

    # --- Criteria ---
    criteria_data = payload.get("criteria")
    if not criteria_data or not isinstance(criteria_data, dict):
        return jsonify({"error": "Missing or invalid criteria. Please provide a valid criteria object."}), 400
    criteria_payload = {
        **criteria_data,
        "course_id": course_id,
        "section_id": section_id,
    }
    try:
        resp = requests.get(CRITERIA_URL, params={"section_id": section_id})
    except requests.RequestException:
        return jsonify({"error": "Unable to reach criteria service"}), 502

    if resp.status_code != 200:
        return downstream_error("criteria", resp, "Failed to read existing criteria")

    criteria_lookup = safe_json(resp)
    existing = criteria_lookup.get("data") if isinstance(criteria_lookup, dict) else None
    try:
        if existing:
            write_resp = requests.put(CRITERIA_URL + f"?section_id={section_id}", json=criteria_payload)
        else:
            write_resp = requests.post(CRITERIA_URL, json=criteria_payload)
    except requests.RequestException:
        return jsonify({"error": "Unable to write criteria"}), 502

    if write_resp.status_code < 200 or write_resp.status_code >= 300:
        return downstream_error("criteria", write_resp, "Failed to save criteria")
    results["criteria"] = safe_json(write_resp)

    # --- Project Topics ---
    topics = payload.get("topics", [])
    requests.delete(TOPIC_URL, params={"section_id": section_id})
    for topic in topics:
        if "section_id" not in topic:
            topic["section_id"] = section_id
        post_resp = requests.post(TOPIC_URL, json=topic)
        results["topics"].append(safe_json(post_resp))

    # --- Skills ---
    skills = payload.get("skills", [])
    requests.delete(SKILL_URL, params={"section_id": section_id})
    for skill in skills:
        if "section_id" not in skill:
            skill["section_id"] = section_id
        post_resp = requests.post(SKILL_URL, json=skill)
        results["skills"].append(safe_json(post_resp))

    return jsonify(results), 200


# Attach OpenAPI schemas for swagger_helper
aggregate._openapi_request_schema = FormationRequestSchema
aggregate._openapi_response_schema = FormationResponseSchema


@app.route("/formation-config", methods=["GET"])
def aggregate_get():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"error": "Missing section_id in query params"}), 400

    try:
        crit_resp = requests.get(CRITERIA_URL, params={"section_id": section_id})
    except requests.RequestException:
        return jsonify({"error": "Unable to reach criteria service"}), 502
    crit_data = None
    course_id = None
    if crit_resp.status_code == 200:
        crit_json = safe_json(crit_resp)
        if crit_json.get("data"):
            crit_data = crit_json["data"][0] if isinstance(crit_json["data"], list) and crit_json["data"] else crit_json["data"]
            course_id = crit_data.get("course_id")
            crit_data.pop("course_id", None)
            crit_data.pop("section_id", None)
    elif crit_resp.status_code >= 500:
        return downstream_error("criteria", crit_resp, "Failed to fetch criteria")

    try:
        topic_resp = requests.get(TOPIC_URL, params={"section_id": section_id})
    except requests.RequestException:
        return jsonify({"error": "Unable to reach topic service"}), 502
    topics = []
    if topic_resp.status_code == 200:
        topic_json = safe_json(topic_resp)
        for t in topic_json.get("data", []):
            topics.append({"topic_label": t.get("topic_label")})

    try:
        skill_resp = requests.get(SKILL_URL, params={"section_id": section_id})
    except requests.RequestException:
        return jsonify({"error": "Unable to reach skill service"}), 502
    skills = []
    if skill_resp.status_code == 200:
        skill_json = safe_json(skill_resp)
        for s in skill_json.get("data", []):
            skills.append({
                "skill_label": s.get("skill_label"),
                "skill_importance": s.get("skill_importance")
            })

    result = {
        "course_id": course_id,
        "section_id": section_id,
        "criteria": crit_data,
        "topics": topics,
        "skills": skills
    }
    return jsonify(result), 200


aggregate_get._openapi_response_schema = FormationGetResponseSchema

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 4000)), debug=True)


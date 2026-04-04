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
from typing import Any, Dict, Optional
from uuid import UUID

import requests
from flask import Flask, jsonify, request
from marshmallow import ValidationError

_p = Path(__file__).resolve()
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

try:
    from error_publisher import publish_error_event
except ModuleNotFoundError:
    _logger = logging.getLogger("student-form-submission-service")

    def publish_error_event(**kwargs):
        _logger.warning(
            "error_publisher module is unavailable; skipping RabbitMQ publish. payload=%s",
            kwargs,
        )
        return False

from schemas import SubmitRequestSchema, SubmitResultSchema

app = Flask(__name__)
register_swagger(app, "student-form-submission-service")

SERVICE_NAME = "student-form-submission-service"
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "8"))

FORM_DATA_URL = os.getenv("FORM_DATA_URL", "http://localhost:3010/form-data")
COMPETENCE_URL = os.getenv("COMPETENCE_URL", "http://localhost:3008/competence")
TOPIC_PREFERENCE_URL = os.getenv("TOPIC_PREFERENCE_URL", "http://localhost:3009/topic-preference")
STUDENT_FORM_URL = os.getenv("STUDENT_FORM_URL", "http://localhost:3015/student-form")

submit_schema = SubmitRequestSchema()


def _safe_json(resp: requests.Response) -> Dict[str, Any]:
    try:
        payload = resp.json()
        return payload if isinstance(payload, dict) else {"data": payload}
    except Exception:
        return {}


def _downstream_error(service_name: str, response: Optional[requests.Response], message: str, *, request_context: Optional[Dict[str, Any]] = None):
    http_status = 502 if response is None else response.status_code
    response_payload = None if response is None else _safe_json(response)
    publish_error_event(
        source_service=SERVICE_NAME,
        downstream_service=service_name,
        error_code=f"{service_name.upper()}_DOWNSTREAM_ERROR",
        error_message=message,
        http_status=http_status,
        request_context=request_context,
        response_payload=response_payload,
    )
    return jsonify({
        "error": {
            "code": "DOWNSTREAM_ERROR",
            "message": message,
            "service": service_name,
            "status_code": http_status,
        }
    }), 502


def _call_json(method: str, url: str, *, params: Optional[Dict[str, Any]] = None, payload: Optional[Dict[str, Any]] = None):
    return requests.request(method=method, url=url, params=params, json=payload, timeout=REQUEST_TIMEOUT)


def _normalize_json_value(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dict):
        return {key: _normalize_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalize_json_value(item) for item in value]
    return value


@app.route("/student-form-submission/submit", methods=["POST"])
def submit_form():
    payload = request.get_json() or {}
    try:
        data = submit_schema.load(payload)
    except ValidationError as err:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": err.messages}}), 400

    section_id = str(data["section_id"])
    student_id = int(data["student_id"])
    buddy_id = data.get("buddy_id")
    mbti = data.get("mbti")
    skill_scores = _normalize_json_value(data.get("skill_scores") or [])
    topic_rankings = _normalize_json_value(data.get("topic_rankings") or [])

    writes: Dict[str, Any] = {}

    has_form_data = buddy_id is not None or bool(mbti)
    if has_form_data:
        form_data_payload = _normalize_json_value({
            "section_id": section_id,
            "student_id": student_id,
            "buddy_id": buddy_id,
            "mbti": mbti,
        })
        try:
            form_data_resp = _call_json("POST", FORM_DATA_URL, payload=form_data_payload)
        except requests.RequestException:
            return _downstream_error(
                "student-form-data",
                None,
                "Failed to save student form data",
                request_context={"section_id": section_id, "student_id": student_id, "operation": "submit-form-data"},
            )
        if form_data_resp.status_code not in (200, 201):
            return _downstream_error(
                "student-form-data",
                form_data_resp,
                "Failed to save student form data",
                request_context={"section_id": section_id, "student_id": student_id, "operation": "submit-form-data"},
            )
        writes["form_data"] = _safe_json(form_data_resp)

    if len(skill_scores) > 0:
        invalid_scores = []
        for row in skill_scores:
            try:
                skill_level = int(row.get("skill_level", -1))
            except (TypeError, ValueError):
                invalid_scores.append(row)
                continue

            if skill_level < 0 or skill_level > 5:
                invalid_scores.append(row)
        if invalid_scores:
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "skill_level must be between 0 and 5"}}), 400

        competence_payload = _normalize_json_value({
            "section_id": section_id,
            "student_id": student_id,
            "competences": skill_scores,
        })
        try:
            competence_resp = _call_json("POST", COMPETENCE_URL, payload=competence_payload)
        except requests.RequestException:
            return _downstream_error(
                "student-competence",
                None,
                "Failed to save student competences",
                request_context={"section_id": section_id, "student_id": student_id, "operation": "submit-competence"},
            )
        if competence_resp.status_code not in (200, 201):
            return _downstream_error(
                "student-competence",
                competence_resp,
                "Failed to save student competences",
                request_context={"section_id": section_id, "student_id": student_id, "operation": "submit-competence"},
            )
        writes["competence"] = _safe_json(competence_resp)

    if len(topic_rankings) > 0:
        try:
            rank_values = [int(row.get("rank", 0)) for row in topic_rankings]
        except (TypeError, ValueError):
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "topic rank must be an integer"}}), 400

        if sorted(rank_values) != list(range(1, len(rank_values) + 1)):
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "topic ranks must be unique and contiguous starting at 1"}}), 400

        preference_payload = _normalize_json_value({
            "section_id": section_id,
            "student_id": student_id,
            "preferences": topic_rankings,
        })
        try:
            topic_pref_resp = _call_json("POST", TOPIC_PREFERENCE_URL, payload=preference_payload)
        except requests.RequestException:
            return _downstream_error(
                "student-topic-preference",
                None,
                "Failed to save student topic preferences",
                request_context={"section_id": section_id, "student_id": student_id, "operation": "submit-topic-preference"},
            )
        if topic_pref_resp.status_code not in (200, 201):
            return _downstream_error(
                "student-topic-preference",
                topic_pref_resp,
                "Failed to save student topic preferences",
                request_context={"section_id": section_id, "student_id": student_id, "operation": "submit-topic-preference"},
            )
        writes["topic_preference"] = _safe_json(topic_pref_resp)

    student_form_payload = _normalize_json_value(
        {
            "section_id": section_id,
            "student_id": student_id,
        }
    )
    try:
        student_form_resp = _call_json("PUT", STUDENT_FORM_URL, payload=student_form_payload)
    except requests.RequestException:
        return _downstream_error(
            "student-form",
            None,
            "Failed to mark student form as submitted",
            request_context={"section_id": section_id, "student_id": student_id, "operation": "mark-submitted"},
        )

    if student_form_resp.status_code not in (200, 201):
        return _downstream_error(
            "student-form",
            student_form_resp,
            "Failed to mark student form as submitted",
            request_context={"section_id": section_id, "student_id": student_id, "operation": "mark-submitted"},
        )
    writes["student_form"] = _safe_json(student_form_resp)

    result = {
        "section_id": section_id,
        "student_id": student_id,
        "submitted": True,
        "writes": writes,
    }
    return jsonify({"data": result}), 200


submit_form._openapi_request_schema = SubmitRequestSchema()
submit_form._openapi_response_schema = SubmitResultSchema()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 4006)), debug=True)

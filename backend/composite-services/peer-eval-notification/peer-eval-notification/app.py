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

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Set
import logging
import os

from flask import Flask, request, jsonify

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

from error_publisher import publish_error_event

from amqp_helper import publish_peer_eval_notification_batch
from invoke_http import call_http, extract_data
from schemas import (
    PeerEvalInitiateRequestSchema,
    PeerEvalCloseRequestSchema,
    PeerEvalInitiateResponseSchema,
    PeerEvalCloseResponseSchema,
)

app = Flask(__name__)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [peer-eval-notification-service] %(message)s",
)
logger = logging.getLogger(__name__)
SERVICE_NAME = "peer-eval-notification-service"

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "8"))
MAX_PARALLEL_WORKERS = int(os.getenv("MAX_PARALLEL_WORKERS", "20"))
TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team")
STUDENT_PROFILE_URL = os.getenv("STUDENT_PROFILE_URL", "http://localhost:4001/student-profile")
STUDENT_SERVICE_URL = os.getenv(
    "STUDENT_SERVICE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student/student",
)
PEER_EVAL_URL = os.getenv("PEER_EVAL_URL", "http://localhost:3020/peer-eval")
REPUTATION_URL = os.getenv("REPUTATION_URL", "http://localhost:3006/reputation")
FRONTEND_PEER_EVAL_URL = os.getenv(
    "FRONTEND_PEER_EVAL_URL", "http://localhost:5173/student/peer-evaluation"
)


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


def _extract_round_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    data = payload.get("data", {}) if isinstance(payload, dict) else {}
    return data if isinstance(data, dict) else {}


def _build_student_email_map(students_payload: Dict[str, Any]) -> Dict[int, str]:
    student_email_map: Dict[int, str] = {}
    students = students_payload.get("data", {}).get("students", []) if isinstance(students_payload, dict) else []
    for student in students:
        if not isinstance(student, dict):
            continue
        student_id = student.get("student_id")
        profile = student.get("profile", {})
        if not isinstance(profile, dict):
            continue
        email = profile.get("email")
        try:
            student_id = int(student_id)
        except (TypeError, ValueError):
            continue
        if isinstance(email, str) and email.strip():
            student_email_map[student_id] = email.strip()
    return student_email_map


def _fetch_student_email(student_id: int) -> Optional[str]:
    student_resp = call_http(
        method="GET",
        url=f"{STUDENT_SERVICE_URL.rstrip('/')}/{student_id}",
        timeout=REQUEST_TIMEOUT,
    )
    if not student_resp["ok"]:
        return None

    payload = extract_data(student_resp.get("payload"))
    if not isinstance(payload, dict):
        return None
    email = payload.get("email")
    if not isinstance(email, str):
        return None
    email = email.strip()
    return email or None


def _collect_student_ids_from_teams(teams: List[Dict[str, Any]]) -> Set[int]:
    student_ids: Set[int] = set()
    for team in teams:
        if not isinstance(team, dict):
            continue
        for student in team.get("students", []):
            if not isinstance(student, dict):
                continue
            try:
                sid = int(student.get("student_id"))
            except (TypeError, ValueError):
                continue
            student_ids.add(sid)
    return student_ids


def _build_eval_notification(
    *,
    email: str,
    section_id: str,
    student_id: int,
    round_id: str,
    title: str,
    due_at: Optional[str],
    eval_link: str,
) -> Dict[str, Any]:
    idempotency_key = f"{round_id}:{student_id}"
    return {
        "to": email,
        "subject": f"Peer Evaluation Round - {title}",
        "body": (
            f"Hello,\n\n"
            f"A new peer evaluation round has been initiated for your section.\n\n"
            f"Please evaluate your teammates using the link below:\n"
            f"{eval_link}\n\n"
            f"Due date: {due_at or 'To be announced'}\n\n"
            f"Thank you."
        ),
        "metadata": {
            "event_type": "PeerEvalInitiated",
            "round_id": round_id,
            "student_id": student_id,
            "section_id": section_id,
            "idempotency_key": idempotency_key,
        },
        "event_type": "PeerEvalInitiated",
        "student_id": student_id,
        "email": email,
        "section_id": section_id,
        "round_id": round_id,
        "idempotency_key": idempotency_key,
    }


register_swagger(app, "peer-eval-notification-service")


@app.route("/peer-eval-notifications/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "peer-eval-notification-service"}), 200


@app.route("/peer-eval-notifications/initiate", methods=["POST"])
def initiate_peer_eval():
    payload = request.get_json(silent=True) or {}
    section_id = payload.get("section_id")
    if not section_id:
        return jsonify({"code": 400, "message": "section_id is required"}), 400

    title = payload.get("title", f"Peer Evaluation - Section {str(section_id)[:8]}")
    due_at = payload.get("due_at")

    round_resp = call_http(
        method="POST",
        url=f"{PEER_EVAL_URL}/rounds",
        payload={"section_id": section_id, "title": title, "due_at": due_at},
        timeout=REQUEST_TIMEOUT,
        expected_statuses={201, 409},
    )
    if not round_resp["ok"] and round_resp.get("status_code") != 409:
        publish_downstream_error(
            "peer-evaluation",
            "PEER_EVAL_ROUND_CREATE_FAILED",
            round_resp.get("error") or "failed to create peer eval round",
            request_context={"section_id": section_id, "operation": "create-round"},
            http_status=round_resp.get("status_code"),
            response_payload=round_resp,
        )
        return jsonify({"code": 502, "message": f"failed to create peer eval round: {round_resp.get('error')}"}), 502

    if round_resp.get("status_code") == 409:
        return jsonify(round_resp.get("payload", {"code": 409, "message": "active round already exists"})), 409

    round_data = _extract_round_payload(round_resp.get("payload") or {})
    round_id = round_data.get("round_id")

    team_resp = call_http(
        method="GET",
        url=TEAM_URL,
        params={"section_id": section_id},
        timeout=REQUEST_TIMEOUT,
    )
    if not team_resp["ok"]:
        publish_downstream_error(
            "team",
            "TEAM_LOOKUP_FAILED",
            team_resp.get("error") or "failed to fetch team roster",
            request_context={"section_id": section_id, "operation": "load-teams"},
            http_status=team_resp.get("status_code"),
            response_payload=team_resp,
        )
        return jsonify(
            {
                "code": 200,
                "data": {
                    "round": round_data,
                    "notification_status": "skipped - could not fetch teams",
                },
            }
        ), 200

    teams = extract_data(team_resp.get("payload"))
    if isinstance(teams, dict):
        teams = teams.get("teams", [])
    if not isinstance(teams, list):
        teams = []

    profile_resp = call_http(
        method="GET",
        url=STUDENT_PROFILE_URL,
        params={"section_id": section_id},
        timeout=REQUEST_TIMEOUT,
    )
    if not profile_resp["ok"]:
        publish_downstream_error(
            "student-profile",
            "STUDENT_PROFILE_LOOKUP_FAILED",
            profile_resp.get("error") or "failed to fetch student profile",
            request_context={"section_id": section_id, "operation": "load-student-profiles"},
            http_status=profile_resp.get("status_code"),
            response_payload=profile_resp,
        )

    student_email_map = _build_student_email_map(profile_resp.get("payload") or {})
    team_student_ids = _collect_student_ids_from_teams(teams)

    missing_ids = [sid for sid in team_student_ids if sid not in student_email_map]
    if missing_ids:
        worker_count = min(max(1, len(missing_ids)), MAX_PARALLEL_WORKERS)
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            future_map = {executor.submit(_fetch_student_email, sid): sid for sid in missing_ids}
            for future in as_completed(future_map):
                sid = future_map[future]
                try:
                    email = future.result()
                except Exception:
                    email = None
                if email:
                    student_email_map[sid] = email

    eval_link = payload.get("eval_link", f"{FRONTEND_PEER_EVAL_URL.rstrip('/')}/{round_id}")
    notifications: List[Dict[str, Any]] = []
    notification_results = {"sent": 0, "failed": 0, "skipped": 0}

    for team in teams:
        team_students = team.get("students", []) if isinstance(team, dict) else []
        for student in team_students:
            sid = student.get("student_id") if isinstance(student, dict) else None
            try:
                sid = int(sid)
            except (TypeError, ValueError):
                notification_results["skipped"] += 1
                continue

            email = student_email_map.get(sid)
            if not email:
                notification_results["skipped"] += 1
                continue

            notifications.append(
                _build_eval_notification(
                    email=email,
                    section_id=str(section_id),
                    student_id=sid,
                    round_id=str(round_id),
                    title=title,
                    due_at=due_at,
                    eval_link=eval_link,
                )
            )

    if notifications:
        publish_ok, publish_error = publish_peer_eval_notification_batch(
            section_id=str(section_id),
            round_id=str(round_id),
            title=title,
            due_at=due_at,
            notifications=notifications,
        )
        if publish_ok:
            notification_results["sent"] = len(notifications)
        else:
            notification_results["failed"] = len(notifications)
            publish_downstream_error(
                "rabbitmq",
                "NOTIFICATION_PUBLISH_FAILED",
                publish_error or "failed to publish peer eval notifications",
                request_context={"section_id": section_id, "round_id": round_id, "operation": "publish-notifications"},
                response_payload={"notifications_count": len(notifications)},
            )

    return jsonify(
        {
            "code": 201,
            "data": {
                "round": round_data,
                "teams_count": len(teams),
                "notification_results": notification_results,
            },
        }
    ), 201


@app.route("/peer-eval-notifications/close", methods=["POST"])
def close_peer_eval():
    payload = request.get_json(silent=True) or {}
    round_id = payload.get("round_id")
    if not round_id:
        return jsonify({"code": 400, "message": "round_id is required"}), 400

    close_resp = call_http(
        method="POST",
        url=f"{PEER_EVAL_URL}/rounds/{round_id}/close",
        payload={},
        timeout=REQUEST_TIMEOUT,
        expected_statuses={200},
    )
    if not close_resp["ok"]:
        publish_downstream_error(
            "peer-evaluation",
            "PEER_EVAL_ROUND_CLOSE_FAILED",
            close_resp.get("error") or "failed to close peer eval round",
            request_context={"round_id": round_id, "operation": "close-round"},
            http_status=close_resp.get("status_code"),
            response_payload=close_resp,
        )
        return jsonify({"code": 502, "message": f"failed to close peer eval round: {close_resp.get('error')}"}), 502

    close_data = _extract_round_payload(close_resp.get("payload") or {})
    round_info = close_data.get("round", {}) if isinstance(close_data, dict) else {}
    deltas = close_data.get("reputation_deltas", []) if isinstance(close_data, dict) else []

    reputation_results = {"updated": 0, "failed": 0}

    for delta_entry in deltas:
        if not isinstance(delta_entry, dict):
            continue
        student_id = delta_entry.get("student_id")
        delta = delta_entry.get("delta", 0)

        if delta == 0:
            continue

        rep_resp = call_http(
            method="PUT",
            url=f"{REPUTATION_URL}/{student_id}",
            payload={"delta": delta},
            timeout=REQUEST_TIMEOUT,
            expected_statuses={200},
        )
        if rep_resp["ok"]:
            reputation_results["updated"] += 1
        else:
            reputation_results["failed"] += 1
            publish_downstream_error(
                "reputation",
                "REPUTATION_UPDATE_FAILED",
                rep_resp.get("error") or "failed to update reputation",
                request_context={"round_id": round_id, "student_id": student_id, "operation": "update-reputation"},
                http_status=rep_resp.get("status_code"),
                response_payload=rep_resp,
            )

    return jsonify(
        {
            "code": 200,
            "data": {
                "round": round_info,
                "reputation_deltas": deltas,
                "reputation_update_results": reputation_results,
            },
        }
    ), 200


initiate_peer_eval._openapi_request_schema = PeerEvalInitiateRequestSchema
initiate_peer_eval._openapi_response_schema = PeerEvalInitiateResponseSchema
close_peer_eval._openapi_request_schema = PeerEvalCloseRequestSchema
close_peer_eval._openapi_response_schema = PeerEvalCloseResponseSchema


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4008")), debug=True)

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

from typing import Any, Dict
import logging
import os

from flask import Flask, jsonify, request

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
from invoke_http import call_http, extract_data
from schemas import PeerEvalCloseRequestSchema, PeerEvalCloseResponseSchema

app = Flask(__name__)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [peer-eval-close-service] %(message)s",
)
logger = logging.getLogger(__name__)
SERVICE_NAME = "peer-eval-close-service"

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "8"))
PEER_EVAL_URL = os.getenv("PEER_EVAL_URL", "http://localhost:3020/peer-eval")
REPUTATION_URL = os.getenv("REPUTATION_URL", "http://localhost:3006/reputation")
SECTION_URL = os.getenv("SECTION_URL", "http://section-service:3018/section")


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


register_swagger(app, "peer-eval-close-service")


@app.route("/peer-eval-close/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "peer-eval-close-service"}), 200


@app.route("/peer-eval-close", methods=["POST"])
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
    section_id = round_info.get("section_id") if isinstance(round_info, dict) else None

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

    section_update_result = {
        "attempted": False,
        "updated": False,
        "section_id": section_id,
        "from_stage": None,
        "to_stage": "completed",
        "message": "section_id not available from closed round",
    }

    if section_id:
        section_update_result["attempted"] = True
        section_get_resp = call_http(
            method="GET",
            url=f"{SECTION_URL}/{section_id}",
            timeout=REQUEST_TIMEOUT,
            expected_statuses={200},
        )

        if not section_get_resp["ok"]:
            section_update_result["message"] = (
                section_get_resp.get("error") or "failed to fetch section before stage update"
            )
            publish_downstream_error(
                "section",
                "SECTION_FETCH_FAILED",
                section_update_result["message"],
                request_context={"round_id": round_id, "section_id": section_id, "operation": "fetch-section"},
                http_status=section_get_resp.get("status_code"),
                response_payload=section_get_resp,
            )
        else:
            section_payload = extract_data(section_get_resp.get("payload") or {})
            current_stage = str((section_payload or {}).get("stage") or "").strip().lower()
            section_update_result["from_stage"] = current_stage or None

            if current_stage == "completed":
                section_update_result["updated"] = True
                section_update_result["message"] = "section already in completed stage"
            elif current_stage and current_stage != "confirmed":
                section_update_result["message"] = (
                    f"section stage is {current_stage}; skipping automatic transition to completed"
                )
            else:
                section_put_resp = call_http(
                    method="PUT",
                    url=f"{SECTION_URL}/{section_id}",
                    payload={"stage": "completed"},
                    timeout=REQUEST_TIMEOUT,
                    expected_statuses={200},
                )
                if section_put_resp["ok"]:
                    section_update_result["updated"] = True
                    section_update_result["message"] = "section stage updated to completed"
                else:
                    section_update_result["message"] = (
                        section_put_resp.get("error") or "failed to update section stage to completed"
                    )
                    publish_downstream_error(
                        "section",
                        "SECTION_STAGE_UPDATE_FAILED",
                        section_update_result["message"],
                        request_context={
                            "round_id": round_id,
                            "section_id": section_id,
                            "operation": "set-stage-completed",
                        },
                        http_status=section_put_resp.get("status_code"),
                        response_payload=section_put_resp,
                    )

    return jsonify(
        {
            "code": 200,
            "data": {
                "round": round_info,
                "reputation_deltas": deltas,
                "reputation_update_results": reputation_results,
                "section_update": section_update_result,
            },
        }
    ), 200


close_peer_eval._openapi_request_schema = PeerEvalCloseRequestSchema
close_peer_eval._openapi_response_schema = PeerEvalCloseResponseSchema


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4009")), debug=True)

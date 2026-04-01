from typing import Any, Dict, Optional, Set

import requests


def extract_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def _safe_json(response: requests.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return {}


def call_http(
    method: str,
    url: str,
    timeout: float,
    params: Optional[Dict[str, Any]] = None,
    payload: Optional[Dict[str, Any]] = None,
    expected_statuses: Optional[Set[int]] = None,
) -> Dict[str, Any]:
    try:
        response = requests.request(
            method=method.upper(),
            url=url,
            params=params,
            json=payload,
            timeout=timeout,
        )
    except requests.Timeout as exc:
        return {
            "ok": False,
            "status_code": None,
            "payload": None,
            "error": str(exc),
            "error_type": "timeout",
        }
    except requests.RequestException as exc:
        return {
            "ok": False,
            "status_code": None,
            "payload": None,
            "error": str(exc),
            "error_type": "connection",
        }

    body = _safe_json(response)
    valid_statuses = expected_statuses or set(range(200, 300))
    if response.status_code not in valid_statuses:
        error_message = "non-success response"
        if isinstance(body, dict):
            nested_error = body.get("error")
            if isinstance(nested_error, dict) and isinstance(nested_error.get("message"), str):
                error_message = nested_error["message"]
            elif isinstance(body.get("message"), str):
                error_message = body["message"]
            elif isinstance(body.get("error"), str):
                error_message = body["error"]
        return {
            "ok": False,
            "status_code": response.status_code,
            "payload": body,
            "error": error_message,
            "error_type": "http",
        }

    return {
        "ok": True,
        "status_code": response.status_code,
        "payload": body,
        "error": None,
        "error_type": None,
    }


def put_section_stage(
    section_base_url: str,
    section_id: str,
    stage: str,
    timeout: float,
) -> Dict[str, Any]:
    section_url = f"{section_base_url.rstrip('/')}/{section_id}"
    return call_http(
        method="PUT",
        url=section_url,
        payload={"stage": stage},
        timeout=timeout,
        expected_statuses={200},
    )

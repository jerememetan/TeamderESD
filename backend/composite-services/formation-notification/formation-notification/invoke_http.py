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
        return {
            "ok": False,
            "status_code": response.status_code,
            "payload": body,
            "error": body.get("message") if isinstance(body, dict) else "non-success response",
            "error_type": "http",
        }

    return {
        "ok": True,
        "status_code": response.status_code,
        "payload": body,
        "error": None,
        "error_type": None,
    }

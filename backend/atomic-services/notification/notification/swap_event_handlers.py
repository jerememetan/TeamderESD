import logging
import os
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = float(os.getenv("SWAP_REQUEST_TIMEOUT", os.getenv("REQUEST_TIMEOUT", "10")))
MAX_RECIPIENT_LOOKUP_BATCH = int(
    os.getenv("SWAP_MAX_RECIPIENT_LOOKUP_BATCH", os.getenv("MAX_RECIPIENT_LOOKUP_BATCH", "200"))
)

SWAP_REQUEST_URL = os.getenv("SWAP_REQUEST_URL", "http://localhost:3011/swap-request").rstrip("/")
TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team").rstrip("/")
STUDENT_SERVICE_URL = os.getenv(
    "STUDENT_SERVICE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student/student",
).rstrip("/")
STUDENT_BULK_URL = os.getenv(
    "STUDENT_BULK_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student/students/bulk-info",
).rstrip("/")

SWAP_WINDOW_SCHEDULED_SUBJECT = os.getenv(
    "SWAP_WINDOW_SCHEDULED_SUBJECT",
    "Team swap window scheduled",
)
SWAP_WINDOW_SCHEDULED_BODY = os.getenv(
    "SWAP_WINDOW_SCHEDULED_BODY",
    (
        "Hello {student_name},\n\n"
        "A team swap window has been scheduled for section {section_id}.\n"
        "Opens: {open_at}\n"
        "Closes: {close_at}\n"
    ),
)
SWAP_WINDOW_OPENED_SUBJECT = os.getenv(
    "SWAP_WINDOW_OPENED_SUBJECT",
    "Team swap window is now open",
)
SWAP_WINDOW_OPENED_BODY = os.getenv(
    "SWAP_WINDOW_OPENED_BODY",
    (
        "Hello {student_name},\n\n"
        "The team swap window is now open for section {section_id}.\n"
        "Opens: {open_at}\n"
        "Closes: {close_at}\n"
    ),
)
SWAP_REJECTED_SUBJECT = os.getenv(
    "SWAP_REJECTED_SUBJECT",
    "Your swap request was rejected",
)
SWAP_REJECTED_BODY = os.getenv(
    "SWAP_REJECTED_BODY",
    (
        "Hello {student_name},\n\n"
        "Your team swap request for section {section_id} was rejected by the instructor.\n"
        "Reason: {reason}\n"
    ),
)
SWAP_FAILED_SUBJECT = os.getenv(
    "SWAP_FAILED_SUBJECT",
    "Your swap request could not be executed",
)
SWAP_FAILED_BODY = os.getenv(
    "SWAP_FAILED_BODY",
    (
        "Hello {student_name},\n\n"
        "Your team swap request could not be executed during this swap cycle.\n"
        "Please review your current team assignment in the student portal.\n"
    ),
)
SWAP_EXECUTED_SUBJECT = os.getenv(
    "SWAP_EXECUTED_SUBJECT",
    "Team swap completed for your section",
)
SWAP_EXECUTED_BODY = os.getenv(
    "SWAP_EXECUTED_BODY",
    (
        "Hello {student_name},\n\n"
        "A team swap has been executed for section {section_id}.\n"
        "Your current team: {recipient_team_name} ({recipient_team_id})\n"
        "Swap pair: {old_team_name} ({old_team_id}) <-> {new_team_name} ({new_team_id})\n"
    ),
)

EVENT_DEDUPE_TTL_SECONDS = int(
    os.getenv("SWAP_EVENT_DEDUPE_TTL_SECONDS", os.getenv("EVENT_DEDUPE_TTL_SECONDS", "900"))
)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_processed_event_lock = threading.Lock()
_processed_event_keys: Dict[str, float] = {}


class _SafeTemplateDict(dict):
    def __missing__(self, key: str) -> str:
        return "N/A"


def _safe_json(response: requests.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return {}


def _extract_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def _extract_error_message(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message
        error = payload.get("error")
        if isinstance(error, str) and error.strip():
            return error
        if isinstance(error, dict):
            nested = error.get("message")
            if isinstance(nested, str) and nested.strip():
                return nested
    return fallback


def _http_json(
    method: str,
    url: str,
    label: str,
    params: Optional[Dict[str, Any]] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
    try:
        response = requests.request(
            method=method,
            url=url,
            params=params,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        return None, {
            "status": 502,
            "message": f"failed to call {label}: {str(exc)}",
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


def _int_or_none(value: Any) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _pick_first(record: Dict[str, Any], keys: List[str]) -> Any:
    if not isinstance(record, dict):
        return None
    for key in keys:
        if key in record and record.get(key) is not None:
            return record.get(key)
    return None


def _is_valid_email(value: Any) -> bool:
    return isinstance(value, str) and bool(EMAIL_RE.match(value.strip()))


def _normalize_student_row(record: Any) -> Optional[Dict[str, Any]]:
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


def _extract_student_records(payload: Any) -> List[Dict[str, Any]]:
    body = _extract_data(payload)

    if isinstance(body, list):
        return [row for row in body if isinstance(row, dict)]

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
                return [row for row in rows if isinstance(row, dict)]

        if _pick_first(body, ["student_id", "studentId", "StudentID", "id", "Id"]) is not None:
            return [body]

    return []


def _fetch_student_row_by_id(student_id: int) -> Optional[Dict[str, Any]]:
    payload, error = _http_json(
        "GET",
        f"{STUDENT_SERVICE_URL}/{student_id}",
        label=f"student-service({student_id})",
    )
    if error:
        logger.warning("Failed to fetch student row by id=%s: %s", student_id, error.get("message"))
        return None

    rows = _extract_student_records(payload)
    if rows:
        normalized = _normalize_student_row(rows[0])
        if normalized:
            return normalized

    normalized = _normalize_student_row(_extract_data(payload))
    if normalized:
        return normalized

    return None


def _chunked(values: List[int], size: int) -> List[List[int]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def _fetch_student_rows(
    student_ids: List[int],
) -> Tuple[Optional[Dict[int, Dict[str, Any]]], Optional[Dict[str, Any]]]:
    if not student_ids:
        return {}, None

    deduped_ids = sorted(set(student_ids))
    by_student_id: Dict[int, Dict[str, Any]] = {}

    for chunk in _chunked(deduped_ids, max(1, MAX_RECIPIENT_LOOKUP_BATCH)):
        payload, error = _http_json(
            "POST",
            STUDENT_BULK_URL,
            label="student-service bulk-info",
            payload={"StudentIDList": chunk},
        )
        if error:
            return None, error

        rows = _extract_student_records(payload)
        for row in rows:
            normalized = _normalize_student_row(row)
            if normalized:
                by_student_id[normalized["student_id"]] = normalized

    missing_ids = [sid for sid in deduped_ids if sid not in by_student_id]
    for sid in missing_ids:
        fallback_row = _fetch_student_row_by_id(sid)
        if fallback_row:
            by_student_id[sid] = fallback_row

    return by_student_id, None


def _fetch_swap_request(swap_request_id: str) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    payload, error = _http_json(
        "GET",
        f"{SWAP_REQUEST_URL}/{swap_request_id}",
        label="swap-request service",
    )
    if error:
        return None, error

    row = _extract_data(payload)
    if not isinstance(row, dict):
        return None, {"status": 502, "message": "swap-request payload missing data"}

    return row, None


def _fetch_section_teams(section_id: str) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
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

    team_by_id: Dict[str, Dict[str, Any]] = {}
    student_to_team: Dict[int, str] = {}

    for index, team in enumerate(teams, start=1):
        if not isinstance(team, dict):
            continue

        raw_team_id = team.get("team_id")
        if raw_team_id is None:
            continue
        team_id = str(raw_team_id)

        team_number = _int_or_none(team.get("team_number"))
        if team_number is None:
            team_number = index

        raw_students = team.get("students")
        if not isinstance(raw_students, list):
            raw_students = []

        students: List[int] = []
        for student_row in raw_students:
            if not isinstance(student_row, dict):
                continue
            sid = _int_or_none(student_row.get("student_id"))
            if sid is None:
                continue
            students.append(sid)
            student_to_team[sid] = team_id

        team_by_id[team_id] = {
            "team_id": team_id,
            "team_number": team_number,
            "students": students,
        }

    return {"team_by_id": team_by_id, "student_to_team": student_to_team}, None


def _render_template(template: str, context: Dict[str, Any]) -> str:
    normalized = {key: ("N/A" if value is None else str(value)) for key, value in context.items()}
    try:
        return template.format_map(_SafeTemplateDict(normalized))
    except Exception:
        return template


def _build_email_message(
    to_email: str,
    subject: str,
    body: str,
    metadata: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "to": to_email,
        "subject": subject,
        "body": body,
        "metadata": metadata,
    }


def event_dedupe_key(payload: Dict[str, Any], event_type: str) -> Optional[str]:
    key_parts = [
        event_type,
        payload.get("event_id"),
        payload.get("swap_request_id"),
        payload.get("student_id"),
        payload.get("section_id"),
        payload.get("created_at"),
    ]
    filtered = [str(part) for part in key_parts if part not in {None, ""}]
    if not filtered:
        return None
    return "|".join(filtered)


def mark_swap_event_once(event_key: Optional[str]) -> bool:
    if event_key is None:
        return True

    now = time.time()
    with _processed_event_lock:
        expired = [
            key for key, ts in _processed_event_keys.items() if now - ts > EVENT_DEDUPE_TTL_SECONDS
        ]
        for key in expired:
            _processed_event_keys.pop(key, None)

        if event_key in _processed_event_keys:
            return False

        _processed_event_keys[event_key] = now
        return True


def _resolve_single_recipient(payload: Dict[str, Any]) -> Tuple[Optional[int], Optional[str], str]:
    student_id = _int_or_none(payload.get("student_id"))
    email = payload.get("email") if isinstance(payload.get("email"), str) else None
    name = payload.get("name") if isinstance(payload.get("name"), str) else "Student"

    if _is_valid_email(email):
        return student_id, email.strip(), name

    if student_id is None:
        return None, None, name

    rows, error = _fetch_student_rows([student_id])
    if error or not isinstance(rows, dict):
        return student_id, None, name

    row = rows.get(student_id, {})
    fetched_email = row.get("email") if isinstance(row.get("email"), str) else None
    fetched_name = row.get("name") if isinstance(row.get("name"), str) else name

    if _is_valid_email(fetched_email):
        return student_id, fetched_email.strip(), fetched_name

    return student_id, None, fetched_name


def _team_name(team_id: Optional[str], team_by_id: Dict[str, Dict[str, Any]]) -> str:
    if team_id is None:
        return "Unknown team"

    info = team_by_id.get(str(team_id), {})
    team_number = _int_or_none(info.get("team_number"))
    if team_number is not None:
        return f"Team {team_number}"
    return f"Team {str(team_id)[-8:]}"


def _build_window_event_messages(
    payload: Dict[str, Any],
    event_type: str,
) -> Tuple[List[Dict[str, Any]], Optional[str], int]:
    student_id, email, student_name = _resolve_single_recipient(payload)
    if not _is_valid_email(email):
        return [], "missing recipient email", 1

    context = {
        "student_name": student_name or "Student",
        "student_id": student_id,
        "section_id": payload.get("section_id"),
        "open_at": payload.get("open_at"),
        "close_at": payload.get("close_at"),
    }

    if event_type == "SwapWindowScheduled":
        subject = _render_template(SWAP_WINDOW_SCHEDULED_SUBJECT, context)
        body = _render_template(SWAP_WINDOW_SCHEDULED_BODY, context)
    else:
        subject = _render_template(SWAP_WINDOW_OPENED_SUBJECT, context)
        body = _render_template(SWAP_WINDOW_OPENED_BODY, context)

    metadata = {
        "event_type": event_type,
        "student_id": student_id,
        "section_id": payload.get("section_id"),
        "cycle_id": payload.get("cycle_id"),
        "idempotency_key": f"{event_type}:{payload.get('cycle_id')}:{student_id}",
    }

    return [_build_email_message(email, subject, body, metadata)], None, 0


def _build_rejected_messages(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Optional[str], int]:
    student_id, email, student_name = _resolve_single_recipient(payload)
    if not _is_valid_email(email):
        return [], "missing recipient email", 1

    context = {
        "student_name": student_name or "Student",
        "student_id": student_id,
        "section_id": payload.get("section_id"),
        "reason": payload.get("reason") or "No reason provided",
    }

    subject = _render_template(SWAP_REJECTED_SUBJECT, context)
    body = _render_template(SWAP_REJECTED_BODY, context)

    metadata = {
        "event_type": "SwapRejected",
        "student_id": student_id,
        "section_id": payload.get("section_id"),
        "swap_request_id": payload.get("swap_request_id"),
        "idempotency_key": f"SwapRejected:{payload.get('swap_request_id')}:{student_id}",
    }

    return [_build_email_message(email, subject, body, metadata)], None, 0


def _build_failed_messages(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Optional[str], int]:
    student_id, email, student_name = _resolve_single_recipient(payload)
    if not _is_valid_email(email):
        return [], "missing recipient email", 1

    context = {
        "student_name": student_name or "Student",
        "student_id": student_id,
        "section_id": payload.get("section_id"),
    }

    subject = _render_template(SWAP_FAILED_SUBJECT, context)
    body = _render_template(SWAP_FAILED_BODY, context)

    metadata = {
        "event_type": "SwapFailed",
        "student_id": student_id,
        "section_id": payload.get("section_id"),
        "swap_request_id": payload.get("swap_request_id"),
        "idempotency_key": f"SwapFailed:{payload.get('swap_request_id')}:{student_id}",
    }

    return [_build_email_message(email, subject, body, metadata)], None, 0


def _build_executed_messages(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Optional[str], int]:
    section_id = payload.get("section_id")
    swap_request_id = payload.get("swap_request_id")
    new_team_id_raw = payload.get("new_team_id")

    if section_id is None or swap_request_id is None or new_team_id_raw is None:
        return [], "SwapExecuted event missing section_id, swap_request_id, or new_team_id", 0

    new_team_id = str(new_team_id_raw)

    swap_request_row, swap_request_error = _fetch_swap_request(str(swap_request_id))
    if swap_request_error or not isinstance(swap_request_row, dict):
        return [], "unable to resolve original swap request for executed event", 0

    old_team_raw = swap_request_row.get("current_team")
    if old_team_raw is None:
        return [], "swap request missing current_team", 0

    old_team_id = str(old_team_raw)

    teams_context, team_error = _fetch_section_teams(str(section_id))
    if team_error or not isinstance(teams_context, dict):
        return [], "unable to resolve section teams for executed event", 0

    team_by_id = teams_context.get("team_by_id", {})
    student_to_team = teams_context.get("student_to_team", {})

    old_team_students = team_by_id.get(old_team_id, {}).get("students", [])
    new_team_students = team_by_id.get(new_team_id, {}).get("students", [])

    recipient_ids: List[int] = sorted(set(old_team_students) | set(new_team_students))
    if not recipient_ids:
        seed_student = _int_or_none(payload.get("student_id"))
        if seed_student is not None:
            recipient_ids = [seed_student]

    if not recipient_ids:
        return [], "unable to resolve recipients for executed event", 0

    student_rows, student_error = _fetch_student_rows(recipient_ids)
    if student_error or not isinstance(student_rows, dict):
        return [], "unable to resolve student profiles for executed event", 0

    old_team_name = _team_name(old_team_id, team_by_id)
    new_team_name = _team_name(new_team_id, team_by_id)

    notifications: List[Dict[str, Any]] = []
    skipped_no_email = 0

    for sid in recipient_ids:
        row = student_rows.get(sid, {})
        email = row.get("email") if isinstance(row.get("email"), str) else None
        name = row.get("name") if isinstance(row.get("name"), str) else f"Student {sid}"

        if not _is_valid_email(email):
            skipped_no_email += 1
            continue

        recipient_team_id = student_to_team.get(sid)
        recipient_team_name = _team_name(recipient_team_id, team_by_id)

        context = {
            "student_name": name,
            "student_id": sid,
            "section_id": section_id,
            "recipient_team_id": recipient_team_id,
            "recipient_team_name": recipient_team_name,
            "old_team_id": old_team_id,
            "old_team_name": old_team_name,
            "new_team_id": new_team_id,
            "new_team_name": new_team_name,
        }

        subject = _render_template(SWAP_EXECUTED_SUBJECT, context)
        body = _render_template(SWAP_EXECUTED_BODY, context)

        metadata = {
            "event_type": "SwapExecuted",
            "section_id": section_id,
            "student_id": sid,
            "swap_request_id": swap_request_id,
            "old_team_id": old_team_id,
            "new_team_id": new_team_id,
            "recipient_team_id": recipient_team_id,
            "recipient_team_name": recipient_team_name,
            "idempotency_key": f"SwapExecuted:{swap_request_id}:{sid}",
        }

        notifications.append(_build_email_message(email.strip(), subject, body, metadata))

    if not notifications:
        return [], "no valid recipient emails for executed event", skipped_no_email

    return notifications, None, skipped_no_email


def build_swap_notification_messages(
    payload: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], Optional[str], str, int]:
    event_type = str(payload.get("event_type", "")).strip()
    if not event_type:
        return [], "event_type is required", "", 0

    if event_type == "SwapWindowScheduled":
        messages, error, skipped_no_email = _build_window_event_messages(payload, event_type)
        return messages, error, event_type, skipped_no_email

    if event_type == "SwapWindowOpened":
        messages, error, skipped_no_email = _build_window_event_messages(payload, event_type)
        return messages, error, event_type, skipped_no_email

    if event_type == "SwapRejected":
        messages, error, skipped_no_email = _build_rejected_messages(payload)
        return messages, error, event_type, skipped_no_email

    if event_type == "SwapFailed":
        messages, error, skipped_no_email = _build_failed_messages(payload)
        return messages, error, event_type, skipped_no_email

    if event_type == "SwapExecuted":
        messages, error, skipped_no_email = _build_executed_messages(payload)
        return messages, error, event_type, skipped_no_email

    return [], f"unsupported event_type: {event_type}", event_type, 0

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
import json
import os
import time
import uuid
from datetime import datetime, timezone

import pika
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint, func, text
from sqlalchemy.exc import IntegrityError


load_dotenv()

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

SCHEMA_NAME = "swap_orchestrator"
SCHEMA_INITIALIZED = False

CYCLE_STATUS_SCHEDULED = "SCHEDULED"
CYCLE_STATUS_OPEN = "OPEN"
CYCLE_STATUS_REVIEW = "REVIEW"
CYCLE_STATUS_AWAITING_FINAL_CONFIRMATION = "AWAITING_FINAL_CONFIRMATION"
CYCLE_STATUS_APPLIED = "APPLIED"
CYCLE_STATUS_CLOSED = "CLOSED"

FINAL_CYCLE_STATUSES = {CYCLE_STATUS_APPLIED, CYCLE_STATUS_CLOSED}

REQUEST_STATUS_PENDING = "PENDING"
REQUEST_STATUS_APPROVED = "APPROVED"
REQUEST_STATUS_REJECTED = "REJECTED"
REQUEST_STATUS_EXECUTED = "EXECUTED"
REQUEST_STATUS_FAILED = "FAILED"

VALID_DECISIONS = {REQUEST_STATUS_APPROVED, REQUEST_STATUS_REJECTED}
RESOLVED_REQUEST_STATUSES = {
    REQUEST_STATUS_APPROVED,
    REQUEST_STATUS_REJECTED,
    REQUEST_STATUS_EXECUTED,
    REQUEST_STATUS_FAILED,
}

GPA_VARIANCE_LEVELS = {"strict", "standard", "none"}

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "10"))

SWAP_REQUEST_URL = os.getenv("SWAP_REQUEST_URL", "http://localhost:3011/swap-request").rstrip("/")
SWAP_CONSTRAINTS_URL = os.getenv(
    "SWAP_CONSTRAINTS_URL", "http://localhost:3012/swap-constraints"
).rstrip("/")
COURSE_SERVICE_URL = os.getenv(
    "COURSE_SERVICE_URL", "http://localhost:3017/api/courses"
).rstrip("/")
TEAM_URL = os.getenv("TEAM_URL", "http://localhost:3007/team").rstrip("/")
TEAM_SWAP_OPTIMIZE_URL = os.getenv(
    "TEAM_SWAP_OPTIMIZE_URL", "http://localhost:3013/team-swap/optimize"
).rstrip("/")
ENROLLMENT_URL = os.getenv("ENROLLMENT_URL", "http://localhost:3005/enrollment").rstrip("/")
STUDENT_SERVICE_URL = os.getenv(
    "STUDENT_SERVICE_URL", "http://localhost:3001/api/students"
).rstrip("/")
STUDENT_BULK_URL = os.getenv(
    "STUDENT_BULK_URL", f"{STUDENT_SERVICE_URL}/bulk-info"
).rstrip("/")

RABBIT_HOST = os.getenv("RABBIT_HOST", "rabbitmq")
RABBIT_PORT = int(os.getenv("RABBIT_PORT", "5672"))
SWAP_EVENT_EXCHANGE = os.getenv("SWAP_EVENT_EXCHANGE", "swap_topic")
SWAP_EVENT_EXCHANGE_TYPE = os.getenv("SWAP_EVENT_EXCHANGE_TYPE", "topic")
AMQP_RETRY_COUNT = int(os.getenv("AMQP_RETRY_COUNT", "3"))
AMQP_RETRY_WAIT_SECONDS = float(os.getenv("AMQP_RETRY_WAIT_SECONDS", "1.5"))

ROUTING_KEY_WINDOW_SCHEDULED = os.getenv("ROUTING_KEY_WINDOW_SCHEDULED", "SwapWindowScheduled")
ROUTING_KEY_WINDOW_OPENED = os.getenv("ROUTING_KEY_WINDOW_OPENED", "SwapWindowOpened")
ROUTING_KEY_REQUEST_REJECTED = os.getenv("ROUTING_KEY_REQUEST_REJECTED", "SwapRejected")
ROUTING_KEY_REQUEST_EXECUTED = os.getenv("ROUTING_KEY_REQUEST_EXECUTED", "SwapExecuted")
ROUTING_KEY_REQUEST_FAILED = os.getenv("ROUTING_KEY_REQUEST_FAILED", "SwapFailed")


class SwapCycle(db.Model):
    __tablename__ = "swap_cycle"
    __table_args__ = {"schema": SCHEMA_NAME}

    cycle_id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    section_id = db.Column(db.Uuid, nullable=False, index=True)
    course_id = db.Column(db.Integer, nullable=False, index=True)
    module_id = db.Column(db.Uuid, nullable=False, index=True)
    class_id = db.Column(db.Uuid, nullable=False, index=True)
    constraint_id = db.Column(db.Uuid, nullable=True)
    open_at = db.Column(db.DateTime(timezone=True), nullable=False)
    close_at = db.Column(db.DateTime(timezone=True), nullable=False)
    status = db.Column(db.Text, nullable=False, server_default=CYCLE_STATUS_SCHEDULED)
    created_by = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SwapCycleRequestMap(db.Model):
    __tablename__ = "swap_cycle_request_map"
    __table_args__ = (
        UniqueConstraint("cycle_id", "swap_request_id", name="uq_swap_cycle_request"),
        {"schema": SCHEMA_NAME},
    )

    map_id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    cycle_id = db.Column(db.Uuid, nullable=False, index=True)
    swap_request_id = db.Column(db.Uuid, nullable=False, index=True)
    student_id = db.Column(db.Integer, nullable=False)
    current_team = db.Column(db.Uuid, nullable=False)
    submitted_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)


class SwapExecutionProposal(db.Model):
    __tablename__ = "swap_execution_proposal"
    __table_args__ = (
        UniqueConstraint("cycle_id", name="uq_swap_cycle_proposal"),
        {"schema": SCHEMA_NAME},
    )

    proposal_id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    cycle_id = db.Column(db.Uuid, nullable=False, index=True)
    proposal_payload = db.Column(db.JSON, nullable=False)
    approved_by_instructor = db.Column(db.Boolean, nullable=True)
    approved_at = db.Column(db.DateTime(timezone=True), nullable=True)
    rejected_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


def _utc_now():
    return datetime.now(timezone.utc)


def _as_iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _safe_json(response):
    try:
        return response.json()
    except ValueError:
        return {}


def _extract_data(payload):
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def _extract_error_message(payload, fallback):
    if isinstance(payload, dict):
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message
        error = payload.get("error")
        if isinstance(error, str) and error.strip():
            return error
        if isinstance(error, dict):
            nested_message = error.get("message")
            if isinstance(nested_message, str) and nested_message.strip():
                return nested_message
    return fallback


def _http_json(method, url, label, params=None, payload=None):
    try:
        response = requests.request(
            method=method,
            url=url,
            params=params,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        return None, {
            "status": 502,
            "message": f"failed to call {label}: {str(error)}",
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


def _bool_from_any(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def _int_or_none(value):
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _float_or_none(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _pick_first(record, keys):
    if not isinstance(record, dict):
        return None
    for key in keys:
        if key in record and record.get(key) is not None:
            return record.get(key)
    return None


def _normalize_uuid(raw_value, field_name):
    try:
        return uuid.UUID(str(raw_value))
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a valid UUID")


def _normalize_int(raw_value, field_name):
    parsed = _int_or_none(raw_value)
    if parsed is None:
        raise ValueError(f"{field_name} must be a valid integer")
    return parsed


def _parse_datetime(raw_value, field_name):
    if raw_value is None:
        raise ValueError(f"{field_name} is required")

    text_value = str(raw_value).strip()
    if text_value.endswith("Z"):
        text_value = f"{text_value[:-1]}+00:00"

    try:
        parsed = datetime.fromisoformat(text_value)
    except ValueError:
        raise ValueError(f"{field_name} must be ISO-8601 datetime")

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def _normalize_variance_level(raw_level):
    if raw_level is None:
        return "standard"

    level = str(raw_level).strip().lower()
    if "." in level:
        level = level.split(".")[-1]

    if level not in GPA_VARIANCE_LEVELS:
        return "standard"
    return level


def _serialize_cycle(cycle):
    return {
        "cycle_id": str(cycle.cycle_id),
        "section_id": str(cycle.section_id),
        "course_id": cycle.course_id,
        "module_id": str(cycle.module_id),
        "class_id": str(cycle.class_id),
        "constraint_id": str(cycle.constraint_id) if cycle.constraint_id else None,
        "open_at": _as_iso(cycle.open_at),
        "close_at": _as_iso(cycle.close_at),
        "status": cycle.status,
        "created_by": cycle.created_by,
        "created_at": _as_iso(cycle.created_at),
        "updated_at": _as_iso(cycle.updated_at),
    }


def _serialize_map(mapping):
    return {
        "map_id": str(mapping.map_id),
        "cycle_id": str(mapping.cycle_id),
        "swap_request_id": str(mapping.swap_request_id),
        "student_id": mapping.student_id,
        "current_team": str(mapping.current_team),
        "submitted_at": _as_iso(mapping.submitted_at),
    }


def _publish_event(routing_key, payload):
    last_error = None
    for _ in range(AMQP_RETRY_COUNT):
        connection = None
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=RABBIT_HOST,
                    port=RABBIT_PORT,
                    heartbeat=300,
                    blocked_connection_timeout=300,
                )
            )
            channel = connection.channel()
            channel.exchange_declare(
                exchange=SWAP_EVENT_EXCHANGE,
                exchange_type=SWAP_EVENT_EXCHANGE_TYPE,
                durable=True,
            )
            channel.basic_publish(
                exchange=SWAP_EVENT_EXCHANGE,
                routing_key=routing_key,
                body=json.dumps(payload),
                properties=pika.BasicProperties(delivery_mode=2),
            )
            return True, None
        except Exception as error:
            last_error = str(error)
            time.sleep(AMQP_RETRY_WAIT_SECONDS)
        finally:
            if connection and connection.is_open:
                connection.close()

    return False, last_error


def _extract_student_records(payload):
    body = _extract_data(payload)

    if isinstance(body, list):
        return body

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
                return rows

        if _pick_first(body, ["student_id", "studentId", "StudentID", "id", "Id"]) is not None:
            return [body]

    return []


def _normalize_student_row(record):
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
        "year": _int_or_none(_pick_first(source, ["year", "Year"])),
        "gender": _pick_first(source, ["gender", "Gender"]),
        "gpa": _float_or_none(_pick_first(source, ["gpa", "GPA"])),
    }


def _fetch_student_row_by_id(student_id):
    payload, error = _http_json(
        "GET",
        f"{STUDENT_SERVICE_URL}/{student_id}",
        label=f"student-service({student_id})",
    )
    if error:
        return None

    rows = _extract_student_records(payload)
    if rows:
        normalized = _normalize_student_row(rows[0])
        if normalized:
            return normalized

    data = _extract_data(payload)
    normalized = _normalize_student_row(data)
    if normalized:
        return normalized

    return None


def _fetch_student_rows(student_ids):
    if not student_ids:
        return {}, None

    body = {"StudentIDList": student_ids}
    payload, error = _http_json(
        "POST",
        STUDENT_BULK_URL,
        label="student-service bulk-info",
        payload=body,
    )
    if error:
        return None, error

    rows = _extract_student_records(payload)
    by_student_id = {}
    for row in rows:
        normalized = _normalize_student_row(row)
        if normalized:
            by_student_id[normalized["student_id"]] = normalized

    missing_ids = [sid for sid in student_ids if sid not in by_student_id]
    for student_id in missing_ids:
        fallback_row = _fetch_student_row_by_id(student_id)
        if fallback_row:
            by_student_id[student_id] = fallback_row

    return by_student_id, None


def _fetch_section_student_ids(section_id):
    payload, error = _http_json(
        "GET",
        ENROLLMENT_URL,
        label="enrollment-service",
        params={"section_id": str(section_id)},
    )
    if error:
        return None, error

    rows = _extract_data(payload)
    if not isinstance(rows, list):
        rows = []

    student_ids = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        student_id = _int_or_none(row.get("student_id"))
        if student_id is not None:
            student_ids.append(student_id)

    student_ids = sorted(set(student_ids))
    return student_ids, None


def _fetch_section_students(section_id):
    student_ids, error = _fetch_section_student_ids(section_id)
    if error:
        return None, error

    student_rows, error = _fetch_student_rows(student_ids)
    if error:
        return None, error

    students = []
    for student_id in student_ids:
        row = student_rows.get(student_id, {"student_id": student_id})
        students.append(row)

    return students, None


def _publish_cycle_window_event(cycle, event_type, routing_key):
    students, error = _fetch_section_students(cycle.section_id)

    published = 0
    failed = []

    if error:
        base_payload = {
            "event_type": event_type,
            "cycle_id": str(cycle.cycle_id),
            "section_id": str(cycle.section_id),
            "course_id": cycle.course_id,
            "module_id": str(cycle.module_id),
            "class_id": str(cycle.class_id),
            "open_at": _as_iso(cycle.open_at),
            "close_at": _as_iso(cycle.close_at),
            "created_at": _as_iso(_utc_now()),
            "warning": "student lookup failed",
        }
        ok, publish_error = _publish_event(routing_key, base_payload)
        if ok:
            published += 1
        else:
            failed.append({"student_id": None, "error": publish_error})
        return {
            "published": published,
            "failed": failed,
            "lookup_error": error.get("message"),
        }

    if not students:
        base_payload = {
            "event_type": event_type,
            "cycle_id": str(cycle.cycle_id),
            "section_id": str(cycle.section_id),
            "course_id": cycle.course_id,
            "module_id": str(cycle.module_id),
            "class_id": str(cycle.class_id),
            "open_at": _as_iso(cycle.open_at),
            "close_at": _as_iso(cycle.close_at),
            "created_at": _as_iso(_utc_now()),
            "student_id": None,
            "email": None,
        }
        ok, publish_error = _publish_event(routing_key, base_payload)
        if ok:
            published += 1
        else:
            failed.append({"student_id": None, "error": publish_error})
        return {"published": published, "failed": failed}

    for row in students:
        payload = {
            "event_type": event_type,
            "cycle_id": str(cycle.cycle_id),
            "section_id": str(cycle.section_id),
            "course_id": cycle.course_id,
            "module_id": str(cycle.module_id),
            "class_id": str(cycle.class_id),
            "open_at": _as_iso(cycle.open_at),
            "close_at": _as_iso(cycle.close_at),
            "created_at": _as_iso(_utc_now()),
            "student_id": row.get("student_id"),
            "email": row.get("email"),
            "name": row.get("name"),
        }
        ok, publish_error = _publish_event(routing_key, payload)
        if ok:
            published += 1
        else:
            failed.append({"student_id": row.get("student_id"), "error": publish_error})

    return {"published": published, "failed": failed}


def _publish_request_result_event(cycle, request_result, new_team_by_student, student_rows_by_id):
    status = str(request_result.get("status", "")).upper()
    if status == REQUEST_STATUS_EXECUTED:
        event_type = "SwapExecuted"
        routing_key = ROUTING_KEY_REQUEST_EXECUTED
    else:
        event_type = "SwapFailed"
        routing_key = ROUTING_KEY_REQUEST_FAILED

    student_id = _int_or_none(request_result.get("student_id"))
    student_row = student_rows_by_id.get(student_id, {}) if student_id is not None else {}

    payload = {
        "event_type": event_type,
        "cycle_id": str(cycle.cycle_id),
        "section_id": str(cycle.section_id),
        "course_id": cycle.course_id,
        "module_id": str(cycle.module_id),
        "class_id": str(cycle.class_id),
        "swap_request_id": str(request_result.get("swap_request_id")),
        "student_id": student_id,
        "email": student_row.get("email"),
        "name": student_row.get("name"),
        "status": status,
        "reason": request_result.get("reason"),
        "new_team_id": new_team_by_student.get(student_id),
        "created_at": _as_iso(_utc_now()),
    }

    ok, publish_error = _publish_event(routing_key, payload)
    if ok:
        return None

    return {
        "student_id": student_id,
        "swap_request_id": str(request_result.get("swap_request_id")),
        "status": status,
        "error": publish_error,
    }


def _publish_rejection_event(cycle, swap_request_id, student_id, reason=None):
    student_rows, _ = _fetch_student_rows([student_id])
    student_row = student_rows.get(student_id, {}) if student_rows else {}

    payload = {
        "event_type": "SwapRejected",
        "cycle_id": str(cycle.cycle_id),
        "section_id": str(cycle.section_id),
        "course_id": cycle.course_id,
        "module_id": str(cycle.module_id),
        "class_id": str(cycle.class_id),
        "swap_request_id": str(swap_request_id),
        "student_id": student_id,
        "email": student_row.get("email"),
        "name": student_row.get("name"),
        "reason": reason,
        "created_at": _as_iso(_utc_now()),
    }

    ok, publish_error = _publish_event(ROUTING_KEY_REQUEST_REJECTED, payload)
    if ok:
        return None
    return {"student_id": student_id, "swap_request_id": str(swap_request_id), "error": publish_error}


def _state_transition_for_cycle(cycle):
    previous_status = cycle.status
    if previous_status in FINAL_CYCLE_STATUSES or previous_status == CYCLE_STATUS_AWAITING_FINAL_CONFIRMATION:
        return None

    now = _utc_now()

    if now >= cycle.close_at:
        target_status = CYCLE_STATUS_REVIEW
    elif now >= cycle.open_at:
        target_status = CYCLE_STATUS_OPEN
    else:
        target_status = CYCLE_STATUS_SCHEDULED

    if target_status == previous_status:
        return None

    cycle.status = target_status
    cycle.updated_at = func.now()
    db.session.commit()

    notifications = None
    if previous_status == CYCLE_STATUS_SCHEDULED and target_status == CYCLE_STATUS_OPEN:
        notifications = _publish_cycle_window_event(
            cycle=cycle,
            event_type="SwapWindowOpened",
            routing_key=ROUTING_KEY_WINDOW_OPENED,
        )

    return {
        "from": previous_status,
        "to": target_status,
        "notifications": notifications,
    }


def _fetch_constraint_row_for_scope(course_id, module_id, class_id):
    payload, error = _http_json(
        "GET",
        SWAP_CONSTRAINTS_URL,
        label="swap-constraints service",
        params={
            "course_id": course_id,
            "module_id": str(module_id),
            "class_id": str(class_id),
        },
    )
    if error:
        return None, error

    rows = _extract_data(payload)
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list) or not rows:
        return None, {"status": 404, "message": "swap constraints not found for scope"}

    return rows[0], None


def _normalize_constraint_row(row):
    if not isinstance(row, dict):
        return None

    normalized_level = _normalize_variance_level(row.get("gpa_variance_level"))
    class_avg_gpa = _float_or_none(row.get("class_avg_gpa"))

    return {
        "constraint_id": row.get("constraint_id"),
        "gpa_variance_level": normalized_level,
        "class_avg_gpa": class_avg_gpa,
        "require_year_diversity": _bool_from_any(row.get("require_year_diversity"), False),
        "max_skill_imbalance": _float_or_none(row.get("max_skill_imbalance")),
        "swap_window_days": _int_or_none(row.get("swap_window_days")),
    }


def _constraints_match(existing, desired):
    existing_norm = _normalize_constraint_row(existing)
    desired_norm = _normalize_constraint_row(desired)

    if existing_norm is None or desired_norm is None:
        return False

    for key in (
        "gpa_variance_level",
        "require_year_diversity",
        "max_skill_imbalance",
        "swap_window_days",
    ):
        if existing_norm.get(key) != desired_norm.get(key):
            return False

    return True


def _create_or_get_constraints(course_id, module_id, class_id, constraints):
    desired_payload = {
        "course_id": course_id,
        "module_id": str(module_id),
        "class_id": str(class_id),
        "gpa_variance_level": _normalize_variance_level(constraints.get("gpa_variance_level")),
        "class_avg_gpa": _float_or_none(constraints.get("class_avg_gpa")),
        "require_year_diversity": _bool_from_any(constraints.get("require_year_diversity"), False),
        "max_skill_imbalance": _float_or_none(constraints.get("max_skill_imbalance")),
        "swap_window_days": _int_or_none(constraints.get("swap_window_days")),
    }

    if desired_payload["class_avg_gpa"] is None:
        desired_payload["class_avg_gpa"] = 0.0
    if desired_payload["max_skill_imbalance"] is None:
        desired_payload["max_skill_imbalance"] = 0.0
    if desired_payload["swap_window_days"] is None:
        desired_payload["swap_window_days"] = 2

    payload, error = _http_json(
        "POST",
        SWAP_CONSTRAINTS_URL,
        label="swap-constraints service",
        payload=desired_payload,
    )
    if payload is not None:
        row = _extract_data(payload)
        if isinstance(row, dict):
            normalized = _normalize_constraint_row(row)
            return normalized, None

    if error and error.get("upstream_status") == 409:
        existing_row, existing_error = _fetch_constraint_row_for_scope(course_id, module_id, class_id)
        if existing_error:
            return None, existing_error
        if _constraints_match(existing_row, desired_payload):
            normalized = _normalize_constraint_row(existing_row)
            return normalized, None

        return None, {
            "status": 409,
            "message": (
                "constraints already exist for this scope with different values; "
                "swap-constraints service currently has no update endpoint"
            ),
            "existing": existing_row,
            "requested": desired_payload,
        }

    if error:
        return None, error

    return None, {"status": 502, "message": "unexpected swap-constraints response"}


def _fetch_swap_request(swap_request_id):
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


def _update_swap_request_status(swap_request_id, status):
    payload, error = _http_json(
        "PATCH",
        f"{SWAP_REQUEST_URL}/{swap_request_id}/status",
        label="swap-request status update",
        payload={"status": status},
    )
    if error:
        return None, error
    return payload, None


def _fetch_cycle_request_details(cycle):
    mappings = (
        SwapCycleRequestMap.query.filter_by(cycle_id=cycle.cycle_id)
        .order_by(SwapCycleRequestMap.submitted_at.asc())
        .all()
    )

    details = []
    for mapping in mappings:
        request_row, error = _fetch_swap_request(mapping.swap_request_id)
        if error:
            return None, error

        details.append(
            {
                "map": _serialize_map(mapping),
                "swap_request": request_row,
            }
        )

    return details, None


def _extract_course_rows(payload):
    body = _extract_data(payload)

    if isinstance(body, list):
        return body

    if isinstance(body, dict):
        for key in (
            "Courses",
            "courses",
            "course_list",
            "CourseList",
            "items",
            "Items",
            "records",
            "Records",
            "results",
            "Results",
        ):
            rows = body.get(key)
            if isinstance(rows, list):
                return rows

        if _pick_first(
            body,
            [
                "course_id",
                "courseId",
                "CourseID",
                "id",
                "Id",
                "code",
                "Code",
                "course_code",
                "CourseCode",
            ],
        ) is not None:
            return [body]

    return []


def _course_row_key(row):
    if not isinstance(row, dict):
        return None

    candidate = _pick_first(
        row,
        [
            "course_id",
            "courseId",
            "CourseID",
            "id",
            "Id",
            "code",
            "Code",
            "course_code",
            "CourseCode",
        ],
    )
    if candidate is None:
        return None
    return str(candidate).strip()


def _course_row_name(row):
    if not isinstance(row, dict):
        return None

    candidate = _pick_first(
        row,
        [
            "course_name",
            "courseName",
            "CourseName",
            "name",
            "Name",
            "title",
            "Title",
        ],
    )
    if candidate is None:
        return None

    text = str(candidate).strip()
    return text if text else None


def _resolve_course_name(course_id):
    if course_id is None:
        return "Course"

    course_id_text = str(course_id)
    fallback = f"Course {course_id_text}"

    payload, error = _http_json(
        "GET",
        COURSE_SERVICE_URL,
        label="course-service",
    )
    if error:
        return fallback

    rows = _extract_course_rows(payload)
    if not rows:
        return fallback

    for row in rows:
        if _course_row_key(row) == course_id_text:
            return _course_row_name(row) or fallback

    return fallback


def _team_name_from_lookup(team_id, team_name_by_id):
    team_id_text = str(team_id) if team_id is not None else ""
    if team_id_text in team_name_by_id:
        return team_name_by_id[team_id_text]

    suffix = team_id_text[-8:] if team_id_text else "Unknown"
    return f"Team {suffix}"


def _coerce_created_at(row, mapping):
    if isinstance(row, dict):
        value = row.get("created_at")
        if value is not None:
            return str(value)

    if isinstance(mapping, dict):
        value = mapping.get("submitted_at")
        if value is not None:
            return str(value)

    return _as_iso(_utc_now())


def _to_processed_request(
    cycle,
    request_row,
    mapping,
    course_name,
    student_name_by_id,
    team_name_by_id,
):
    raw_id = None
    if isinstance(request_row, dict):
        raw_id = request_row.get("swap_request_id")
    if raw_id is None and isinstance(mapping, dict):
        raw_id = mapping.get("swap_request_id")
    request_id = str(raw_id) if raw_id is not None else ""

    raw_student_id = None
    if isinstance(request_row, dict):
        raw_student_id = _int_or_none(request_row.get("student_id"))
    if raw_student_id is None and isinstance(mapping, dict):
        raw_student_id = _int_or_none(mapping.get("student_id"))

    student_id_text = str(raw_student_id) if raw_student_id is not None else "unknown"
    student_name = student_name_by_id.get(raw_student_id)
    if not student_name:
        student_name = f"Student {student_id_text}"

    raw_current_team = None
    if isinstance(request_row, dict):
        raw_current_team = request_row.get("current_team")
    if raw_current_team is None and isinstance(mapping, dict):
        raw_current_team = mapping.get("current_team")
    current_team_id = str(raw_current_team) if raw_current_team is not None else "unknown-team"
    current_team_name = _team_name_from_lookup(current_team_id, team_name_by_id)

    reason = ""
    if isinstance(request_row, dict):
        raw_reason = request_row.get("reason")
        if raw_reason is not None:
            reason = str(raw_reason)

    raw_status = REQUEST_STATUS_PENDING
    if isinstance(request_row, dict):
        raw_status = request_row.get("status", REQUEST_STATUS_PENDING)
    status = str(raw_status).lower()

    return {
        "id": request_id,
        "courseId": cycle.course_id,
        "courseName": course_name,
        "studentId": student_id_text,
        "studentName": student_name,
        "currentTeamId": current_team_id,
        "currentTeamName": current_team_name,
        "groupId": str(cycle.section_id),
        "reason": reason,
        "status": status,
        "createdAt": _coerce_created_at(request_row, mapping),
    }


def _fetch_section_teams(section_id):
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

    optimizer_teams = []
    team_post_payload = {"section_id": str(section_id), "teams": []}
    student_ids = []

    for index, team in enumerate(teams, start=1):
        if not isinstance(team, dict):
            continue

        team_id = str(team.get("team_id")) if team.get("team_id") else None
        if not team_id:
            continue

        team_number = _int_or_none(team.get("team_number"))
        if team_number is None:
            team_number = index

        student_rows = team.get("students")
        if not isinstance(student_rows, list):
            student_rows = []

        parsed_student_ids = []
        for student_row in student_rows:
            if not isinstance(student_row, dict):
                continue
            student_id = _int_or_none(student_row.get("student_id"))
            if student_id is None:
                continue
            parsed_student_ids.append(student_id)
            student_ids.append(student_id)

        optimizer_teams.append(
            {
                "team_id": team_id,
                "team_number": team_number,
                "section_id": str(section_id),
                "students": parsed_student_ids,
            }
        )
        team_post_payload["teams"].append(
            {
                "team_id": team_id,
                "students": [{"student_id": sid} for sid in parsed_student_ids],
            }
        )

    return {
        "optimizer_teams": optimizer_teams,
        "team_post_payload": team_post_payload,
        "student_ids": sorted(set(student_ids)),
    }, None


def _build_team_name_lookup(section_id):
    teams_context, error = _fetch_section_teams(section_id)
    if error:
        return {}

    lookup = {}
    for team in teams_context.get("optimizer_teams", []):
        if not isinstance(team, dict):
            continue

        team_id = team.get("team_id")
        if not team_id:
            continue

        team_number = _int_or_none(team.get("team_number"))
        if team_number is not None:
            lookup[str(team_id)] = f"Team {team_number}"
        else:
            lookup[str(team_id)] = _team_name_from_lookup(team_id, {})

    return lookup


def _build_student_name_lookup(request_details):
    student_ids = []
    for row in request_details:
        request_row = row.get("swap_request") if isinstance(row, dict) else None
        mapping = row.get("map") if isinstance(row, dict) else None

        student_id = None
        if isinstance(request_row, dict):
            student_id = _int_or_none(request_row.get("student_id"))
        if student_id is None and isinstance(mapping, dict):
            student_id = _int_or_none(mapping.get("student_id"))

        if student_id is not None:
            student_ids.append(student_id)

    student_rows, error = _fetch_student_rows(sorted(set(student_ids)))
    if error or not isinstance(student_rows, dict):
        return {}

    lookup = {}
    for student_id, row in student_rows.items():
        if not isinstance(row, dict):
            continue
        name = row.get("name")
        if name is None:
            continue
        text = str(name).strip()
        if text:
            lookup[_int_or_none(student_id)] = text
    return lookup


def _normalize_constraints_for_optimizer(constraint_row):
    normalized = _normalize_constraint_row(constraint_row)
    if not normalized:
        return None, {"status": 502, "message": "invalid constraints payload"}

    return {
        "gpa_variance_level": normalized.get("gpa_variance_level"),
        "class_avg_gpa": normalized.get("class_avg_gpa"),
        "require_year_diversity": normalized.get("require_year_diversity"),
        "max_skill_imbalance": normalized.get("max_skill_imbalance"),
        "swap_window_days": normalized.get("swap_window_days"),
    }, None


def _build_optimizer_students(student_rows_by_id, student_ids, optimizer_constraints):
    level = _normalize_variance_level(optimizer_constraints.get("gpa_variance_level"))
    require_gpa = level in {"strict", "standard"}

    missing_year = []
    missing_gender = []
    missing_gpa = []
    missing_student = []

    students = []
    for student_id in student_ids:
        row = student_rows_by_id.get(student_id)
        if not row:
            missing_student.append(student_id)
            continue

        year = _int_or_none(row.get("year"))
        gender = row.get("gender")
        gpa = _float_or_none(row.get("gpa"))

        if year is None:
            missing_year.append(student_id)
        if not isinstance(gender, str) or not gender.strip():
            missing_gender.append(student_id)
        if require_gpa and gpa is None:
            missing_gpa.append(student_id)

        students.append(
            {
                "student_id": student_id,
                "year": year,
                "gender": gender,
                "gpa": gpa,
                "skills": {},
            }
        )

    if missing_student or missing_year or missing_gender or missing_gpa:
        return None, {
            "status": 400,
            "message": "student profile data incomplete for optimization",
            "missing_student": missing_student,
            "missing_year": missing_year,
            "missing_gender": missing_gender,
            "missing_gpa": missing_gpa,
        }

    return students, None


def _upsert_proposal(cycle_id, proposal_payload):
    proposal = SwapExecutionProposal.query.filter_by(cycle_id=cycle_id).first()
    if not proposal:
        proposal = SwapExecutionProposal(cycle_id=cycle_id, proposal_payload=proposal_payload)
        db.session.add(proposal)
    else:
        proposal.proposal_payload = proposal_payload

    proposal.approved_by_instructor = None
    proposal.approved_at = None
    proposal.rejected_at = None
    db.session.commit()
    return proposal


def _generate_proposal_for_cycle(cycle):
    request_details, error = _fetch_cycle_request_details(cycle)
    if error:
        return None, error

    if not request_details:
        return None, {"status": 400, "message": "no swap requests found for cycle"}

    approved_requests = []
    request_status_snapshot = []

    for row in request_details:
        request_row = row["swap_request"]
        request_id = request_row.get("swap_request_id")
        student_id = _int_or_none(request_row.get("student_id"))
        current_team = request_row.get("current_team")
        status = str(request_row.get("status", REQUEST_STATUS_PENDING)).upper()

        if request_id is None or student_id is None or current_team is None:
            return None, {
                "status": 502,
                "message": "swap-request record missing required fields",
                "record": request_row,
            }

        request_status_snapshot.append(
            {
                "swap_request_id": str(request_id),
                "student_id": student_id,
                "current_team": str(current_team),
                "status": status,
            }
        )

        if status == REQUEST_STATUS_APPROVED:
            approved_requests.append(
                {
                    "swap_request_id": str(request_id),
                    "student_id": student_id,
                    "current_team": str(current_team),
                }
            )

    constraint_row, error = _fetch_constraint_row_for_scope(
        cycle.course_id,
        cycle.module_id,
        cycle.class_id,
    )
    if error:
        return None, error

    optimizer_constraints, error = _normalize_constraints_for_optimizer(constraint_row)
    if error:
        return None, error

    teams_context, error = _fetch_section_teams(cycle.section_id)
    if error:
        return None, error

    optimizer_teams = teams_context["optimizer_teams"]
    current_roster_payload = teams_context["team_post_payload"]
    student_ids = teams_context["student_ids"]

    if not optimizer_teams:
        return None, {"status": 400, "message": "no teams found for section"}

    student_rows_by_id, error = _fetch_student_rows(student_ids)
    if error:
        return None, error

    optimizer_students, error = _build_optimizer_students(
        student_rows_by_id=student_rows_by_id,
        student_ids=student_ids,
        optimizer_constraints=optimizer_constraints,
    )
    if error:
        return None, error

    variance_level = _normalize_variance_level(optimizer_constraints.get("gpa_variance_level"))
    class_avg_gpa = _float_or_none(optimizer_constraints.get("class_avg_gpa"))
    if variance_level in {"strict", "standard"} and (class_avg_gpa is None or class_avg_gpa <= 0):
        gpas = [student.get("gpa") for student in optimizer_students if student.get("gpa") is not None]
        if not gpas:
            return None, {
                "status": 400,
                "message": "unable to compute class average GPA from student-service data",
            }
        optimizer_constraints["class_avg_gpa"] = round(sum(gpas) / len(gpas), 4)

    if approved_requests:
        optimize_payload = {
            "section_id": str(cycle.section_id),
            "course_id": cycle.course_id,
            "module_id": str(cycle.module_id),
            "class_id": str(cycle.class_id),
            "teams": optimizer_teams,
            "students": optimizer_students,
            "approved_swap_requests": approved_requests,
            "swap_constraints": optimizer_constraints,
        }

        optimize_response, error = _http_json(
            "POST",
            TEAM_SWAP_OPTIMIZE_URL,
            label="team-swap optimize",
            payload=optimize_payload,
        )
        if error:
            return None, error

        team_swap_data = _extract_data(optimize_response)
        if not isinstance(team_swap_data, dict):
            return None, {
                "status": 502,
                "message": "team-swap optimize response missing data",
            }
    else:
        team_swap_data = {
            "new_team_roster": current_roster_payload,
            "per_request_result": [],
            "selected_pairs": [],
            "solver_objective": 0.0,
            "num_executed": 0,
            "constraints_satisfied": True,
            "constraint_violation_reason": None,
        }

    proposal_payload = {
        "cycle_id": str(cycle.cycle_id),
        "section_id": str(cycle.section_id),
        "course_id": cycle.course_id,
        "module_id": str(cycle.module_id),
        "class_id": str(cycle.class_id),
        "generated_at": _as_iso(_utc_now()),
        "approved_request_ids": [item["swap_request_id"] for item in approved_requests],
        "request_status_snapshot": request_status_snapshot,
        "constraints_used": optimizer_constraints,
        "team_swap_result": team_swap_data,
    }

    _upsert_proposal(cycle.cycle_id, proposal_payload)
    cycle.status = CYCLE_STATUS_AWAITING_FINAL_CONFIRMATION
    cycle.updated_at = func.now()
    db.session.commit()

    return proposal_payload, None


def _all_requests_resolved(cycle):
    request_details, error = _fetch_cycle_request_details(cycle)
    if error:
        return None, error

    if not request_details:
        return False, None

    for row in request_details:
        status = str(row["swap_request"].get("status", REQUEST_STATUS_PENDING)).upper()
        if status not in RESOLVED_REQUEST_STATUSES:
            return False, None

    return True, None


def _ensure_schema_initialized():
    global SCHEMA_INITIALIZED
    if SCHEMA_INITIALIZED:
        return None

    try:
        with db.engine.begin() as connection:
            connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA_NAME}"))
        db.create_all()
        SCHEMA_INITIALIZED = True
        return None
    except Exception as error:
        return {"status": 500, "message": f"failed to initialize orchestrator schema: {str(error)}"}


register_swagger(app, 'swap-orchestrator-service')

@app.before_request
def _bootstrap_schema():
    error = _ensure_schema_initialized()
    if error:
        return jsonify({"code": error["status"], "message": error["message"]}), error["status"]
    return None



@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "swap-orchestrator-service"}), 200



@app.route("/swap-orchestrator/cycles", methods=["POST"])
def create_cycle():
    payload = request.get_json() or {}

    try:
        section_id = _normalize_uuid(payload.get("section_id"), "section_id")
        course_id = _normalize_int(payload.get("course_id"), "course_id")
        module_id = _normalize_uuid(payload.get("module_id"), "module_id")
        class_id = _normalize_uuid(payload.get("class_id"), "class_id")
        open_at = _parse_datetime(payload.get("open_at"), "open_at")
        close_at = _parse_datetime(payload.get("close_at"), "close_at")
    except ValueError as error:
        return jsonify({"code": 400, "message": str(error)}), 400

    if close_at <= open_at:
        return jsonify({"code": 400, "message": "close_at must be later than open_at"}), 400

    constraints = payload.get("constraints") or {}
    if not isinstance(constraints, dict):
        return jsonify({"code": 400, "message": "constraints must be an object"}), 400

    constraint_row, error = _create_or_get_constraints(
        course_id=course_id,
        module_id=module_id,
        class_id=class_id,
        constraints=constraints,
    )
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message"), "data": error}), error.get("status", 502)

    now = _utc_now()
    if now < open_at:
        initial_status = CYCLE_STATUS_SCHEDULED
    elif now >= close_at:
        initial_status = CYCLE_STATUS_REVIEW
    else:
        initial_status = CYCLE_STATUS_OPEN

    cycle = SwapCycle(
        section_id=section_id,
        course_id=course_id,
        module_id=module_id,
        class_id=class_id,
        constraint_id=_normalize_uuid(constraint_row.get("constraint_id"), "constraint_id")
        if constraint_row.get("constraint_id")
        else None,
        open_at=open_at,
        close_at=close_at,
        status=initial_status,
        created_by=payload.get("created_by"),
    )
    db.session.add(cycle)
    db.session.commit()

    schedule_notification = _publish_cycle_window_event(
        cycle=cycle,
        event_type="SwapWindowScheduled",
        routing_key=ROUTING_KEY_WINDOW_SCHEDULED,
    )

    open_notification = None
    if initial_status == CYCLE_STATUS_OPEN:
        open_notification = _publish_cycle_window_event(
            cycle=cycle,
            event_type="SwapWindowOpened",
            routing_key=ROUTING_KEY_WINDOW_OPENED,
        )

    return (
        jsonify(
            {
                "code": 201,
                "data": {
                    "cycle": _serialize_cycle(cycle),
                    "constraints": constraint_row,
                    "notification": {
                        "scheduled": schedule_notification,
                        "opened": open_notification,
                    },
                },
            }
        ),
        201,
    )



@app.route("/swap-orchestrator/cycles", methods=["GET"])
def list_cycles():
    section_id = request.args.get("section_id")
    course_id = request.args.get("course_id")
    query = SwapCycle.query.order_by(SwapCycle.created_at.desc())

    if section_id:
        try:
            section_uuid = _normalize_uuid(section_id, "section_id")
        except ValueError as error:
            return jsonify({"code": 400, "message": str(error)}), 400
        query = query.filter_by(section_id=section_uuid)

    if course_id is not None:
        course_id_text = str(course_id).strip()
        if not course_id_text:
            return jsonify({"code": 400, "message": "course_id cannot be empty"}), 400
        course_id_value = _int_or_none(course_id_text)
        if course_id_value is None:
            return jsonify({"code": 400, "message": "course_id must be a valid integer"}), 400
        query = query.filter_by(course_id=course_id_value)

    cycles = query.all()
    transitions = []
    serialized = []

    for cycle in cycles:
        transition = _state_transition_for_cycle(cycle)
        if transition:
            transitions.append({"cycle_id": str(cycle.cycle_id), "transition": transition})
        serialized.append(_serialize_cycle(cycle))

    return jsonify({"code": 200, "data": {"cycles": serialized, "transitions": transitions}}), 200



@app.route("/swap-orchestrator/cycles/refresh", methods=["POST"])
def refresh_cycles():
    cycles = SwapCycle.query.filter(SwapCycle.status.in_([CYCLE_STATUS_SCHEDULED, CYCLE_STATUS_OPEN])).all()

    transitions = []
    for cycle in cycles:
        transition = _state_transition_for_cycle(cycle)
        if transition:
            transitions.append({"cycle_id": str(cycle.cycle_id), "transition": transition})

    return jsonify({"code": 200, "data": {"updated": len(transitions), "transitions": transitions}}), 200



@app.route("/swap-orchestrator/cycles/<uuid:cycle_id>", methods=["GET"])
def get_cycle(cycle_id):
    cycle = SwapCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"code": 404, "message": "cycle not found"}), 404

    transition = _state_transition_for_cycle(cycle)
    request_details, error = _fetch_cycle_request_details(cycle)
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message")}), error.get("status", 502)

    summary = {
        "total": len(request_details),
        "pending": 0,
        "approved": 0,
        "rejected": 0,
        "executed": 0,
        "failed": 0,
    }

    for row in request_details:
        status = str(row["swap_request"].get("status", REQUEST_STATUS_PENDING)).upper()
        if status == REQUEST_STATUS_PENDING:
            summary["pending"] += 1
        elif status == REQUEST_STATUS_APPROVED:
            summary["approved"] += 1
        elif status == REQUEST_STATUS_REJECTED:
            summary["rejected"] += 1
        elif status == REQUEST_STATUS_EXECUTED:
            summary["executed"] += 1
        elif status == REQUEST_STATUS_FAILED:
            summary["failed"] += 1

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "cycle": _serialize_cycle(cycle),
                    "transition": transition,
                    "request_summary": summary,
                },
            }
        ),
        200,
    )



@app.route("/swap-orchestrator/cycles/<uuid:cycle_id>/requests", methods=["POST"])
def submit_swap_request(cycle_id):
    cycle = SwapCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"code": 404, "message": "cycle not found"}), 404

    _state_transition_for_cycle(cycle)
    if cycle.status != CYCLE_STATUS_OPEN:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "swap request submissions are only allowed while cycle status is OPEN",
                    "data": {"cycle_status": cycle.status},
                }
            ),
            409,
        )

    payload = request.get_json() or {}
    student_id = _int_or_none(payload.get("student_id"))
    reason = payload.get("reason")

    try:
        current_team = _normalize_uuid(payload.get("current_team"), "current_team")
    except ValueError as error:
        return jsonify({"code": 400, "message": str(error)}), 400

    if student_id is None:
        return jsonify({"code": 400, "message": "student_id is required"}), 400
    if not isinstance(reason, str) or not reason.strip():
        return jsonify({"code": 400, "message": "reason is required"}), 400

    teams_context, error = _fetch_section_teams(cycle.section_id)
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message")}), error.get("status", 502)

    team_found = False
    student_found = False
    for team in teams_context["optimizer_teams"]:
        if team["team_id"] == str(current_team):
            team_found = True
            if student_id in team["students"]:
                student_found = True
            break

    if not team_found:
        return jsonify({"code": 400, "message": "current_team not found in section teams"}), 400
    if not student_found:
        return jsonify({"code": 400, "message": "student_id does not belong to current_team"}), 400

    create_payload = {
        "student_id": student_id,
        "current_team": str(current_team),
        "reason": reason.strip(),
    }
    swap_request_response, error = _http_json(
        "POST",
        SWAP_REQUEST_URL,
        label="swap-request create",
        payload=create_payload,
    )
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message"), "data": error}), error.get("status", 502)

    created_row = _extract_data(swap_request_response)
    if not isinstance(created_row, dict):
        return jsonify({"code": 502, "message": "swap-request create returned invalid payload"}), 502

    request_id = created_row.get("swap_request_id")
    if request_id is None:
        return jsonify({"code": 502, "message": "swap-request create missing swap_request_id"}), 502

    mapping = SwapCycleRequestMap(
        cycle_id=cycle.cycle_id,
        swap_request_id=_normalize_uuid(request_id, "swap_request_id"),
        student_id=student_id,
        current_team=current_team,
    )
    db.session.add(mapping)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "swap request is already mapped to this cycle",
                }
            ),
            409,
        )

    return (
        jsonify(
            {
                "code": 201,
                "data": {
                    "cycle": _serialize_cycle(cycle),
                    "mapping": _serialize_map(mapping),
                    "swap_request": created_row,
                },
            }
        ),
        201,
    )



@app.route("/swap-orchestrator/cycles/<uuid:cycle_id>/requests", methods=["GET"])
def list_cycle_requests(cycle_id):
    cycle = SwapCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"code": 404, "message": "cycle not found"}), 404

    transition = _state_transition_for_cycle(cycle)
    request_details, error = _fetch_cycle_request_details(cycle)
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message")}), error.get("status", 502)

    summary = {
        "total": len(request_details),
        "pending": 0,
        "approved": 0,
        "rejected": 0,
        "executed": 0,
        "failed": 0,
    }

    for row in request_details:
        status = str(row["swap_request"].get("status", REQUEST_STATUS_PENDING)).upper()
        if status == REQUEST_STATUS_PENDING:
            summary["pending"] += 1
        elif status == REQUEST_STATUS_APPROVED:
            summary["approved"] += 1
        elif status == REQUEST_STATUS_REJECTED:
            summary["rejected"] += 1
        elif status == REQUEST_STATUS_EXECUTED:
            summary["executed"] += 1
        elif status == REQUEST_STATUS_FAILED:
            summary["failed"] += 1

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "cycle": _serialize_cycle(cycle),
                    "transition": transition,
                    "summary": summary,
                    "requests": request_details,
                },
            }
        ),
        200,
    )


@app.route("/swap-orchestrator/cycles/<uuid:cycle_id>/requests/processed", methods=["GET"])
def list_processed_cycle_requests(cycle_id):
    cycle = SwapCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"code": 404, "message": "cycle not found"}), 404

    transition = _state_transition_for_cycle(cycle)
    request_details, error = _fetch_cycle_request_details(cycle)
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message")}), error.get("status", 502)

    summary = {
        "total": len(request_details),
        "pending": 0,
        "approved": 0,
        "rejected": 0,
        "executed": 0,
        "failed": 0,
    }

    course_name = _resolve_course_name(cycle.course_id)
    student_name_by_id = _build_student_name_lookup(request_details)
    team_name_by_id = _build_team_name_lookup(cycle.section_id)
    status_filter = request.args.get("status")
    normalized_status_filter = str(status_filter).strip().lower() if status_filter else None

    processed_requests = []
    for row in request_details:
        request_row = row.get("swap_request") if isinstance(row, dict) else {}
        status_upper = str(
            request_row.get("status", REQUEST_STATUS_PENDING)
            if isinstance(request_row, dict)
            else REQUEST_STATUS_PENDING
        ).upper()

        if status_upper == REQUEST_STATUS_PENDING:
            summary["pending"] += 1
        elif status_upper == REQUEST_STATUS_APPROVED:
            summary["approved"] += 1
        elif status_upper == REQUEST_STATUS_REJECTED:
            summary["rejected"] += 1
        elif status_upper == REQUEST_STATUS_EXECUTED:
            summary["executed"] += 1
        elif status_upper == REQUEST_STATUS_FAILED:
            summary["failed"] += 1

        mapping = row.get("map") if isinstance(row, dict) else {}
        processed = _to_processed_request(
            cycle=cycle,
            request_row=request_row,
            mapping=mapping,
            course_name=course_name,
            student_name_by_id=student_name_by_id,
            team_name_by_id=team_name_by_id,
        )

        if normalized_status_filter and processed.get("status") != normalized_status_filter:
            continue
        processed_requests.append(processed)

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "cycle": _serialize_cycle(cycle),
                    "transition": transition,
                    "summary": summary,
                    "requests": processed_requests,
                },
            }
        ),
        200,
    )



@app.route(
    "/swap-orchestrator/cycles/<uuid:cycle_id>/requests/<uuid:swap_request_id>/decision",
    methods=["PATCH"],
)
def decide_swap_request(cycle_id, swap_request_id):
    cycle = SwapCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"code": 404, "message": "cycle not found"}), 404

    transition = _state_transition_for_cycle(cycle)

    if cycle.status == CYCLE_STATUS_OPEN:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "request decisions are allowed only after swap window closes",
                    "data": {"cycle_status": cycle.status},
                }
            ),
            409,
        )

    if cycle.status == CYCLE_STATUS_SCHEDULED:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "cycle is not open yet",
                    "data": {"cycle_status": cycle.status},
                }
            ),
            409,
        )

    if cycle.status == CYCLE_STATUS_AWAITING_FINAL_CONFIRMATION:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "proposal already generated; reject proposal first to continue reviewing",
                    "data": {"cycle_status": cycle.status},
                }
            ),
            409,
        )

    if cycle.status in FINAL_CYCLE_STATUSES:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "cycle is already finalized",
                    "data": {"cycle_status": cycle.status},
                }
            ),
            409,
        )

    mapping = SwapCycleRequestMap.query.filter_by(
        cycle_id=cycle.cycle_id,
        swap_request_id=swap_request_id,
    ).first()
    if not mapping:
        return jsonify({"code": 404, "message": "swap request not mapped to this cycle"}), 404

    payload = request.get_json() or {}
    decision = str(payload.get("decision", "")).upper()
    if decision not in VALID_DECISIONS:
        return (
            jsonify(
                {
                    "code": 400,
                    "message": "decision must be APPROVED or REJECTED",
                }
            ),
            400,
        )

    _, error = _update_swap_request_status(swap_request_id=swap_request_id, status=decision)
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message")}), error.get("status", 502)

    rejection_event = None
    if decision == REQUEST_STATUS_REJECTED:
        rejection_event = _publish_rejection_event(
            cycle=cycle,
            swap_request_id=swap_request_id,
            student_id=mapping.student_id,
            reason="rejected by instructor",
        )

    resolved, resolve_error = _all_requests_resolved(cycle)
    if resolve_error:
        return jsonify({"code": resolve_error.get("status", 502), "message": resolve_error.get("message")}), resolve_error.get("status", 502)

    proposal_result = None
    if resolved:
        proposal_payload, proposal_error = _generate_proposal_for_cycle(cycle)
        if proposal_error:
            proposal_result = {
                "status": "failed",
                "message": proposal_error.get("message"),
                "details": proposal_error,
            }
            if cycle.status != CYCLE_STATUS_REVIEW:
                cycle.status = CYCLE_STATUS_REVIEW
                cycle.updated_at = func.now()
                db.session.commit()
        else:
            proposal_result = {
                "status": "ready",
                "cycle_status": cycle.status,
                "proposal": proposal_payload,
            }

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "cycle": _serialize_cycle(cycle),
                    "transition": transition,
                    "swap_request_id": str(swap_request_id),
                    "decision": decision,
                    "rejection_notification_error": rejection_event,
                    "proposal_result": proposal_result,
                },
            }
        ),
        200,
    )



@app.route("/swap-orchestrator/cycles/<uuid:cycle_id>/proposal/generate", methods=["POST"])
def generate_proposal(cycle_id):
    cycle = SwapCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"code": 404, "message": "cycle not found"}), 404

    _state_transition_for_cycle(cycle)

    if cycle.status in FINAL_CYCLE_STATUSES:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "cycle is already finalized",
                    "data": {"cycle_status": cycle.status},
                }
            ),
            409,
        )

    resolved, error = _all_requests_resolved(cycle)
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message")}), error.get("status", 502)

    if not resolved:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "cannot generate proposal while there are unresolved requests",
                }
            ),
            409,
        )

    proposal_payload, error = _generate_proposal_for_cycle(cycle)
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message"), "data": error}), error.get("status", 502)

    return jsonify({"code": 200, "data": {"cycle": _serialize_cycle(cycle), "proposal": proposal_payload}}), 200



@app.route("/swap-orchestrator/cycles/<uuid:cycle_id>/proposal", methods=["GET"])
def get_proposal(cycle_id):
    cycle = SwapCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"code": 404, "message": "cycle not found"}), 404

    proposal = SwapExecutionProposal.query.filter_by(cycle_id=cycle.cycle_id).first()
    if not proposal:
        return jsonify({"code": 404, "message": "proposal not found for cycle"}), 404

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "cycle": _serialize_cycle(cycle),
                    "proposal": proposal.proposal_payload,
                    "approved_by_instructor": proposal.approved_by_instructor,
                    "approved_at": _as_iso(proposal.approved_at),
                    "rejected_at": _as_iso(proposal.rejected_at),
                },
            }
        ),
        200,
    )



@app.route("/swap-orchestrator/cycles/<uuid:cycle_id>/proposal/confirm", methods=["POST"])
def confirm_proposal(cycle_id):
    cycle = SwapCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"code": 404, "message": "cycle not found"}), 404

    if cycle.status != CYCLE_STATUS_AWAITING_FINAL_CONFIRMATION:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "cycle is not awaiting final confirmation",
                    "data": {"cycle_status": cycle.status},
                }
            ),
            409,
        )

    proposal = SwapExecutionProposal.query.filter_by(cycle_id=cycle.cycle_id).first()
    if not proposal:
        return jsonify({"code": 404, "message": "proposal not found for cycle"}), 404

    proposal_payload = proposal.proposal_payload or {}
    team_swap_result = proposal_payload.get("team_swap_result") or {}
    request_results = team_swap_result.get("per_request_result") or []
    if not isinstance(request_results, list):
        request_results = []

    update_errors = []
    for request_result in request_results:
        if not isinstance(request_result, dict):
            continue
        request_id = request_result.get("swap_request_id")
        status = str(request_result.get("status", "")).upper()
        if request_id is None or status not in {REQUEST_STATUS_EXECUTED, REQUEST_STATUS_FAILED}:
            continue
        _, error = _update_swap_request_status(request_id, status)
        if error:
            update_errors.append({"swap_request_id": str(request_id), "error": error})

    if update_errors:
        return (
            jsonify(
                {
                    "code": 502,
                    "message": "failed to apply one or more swap request status updates",
                    "data": {"errors": update_errors},
                }
            ),
            502,
        )

    new_team_roster = team_swap_result.get("new_team_roster")
    roster_update_payload = None
    roster_response_data = None

    if isinstance(new_team_roster, dict) and isinstance(new_team_roster.get("teams"), list):
        has_approved_requests = len(proposal_payload.get("approved_request_ids") or []) > 0
        if has_approved_requests:
            roster_update_payload = {
                "section_id": str(cycle.section_id),
                "teams": new_team_roster.get("teams"),
            }
            team_response, team_error = _http_json(
                "POST",
                TEAM_URL,
                label="team service update",
                payload=roster_update_payload,
            )
            if team_error:
                return jsonify({"code": team_error.get("status", 502), "message": team_error.get("message")}), team_error.get("status", 502)
            roster_response_data = _extract_data(team_response)

    student_ids_to_notify = []
    for request_result in request_results:
        if isinstance(request_result, dict):
            student_id = _int_or_none(request_result.get("student_id"))
            if student_id is not None:
                student_ids_to_notify.append(student_id)

    student_ids_to_notify = sorted(set(student_ids_to_notify))
    student_rows_by_id, student_error = _fetch_student_rows(student_ids_to_notify)
    if student_error:
        student_rows_by_id = {}

    new_team_by_student = {}
    if isinstance(new_team_roster, dict):
        for team in new_team_roster.get("teams", []):
            if not isinstance(team, dict):
                continue
            team_id = team.get("team_id")
            if not team_id:
                continue
            students = team.get("students")
            if not isinstance(students, list):
                continue
            for student in students:
                if not isinstance(student, dict):
                    continue
                student_id = _int_or_none(student.get("student_id"))
                if student_id is None:
                    continue
                new_team_by_student[student_id] = str(team_id)

    notification_failures = []
    for request_result in request_results:
        if not isinstance(request_result, dict):
            continue
        failure = _publish_request_result_event(
            cycle=cycle,
            request_result=request_result,
            new_team_by_student=new_team_by_student,
            student_rows_by_id=student_rows_by_id,
        )
        if failure:
            notification_failures.append(failure)

    proposal.approved_by_instructor = True
    proposal.approved_at = _utc_now()
    proposal.rejected_at = None

    cycle.status = CYCLE_STATUS_APPLIED
    cycle.updated_at = func.now()
    db.session.commit()

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "cycle": _serialize_cycle(cycle),
                    "proposal_confirmed": True,
                    "request_results_applied": len(request_results),
                    "roster_update_payload": roster_update_payload,
                    "roster_update_response": roster_response_data,
                    "notification_failures": notification_failures,
                },
            }
        ),
        200,
    )



@app.route("/swap-orchestrator/cycles/<uuid:cycle_id>/proposal/reject", methods=["POST"])
def reject_proposal(cycle_id):
    cycle = SwapCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"code": 404, "message": "cycle not found"}), 404

    proposal = SwapExecutionProposal.query.filter_by(cycle_id=cycle.cycle_id).first()
    if not proposal:
        return jsonify({"code": 404, "message": "proposal not found for cycle"}), 404

    if cycle.status != CYCLE_STATUS_AWAITING_FINAL_CONFIRMATION:
        return (
            jsonify(
                {
                    "code": 409,
                    "message": "cycle is not awaiting final confirmation",
                    "data": {"cycle_status": cycle.status},
                }
            ),
            409,
        )

    proposal.approved_by_instructor = False
    proposal.rejected_at = _utc_now()
    proposal.approved_at = None

    cycle.status = CYCLE_STATUS_REVIEW
    cycle.updated_at = func.now()
    db.session.commit()

    return jsonify({"code": 200, "data": {"cycle": _serialize_cycle(cycle), "proposal_rejected": True}}), 200



@app.route("/swap-orchestrator/student-team", methods=["GET"])
def get_student_team():
    section_id_raw = request.args.get("section_id")
    student_id = _int_or_none(request.args.get("student_id"))

    if section_id_raw is None:
        return jsonify({"code": 400, "message": "section_id is required"}), 400
    if student_id is None:
        return jsonify({"code": 400, "message": "student_id is required"}), 400

    try:
        section_id = _normalize_uuid(section_id_raw, "section_id")
    except ValueError as error:
        return jsonify({"code": 400, "message": str(error)}), 400

    teams_context, error = _fetch_section_teams(section_id)
    if error:
        return jsonify({"code": error.get("status", 502), "message": error.get("message")}), error.get("status", 502)

    for team in teams_context["optimizer_teams"]:
        if student_id in team.get("students", []):
            return (
                jsonify(
                    {
                        "code": 200,
                        "data": {
                            "section_id": str(section_id),
                            "student_id": student_id,
                            "team": {
                                "team_id": team.get("team_id"),
                                "team_number": team.get("team_number"),
                                "students": [{"student_id": sid} for sid in team.get("students", [])],
                            },
                        },
                    }
                ),
                200,
            )

    return jsonify({"code": 404, "message": "student is not assigned to any team in this section"}), 404


if __name__ == "__main__":
    init_error = _ensure_schema_initialized()
    if init_error:
        print(f"Swap orchestrator startup warning: {init_error['message']}")
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4005")), debug=True)


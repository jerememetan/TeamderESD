from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import inspect
from pathlib import Path
from typing import Any, Dict, List, Optional
import logging
import os
import sys

from flask import Flask, jsonify
from graphql import GraphQLError
import requests
import strawberry
from strawberry.flask.views import GraphQLView

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
    _logger = logging.getLogger("student-form-graphql-gateway")

    def publish_error_event(**kwargs):
        _logger.warning(
            "error_publisher module is unavailable; skipping RabbitMQ publish. payload=%s",
            kwargs,
        )
        return False


SERVICE_NAME = "student-form-graphql-gateway"
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "8"))
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "10"))
ENABLE_GRAPHIQL = os.getenv("ENABLE_GRAPHIQL", "false").lower() == "true"

STUDENT_FORM_URL = os.getenv("STUDENT_FORM_URL", "http://localhost:3015/student-form")
FORMATION_CONFIG_URL = os.getenv("FORMATION_CONFIG_URL", "http://localhost:4000/formation-config")
ENROLLMENT_URL = os.getenv("ENROLLMENT_URL", "http://localhost:3005/enrollment")
SECTION_URL = os.getenv("SECTION_URL", "http://localhost:3018/section")
COURSE_URL = os.getenv(
    "COURSE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Course/rest/Course/course",
)
OUTSYSTEMS_BASE_URL = os.getenv(
    "OUTSYSTEMS_BASE_URL",
    "https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student",
).rstrip("/")
STUDENT_BULK_URL = os.getenv(
    "STUDENT_BULK_URL", f"{OUTSYSTEMS_BASE_URL}/students/bulk-info"
)

MBTI_OPTIONS = [
    "INTJ",
    "INTP",
    "ENTJ",
    "ENTP",
    "INFJ",
    "INFP",
    "ENFJ",
    "ENFP",
    "ISTJ",
    "ISFJ",
    "ESTJ",
    "ESFJ",
    "ISTP",
    "ISFP",
    "ESTP",
    "ESFP",
]

SKILL_SCORE_OPTIONS = [
    ("0", "0 - None"),
    ("1", "1 - Beginner"),
    ("2", "2 - Basic"),
    ("3", "3 - Intermediate"),
    ("4", "4 - Advanced"),
    ("5", "5 - Expert"),
]

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(SERVICE_NAME)


def safe_json(response: requests.Response) -> Dict[str, Any]:
    try:
        payload = response.json()
        return payload if isinstance(payload, dict) else {"data": payload}
    except Exception:
        return {}


def extract_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def to_float(value: Any) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return 0.0
    return parsed


def publish_downstream_error(
    downstream_service: str,
    error_code: str,
    error_message: str,
    *,
    request_context: Optional[Dict[str, Any]] = None,
    http_status: Optional[int] = None,
    response_payload: Optional[Dict[str, Any]] = None,
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


def http_get(url: str, params: Optional[Dict[str, Any]] = None) -> requests.Response:
    return requests.get(url, params=params, timeout=REQUEST_TIMEOUT)


def http_post(url: str, payload: Dict[str, Any]) -> requests.Response:
    return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)


def load_student_name(student_id: int) -> str:
    try:
        response = http_post(STUDENT_BULK_URL, {"StudentIDList": [student_id]})
    except requests.RequestException as exc:
        publish_downstream_error(
            "student",
            "STUDENT_LOOKUP_UNREACHABLE",
            "Unable to reach student profile service",
            request_context={"student_id": student_id, "operation": "load-student"},
        )
        raise GraphQLError("Unable to resolve student context") from exc

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        publish_downstream_error(
            "student",
            "STUDENT_LOOKUP_FAILED",
            "Failed to resolve student context",
            request_context={"student_id": student_id, "operation": "load-student"},
            http_status=response.status_code,
            response_payload=payload,
        )
        raise GraphQLError("Unable to resolve student context")

    records = extract_data(payload)
    if isinstance(records, dict):
        records = records.get("students") or records.get("Students") or []
    if not isinstance(records, list):
        records = []

    for record in records:
        candidate = record.get("student_id", record.get("studentId", record.get("id")))
        try:
            candidate_id = int(candidate)
        except (TypeError, ValueError):
            continue
        if candidate_id == student_id:
            name = str(record.get("name") or "").strip()
            if name:
                return name

    return f"Student {student_id}"


def load_student_form_context(student_id: int, section_id: str) -> Dict[str, Any]:
    try:
        response = http_get(
            STUDENT_FORM_URL,
            params={"student_id": student_id, "section_id": section_id},
        )
    except requests.RequestException as exc:
        publish_downstream_error(
            "student-form",
            "STUDENT_FORM_LOOKUP_UNREACHABLE",
            "Unable to reach student form service",
            request_context={"student_id": student_id, "section_id": section_id, "operation": "load-student-form"},
        )
        raise GraphQLError("Unable to load student form context") from exc

    payload = safe_json(response)
    if response.status_code == 404:
        raise GraphQLError("No student form context found for the selected section")

    if response.status_code < 200 or response.status_code >= 300:
        publish_downstream_error(
            "student-form",
            "STUDENT_FORM_LOOKUP_FAILED",
            "Failed to load student form context",
            request_context={"student_id": student_id, "section_id": section_id, "operation": "load-student-form"},
            http_status=response.status_code,
            response_payload=payload,
        )
        raise GraphQLError("Unable to load student form context")

    records = extract_data(payload)
    if not isinstance(records, list) or not records:
        raise GraphQLError("No student form context found for the selected section")

    first = records[0] if isinstance(records[0], dict) else {}
    return {
        "id": first.get("id"),
        "section_id": str(first.get("section_id", section_id)),
        "submitted": bool(first.get("submitted")),
    }


def load_student_forms(student_id: int) -> List[Dict[str, Any]]:
    try:
        response = http_get(STUDENT_FORM_URL, params={"student_id": student_id})
    except requests.RequestException as exc:
        publish_downstream_error(
            "student-form",
            "STUDENT_FORMS_UNREACHABLE",
            "Unable to reach student form service",
            request_context={"student_id": student_id, "operation": "load-student-forms"},
        )
        raise GraphQLError("Unable to load forms for this student") from exc

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        publish_downstream_error(
            "student-form",
            "STUDENT_FORMS_LOOKUP_FAILED",
            "Failed to load forms for this student",
            request_context={"student_id": student_id, "operation": "load-student-forms"},
            http_status=response.status_code,
            response_payload=payload,
        )
        raise GraphQLError("Unable to load forms for this student")

    rows = extract_data(payload)
    if not isinstance(rows, list):
        return []

    normalized_rows = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        form_id = row.get("id")
        section_id = row.get("section_id")
        if form_id is None or section_id is None:
            continue
        normalized_rows.append(
            {
                "id": str(form_id),
                "section_id": str(section_id),
                "submitted": bool(row.get("submitted")),
            }
        )

    return normalized_rows


def load_sections() -> List[Dict[str, Any]]:
    try:
        response = http_get(SECTION_URL)
    except requests.RequestException as exc:
        publish_downstream_error(
            "section",
            "SECTION_LOOKUP_UNREACHABLE",
            "Unable to reach section service",
            request_context={"operation": "load-sections"},
        )
        raise GraphQLError("Unable to load sections") from exc

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        publish_downstream_error(
            "section",
            "SECTION_LOOKUP_FAILED",
            "Failed to load sections",
            request_context={"operation": "load-sections"},
            http_status=response.status_code,
            response_payload=payload,
        )
        raise GraphQLError("Unable to load sections")

    rows = extract_data(payload)
    return rows if isinstance(rows, list) else []


def load_courses() -> List[Dict[str, Any]]:
    try:
        response = http_get(COURSE_URL)
    except requests.RequestException as exc:
        publish_downstream_error(
            "course",
            "COURSE_LOOKUP_UNREACHABLE",
            "Unable to reach course service",
            request_context={"operation": "load-courses"},
        )
        raise GraphQLError("Unable to load courses") from exc

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        publish_downstream_error(
            "course",
            "COURSE_LOOKUP_FAILED",
            "Failed to load courses",
            request_context={"operation": "load-courses"},
            http_status=response.status_code,
            response_payload=payload,
        )
        raise GraphQLError("Unable to load courses")

    data = extract_data(payload)
    if isinstance(data, dict):
        candidates = data.get("Courses") or data.get("courses")
        return candidates if isinstance(candidates, list) else []
    return data if isinstance(data, list) else []


def load_formation_config(section_id: str) -> Dict[str, Any]:
    try:
        response = http_get(FORMATION_CONFIG_URL, params={"section_id": section_id})
    except requests.RequestException as exc:
        publish_downstream_error(
            "formation-config",
            "FORMATION_CONFIG_UNREACHABLE",
            "Unable to reach formation configuration service",
            request_context={"section_id": section_id, "operation": "load-formation-config"},
        )
        raise GraphQLError("Unable to load formation configuration") from exc

    payload = safe_json(response)
    if response.status_code < 200 or response.status_code >= 300:
        publish_downstream_error(
            "formation-config",
            "FORMATION_CONFIG_LOOKUP_FAILED",
            "Failed to load formation configuration",
            request_context={"section_id": section_id, "operation": "load-formation-config"},
            http_status=response.status_code,
            response_payload=payload,
        )
        raise GraphQLError("Unable to load formation configuration")

    return payload if isinstance(payload, dict) else {}


def load_buddy_options(section_id: str, active_student_id: int) -> List[Dict[str, str]]:
    try:
        enrollment_response = http_get(ENROLLMENT_URL, params={"section_id": section_id})
    except requests.RequestException as exc:
        publish_downstream_error(
            "enrollment",
            "ENROLLMENT_UNREACHABLE",
            "Unable to reach enrollment service",
            request_context={"section_id": section_id, "operation": "load-buddy-options"},
        )
        raise GraphQLError("Unable to load buddy options") from exc

    enrollment_payload = safe_json(enrollment_response)
    if enrollment_response.status_code < 200 or enrollment_response.status_code >= 300:
        publish_downstream_error(
            "enrollment",
            "ENROLLMENT_LOOKUP_FAILED",
            "Failed to load section enrollments",
            request_context={"section_id": section_id, "operation": "load-buddy-options"},
            http_status=enrollment_response.status_code,
            response_payload=enrollment_payload,
        )
        raise GraphQLError("Unable to load buddy options")

    enrollment_rows = extract_data(enrollment_payload)
    if not isinstance(enrollment_rows, list):
        enrollment_rows = []

    roster_ids = sorted(
        {
            int(row.get("student_id"))
            for row in enrollment_rows
            if isinstance(row, dict)
            and row.get("student_id") is not None
            and str(row.get("student_id")).isdigit()
            and int(row.get("student_id")) != active_student_id
        }
    )

    if not roster_ids:
        return []

    try:
        student_response = http_post(STUDENT_BULK_URL, {"StudentIDList": roster_ids})
    except requests.RequestException as exc:
        publish_downstream_error(
            "student",
            "ROSTER_STUDENT_LOOKUP_UNREACHABLE",
            "Unable to reach student service for buddy options",
            request_context={"section_id": section_id, "operation": "load-buddy-options"},
        )
        raise GraphQLError("Unable to load buddy options") from exc

    student_payload = safe_json(student_response)
    if student_response.status_code < 200 or student_response.status_code >= 300:
        publish_downstream_error(
            "student",
            "ROSTER_STUDENT_LOOKUP_FAILED",
            "Failed to resolve student names for buddy options",
            request_context={"section_id": section_id, "operation": "load-buddy-options"},
            http_status=student_response.status_code,
            response_payload=student_payload,
        )
        raise GraphQLError("Unable to load buddy options")

    student_records = extract_data(student_payload)
    if isinstance(student_records, dict):
        student_records = student_records.get("students") or student_records.get("Students") or []
    if not isinstance(student_records, list):
        student_records = []

    by_id: Dict[int, str] = {}
    for record in student_records:
        if not isinstance(record, dict):
            continue
        candidate = record.get("student_id", record.get("studentId", record.get("id")))
        try:
            candidate_id = int(candidate)
        except (TypeError, ValueError):
            continue
        by_id[candidate_id] = str(record.get("name") or "").strip() or f"Student {candidate_id}"

    options = [
        {"value": str(student_id), "label": by_id.get(student_id, f"Student {student_id}")}
        for student_id in roster_ids
    ]
    options.sort(key=lambda item: item["label"])
    return options


@strawberry.type
class SelectOption:
    value: str
    label: str


@strawberry.type
class FormFieldDefinition:
    field_key: str
    label: str
    input_type: str
    required: bool
    options: List[SelectOption]


@strawberry.type
class FieldVisibility:
    mbti_enabled: bool
    buddy_enabled: bool
    buddy_weight: float
    skill_enabled: bool
    topic_enabled: bool


@strawberry.type
class StudentSummary:
    student_id: strawberry.ID
    name: str


@strawberry.type
class StudentFormPagePayload:
    student: StudentSummary
    section_id: strawberry.ID
    submitted: bool
    field_visibility: FieldVisibility
    form_fields: List[FormFieldDefinition]
    skill_catalog: List[SelectOption]
    topic_catalog: List[SelectOption]
    buddy_options: List[SelectOption]


@strawberry.type
class StudentFormAssignment:
    id: strawberry.ID
    section_id: strawberry.ID
    submitted: bool
    title: str
    description: str


@strawberry.type
class Query:
    @strawberry.field
    def student_form_assignments(self, student_id: strawberry.ID) -> List[StudentFormAssignment]:
        try:
            numeric_student_id = int(str(student_id).strip())
        except (TypeError, ValueError) as exc:
            raise GraphQLError("studentId must be a valid integer") from exc

        with ThreadPoolExecutor(max_workers=3) as executor:
            forms_future = executor.submit(load_student_forms, numeric_student_id)
            sections_future = executor.submit(load_sections)
            courses_future = executor.submit(load_courses)

            forms = forms_future.result()
            sections = sections_future.result()
            courses = courses_future.result()

        section_by_id: Dict[str, Dict[str, Any]] = {}
        for section in sections:
            if not isinstance(section, dict):
                continue
            section_id = section.get("id")
            if section_id is None:
                continue
            section_by_id[str(section_id)] = section

        course_by_id: Dict[str, Dict[str, str]] = {}
        for course in courses:
            if not isinstance(course, dict):
                continue
            course_id = course.get("id", course.get("course_id"))
            if course_id is None:
                continue
            course_by_id[str(course_id)] = {
                "code": str(course.get("code", course.get("course_code", ""))).strip(),
                "name": str(course.get("name", course.get("course_name", ""))).strip(),
            }

        assignments: List[StudentFormAssignment] = []
        for index, form in enumerate(forms):
            section_id = str(form.get("section_id", "")).strip()
            section_record = section_by_id.get(section_id, {})
            section_number = section_record.get("section_number")
            course_id = str(section_record.get("course_id", "")).strip()
            course = course_by_id.get(course_id, {})
            course_code = str(course.get("code", "")).strip()
            course_name = str(course.get("name", "")).strip()

            try:
                section_number_int = int(section_number)
                has_section_number = True
            except (TypeError, ValueError):
                section_number_int = index + 1
                has_section_number = False

            if course_code and has_section_number:
                title = f"{course_code} G{section_number_int}"
            elif course_code:
                title = course_code
            elif has_section_number:
                title = f"Section {section_number_int}"
            else:
                title = f"Form {index + 1}"

            assignments.append(
                StudentFormAssignment(
                    id=str(form.get("id")),
                    section_id=section_id,
                    submitted=bool(form.get("submitted")),
                    title=title,
                    description=course_name or "Course form",
                )
            )

        return assignments

    @strawberry.field
    def student_form_page(self, student_id: strawberry.ID, section_id: strawberry.ID) -> StudentFormPagePayload:
        try:
            numeric_student_id = int(str(student_id).strip())
        except (TypeError, ValueError) as exc:
            raise GraphQLError("studentId must be a valid integer") from exc

        section_id_value = str(section_id).strip()
        if not section_id_value:
            raise GraphQLError("sectionId is required")

        with ThreadPoolExecutor(max_workers=2) as executor:
            student_future = executor.submit(load_student_name, numeric_student_id)
            form_future = executor.submit(
                load_student_form_context,
                numeric_student_id,
                section_id_value,
            )
            student_name = student_future.result()
            form_context = form_future.result()

        effective_section_id = str(form_context["section_id"])
        formation_config = load_formation_config(effective_section_id)

        criteria = formation_config.get("criteria") or {}
        buddy_weight = to_float(criteria.get("buddy_weight"))
        visibility = FieldVisibility(
            mbti_enabled=to_float(criteria.get("mbti_weight")) != 0.0,
            buddy_enabled=buddy_weight != 0.0,
            buddy_weight=buddy_weight,
            skill_enabled=to_float(criteria.get("skill_weight")) != 0.0,
            topic_enabled=to_float(criteria.get("topic_weight")) != 0.0,
        )

        skills = formation_config.get("skills") or []
        topics = formation_config.get("topics") or []

        skill_catalog = [
            SelectOption(
                value=str(skill.get("skill_id") or "").strip(),
                label=str(skill.get("skill_label") or "Skill").strip() or "Skill",
            )
            for skill in skills
            if isinstance(skill, dict) and str(skill.get("skill_id") or "").strip()
        ]

        topic_catalog = [
            SelectOption(
                value=str(topic.get("topic_id") or "").strip(),
                label=str(topic.get("topic_label") or "Project topic").strip() or "Project topic",
            )
            for topic in topics
            if isinstance(topic, dict) and str(topic.get("topic_id") or "").strip()
        ]

        buddy_option_rows: List[Dict[str, str]] = []
        if visibility.buddy_enabled:
            buddy_option_rows = load_buddy_options(effective_section_id, numeric_student_id)

        buddy_options = [
            SelectOption(value=row["value"], label=row["label"])
            for row in buddy_option_rows
        ]

        form_fields: List[FormFieldDefinition] = []

        if visibility.buddy_enabled:
            form_fields.append(
                FormFieldDefinition(
                    field_key="buddy",
                    label="Preferred Avoid" if buddy_weight < 0 else "Preferred Buddy",
                    input_type="select",
                    required=False,
                    options=buddy_options,
                )
            )

        if visibility.mbti_enabled:
            form_fields.append(
                FormFieldDefinition(
                    field_key="mbti",
                    label="MBTI",
                    input_type="select",
                    required=False,
                    options=[SelectOption(value=value, label=value) for value in MBTI_OPTIONS],
                )
            )

        if visibility.skill_enabled:
            score_options = [
                SelectOption(value=score, label=label)
                for score, label in SKILL_SCORE_OPTIONS
            ]
            for skill in skill_catalog:
                form_fields.append(
                    FormFieldDefinition(
                        field_key=f"skill:{skill.value}",
                        label=skill.label,
                        input_type="select",
                        required=False,
                        options=score_options,
                    )
                )

        if visibility.topic_enabled:
            rank_options = [
                SelectOption(value=str(rank), label=str(rank))
                for rank in range(1, len(topic_catalog) + 1)
            ]
            for topic in topic_catalog:
                form_fields.append(
                    FormFieldDefinition(
                        field_key=f"topic:{topic.value}",
                        label=topic.label,
                        input_type="select",
                        required=False,
                        options=rank_options,
                    )
                )

        return StudentFormPagePayload(
            student=StudentSummary(student_id=str(numeric_student_id), name=student_name),
            section_id=effective_section_id,
            submitted=bool(form_context["submitted"]),
            field_visibility=visibility,
            form_fields=form_fields,
            skill_catalog=skill_catalog,
            topic_catalog=topic_catalog,
            buddy_options=buddy_options,
        )


schema = strawberry.Schema(query=Query)
app = Flask(__name__)


def _create_graphql_view():
    init_parameters = inspect.signature(GraphQLView.__init__).parameters
    if "graphql_ide" in init_parameters:
        ide_name = "graphiql" if ENABLE_GRAPHIQL else None
        return GraphQLView.as_view(
            "graphql_view",
            schema=schema,
            graphql_ide=ide_name,
        )

    if "graphiql" in init_parameters:
        return GraphQLView.as_view(
            "graphql_view",
            schema=schema,
            graphiql=ENABLE_GRAPHIQL,
        )

    return GraphQLView.as_view("graphql_view", schema=schema)


app.add_url_rule(
    "/graphql",
    view_func=_create_graphql_view(),
)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": SERVICE_NAME}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4007")), debug=False)

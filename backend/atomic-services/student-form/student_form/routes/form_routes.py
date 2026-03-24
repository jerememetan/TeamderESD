from datetime import datetime, timezone
import uuid
from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from ..models.form_model import db, StudentFormLink, StudentFormSubmission, StudentFormTemplate
from ..schemas.form_schema import (
    FormLinkBatchCreateSchema,
    FormLinkResponseSchema,
    FormSubmissionCreateSchema,
    FormSubmissionResponseSchema,
    FormTemplateCreateSchema,
    FormTemplateResponseSchema,
    GeneratedFieldSchema,
)

student_form_bp = Blueprint("student_form", __name__)
template_create_schema = FormTemplateCreateSchema()
submission_create_schema = FormSubmissionCreateSchema()
template_response_schema = FormTemplateResponseSchema()
submission_response_schema = FormSubmissionResponseSchema()
generated_field_schema = GeneratedFieldSchema(many=True)
form_link_batch_create_schema = FormLinkBatchCreateSchema()
form_link_response_schema = FormLinkResponseSchema()


WEIGHT_FIELD_MAP = {
    "mbti_weight": {
        "key": "mbti",
        "label": "MBTI Type",
        "input_type": "select",
        "required": False,
        "options": ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"],
    },
    "buddy_weight": {
        "key": "buddy_id",
        "label": "Preferred Buddy Student ID",
        "input_type": "number",
        "required": False,
        "options": [],
    },
    "topic_weight": {
        "key": "topic_priority",
        "label": "Preferred Project Topic (Ranked)",
        "input_type": "multiselect",
        "required": False,
        "options": [],
    },
    "skill_weight": {
        "key": "skill_self_assessment",
        "label": "Skill Self-Assessment",
        "input_type": "multiselect",
        "required": False,
        "options": [],
    },
}


def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _build_fields(criteria, custom_entries):
    generated = []
    for weight_key, field_def in WEIGHT_FIELD_MAP.items():
        weight = _to_float(criteria.get(weight_key))
        if weight > 0:
            generated.append(
                {
                    "key": field_def["key"],
                    "label": field_def["label"],
                    "input_type": field_def["input_type"],
                    "required": field_def["required"],
                    "weight": weight,
                    "source": "criteria_weight",
                    "options": field_def["options"],
                }
            )

    for idx, entry in enumerate(custom_entries):
        key = entry.get("key") or f"custom_{idx+1}"
        generated.append(
            {
                "key": str(key),
                "label": str(entry.get("label", key)),
                "input_type": entry.get("input_type", "text"),
                "required": bool(entry.get("required", False)),
                "weight": _to_float(entry.get("weight", 0)),
                "source": "group_form_builder",
                "options": entry.get("options", []),
            }
        )

    return generated_field_schema.load(generated)


def _validate_submission(template_fields, responses):
    keys = {field["key"] for field in template_fields}
    unknown_keys = [key for key in responses.keys() if key not in keys]
    if unknown_keys:
        return False, f"Unknown fields submitted: {', '.join(unknown_keys)}"

    for field in template_fields:
        key = field["key"]
        required = field["required"]
        input_type = field["input_type"]
        value = responses.get(key)

        if required and (value is None or value == ""):
            return False, f"Required field missing: {key}"
        if value is None:
            continue

        if input_type == "number" and not isinstance(value, (int, float)):
            return False, f"Field '{key}' must be a number."
        if input_type == "boolean" and not isinstance(value, bool):
            return False, f"Field '{key}' must be a boolean."
        if input_type == "select" and field["options"] and str(value) not in field["options"]:
            return False, f"Field '{key}' has invalid option."
        if input_type == "multiselect":
            if not isinstance(value, list):
                return False, f"Field '{key}' must be a list."
            if field["options"] and any(str(v) not in field["options"] for v in value):
                return False, f"Field '{key}' has invalid option(s)."

    return True, None


@student_form_bp.route("/template", methods=["POST"])
def create_or_update_template():
    payload = request.get_json()
    try:
        data = template_create_schema.load(payload)
        fields = _build_fields(data["criteria"], data["custom_entries"])
    except ValidationError as err:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": err.messages}}), 400

    section_id = data["section_id"]
    template = StudentFormTemplate.query.filter_by(section_id=section_id).first()
    if template is None:
        template = StudentFormTemplate(
            section_id=section_id,
            criteria_snapshot=data["criteria"],
            fields=fields,
        )
        db.session.add(template)
    else:
        template.criteria_snapshot = data["criteria"]
        template.fields = fields

    db.session.commit()
    return jsonify({"data": template_response_schema.dump(template)}), 201


@student_form_bp.route("/template", methods=["GET"])
def get_template():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"error": {"code": "MISSING_PARAMS", "message": "section_id is required"}}), 400

    template = StudentFormTemplate.query.filter_by(section_id=section_id).first()
    if template is None:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Form template not found"}}), 404
    return jsonify({"data": template_response_schema.dump(template)}), 200


@student_form_bp.route("/submission", methods=["POST"])
def create_or_update_submission():
    payload = request.get_json()
    try:
        data = submission_create_schema.load(payload)
    except ValidationError as err:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": err.messages}}), 400

    template = StudentFormTemplate.query.filter_by(section_id=data["section_id"]).first()
    if template is None:
        return jsonify({"error": {"code": "DEPENDENCY_NOT_FOUND", "message": "No template for this section"}}), 404

    is_valid, validation_error = _validate_submission(template.fields, data["responses"])
    if not is_valid:
        return jsonify({"error": {"code": "CONSTRAINT_ERROR", "message": validation_error}}), 400

    submission = StudentFormSubmission.query.filter_by(
        section_id=data["section_id"], student_id=data["student_id"]
    ).first()
    now = datetime.now(timezone.utc)
    if submission is None:
        submission = StudentFormSubmission(
            section_id=data["section_id"],
            student_id=data["student_id"],
            responses=data["responses"],
            generated_version=template.updated_at or now,
        )
        db.session.add(submission)
    else:
        submission.responses = data["responses"]
        submission.generated_version = template.updated_at or now

    db.session.commit()
    return jsonify({"data": submission_response_schema.dump(submission)}), 201


@student_form_bp.route("/submission", methods=["GET"])
def get_submission():
    section_id = request.args.get("section_id")
    student_id = request.args.get("student_id")
    if not section_id or not student_id:
        return jsonify({"error": {"code": "MISSING_PARAMS", "message": "section_id and student_id are required"}}), 400

    submission = StudentFormSubmission.query.filter_by(
        section_id=section_id, student_id=student_id
    ).first()
    if submission is None:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Submission not found"}}), 404
    return jsonify({"data": submission_response_schema.dump(submission)}), 200


@student_form_bp.route("/submissions", methods=["GET"])
def list_submissions():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"error": {"code": "MISSING_PARAMS", "message": "section_id is required"}}), 400
    submissions = StudentFormSubmission.query.filter_by(section_id=section_id).all()
    return jsonify({"data": submission_response_schema.dump(submissions, many=True)}), 200


@student_form_bp.route("/links/batch", methods=["POST"])
def create_or_update_form_links():
    payload = request.get_json()
    try:
        data = form_link_batch_create_schema.load(payload)
    except ValidationError as err:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": err.messages}}), 400

    template = StudentFormTemplate.query.filter_by(section_id=data["section_id"]).first()
    if template is None:
        return jsonify({"error": {"code": "DEPENDENCY_NOT_FOUND", "message": "No template for this section"}}), 404

    base_form_url = (data.get("base_form_url") or "").strip() or "http://localhost:5173/student/fill-form"
    rows = []
    for student_id in data["student_ids"]:
        row = StudentFormLink.query.filter_by(
            section_id=data["section_id"], student_id=student_id
        ).first()
        if row is None:
            token = str(uuid.uuid4())
            url = f"{base_form_url}?section_id={data['section_id']}&student_id={student_id}&token={token}"
            row = StudentFormLink(
                section_id=data["section_id"],
                student_id=student_id,
                link_token=token,
                form_url=url,
            )
            db.session.add(row)
        rows.append(row)

    db.session.commit()
    return jsonify({"data": form_link_response_schema.dump(rows, many=True)}), 201

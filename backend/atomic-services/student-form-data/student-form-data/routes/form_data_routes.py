from flask import Blueprint, request, jsonify
from sqlalchemy import and_
from ..models.form_data_model import FormData, db
from ..schemas.form_data_schema import FormDataCreateSchema, FormDataResponseSchema
from marshmallow import ValidationError, fields

form_data_bp = Blueprint('form_data', __name__)
create_schema = FormDataCreateSchema()
response_schema = FormDataResponseSchema()

@form_data_bp.route("", methods=["POST"])
def create_or_update_form_data():
    payload = request.get_json()
    try:
        data = create_schema.load(payload)
    except ValidationError as err:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": err.messages}}), 400
    section_id = data["section_id"]
    student_id = data["student_id"]
    try:
        # Delete previous row for this (section_id, student_id)
        FormData.query.filter_by(section_id=section_id, student_id=student_id).delete()
        db.session.commit()
        # Insert new row
        obj = FormData(
            section_id=section_id,
            student_id=student_id,
            buddy_id=data.get("buddy_id"),
            mbti=data.get("mbti")
        )
        db.session.add(obj)
        db.session.commit()
        return jsonify({"data": response_schema.dump(obj)}), 201
    except Exception as e:
        db.session.rollback()
        err_msg = str(e)
        if 'mbti' in err_msg or 'constraint' in err_msg or 'invalid input' in err_msg:
            return jsonify({"error": {"code": "CONSTRAINT_ERROR", "message": "Invalid input or constraint violation: " + err_msg}}), 400
        return jsonify({"error": {"code": "SERVER_ERROR", "message": err_msg}}), 500

@form_data_bp.route("", methods=["GET"])
def get_form_data():
    section_id = request.args.get("section_id")
    student_id = request.args.get("student_id")
    if not section_id or not student_id:
        return jsonify({"error": {"code": "MISSING_PARAMS", "message": "section_id and student_id are required"}}), 400
    obj = FormData.query.filter_by(section_id=section_id, student_id=student_id).first()
    if obj:
        return jsonify({"data": response_schema.dump(obj)}), 200
    else:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Form data not found"}}), 404


class FormDataCreateEnvelope(FormDataCreateSchema):
    data = fields.Nested(FormDataResponseSchema())


class FormDataResponseEnvelope(FormDataResponseSchema):
    data = fields.Nested(FormDataResponseSchema())


create_or_update_form_data._openapi_request_schema = FormDataCreateSchema()
create_or_update_form_data._openapi_response_schema = FormDataCreateEnvelope()
get_form_data._openapi_response_schema = FormDataResponseEnvelope()

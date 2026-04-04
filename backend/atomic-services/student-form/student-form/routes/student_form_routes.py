from flask import Blueprint, request, jsonify
from ..models.student_form_model import StudentForm, db
from ..schemas.student_form_schema import (
    StudentFormCreateSchema,
    StudentFormResponseSchema,
    StudentFormUpdateSchema,
)
from marshmallow import ValidationError, fields

student_form_bp = Blueprint('student_form', __name__)
create_schema = StudentFormCreateSchema()
update_schema = StudentFormUpdateSchema()
response_schema = StudentFormResponseSchema()


def _extract_student_form_filters():
    section_id = request.args.get("section_id")
    student_id = request.args.get("student_id")
    if not section_id and not student_id:
        return None, (
            jsonify(
                {
                    "error": {
                        "code": "MISSING_PARAMS",
                        "message": "At least one of section_id or student_id is required",
                    }
                }
            ),
            400,
        )

    filters = {}
    if section_id:
        filters["section_id"] = section_id
    if student_id:
        filters["student_id"] = student_id
    return filters, None


@student_form_bp.route("", methods=["POST"])
def create_or_update_student_form():
    payload = request.get_json()
    try:
        data = create_schema.load(payload)
    except ValidationError as err:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": err.messages}}), 400
    section_id = data["section_id"]
    students = data["students"]
    try:
        results = []
        created = 0
        for student_id in students:
            obj = StudentForm.query.filter_by(student_id=student_id, section_id=section_id).first()
            if obj:
                obj.student_id = obj.student_id
                results.append(obj)
            else:
                new_obj = StudentForm(student_id=student_id, section_id=section_id)
                db.session.add(new_obj)
                results.append(new_obj)
                created += 1
        db.session.commit()
        status = 201 if created > 0 else 200
        return jsonify({"data": response_schema.dump(results, many=True)}), status
    except Exception as e:
        db.session.rollback()
        err_msg = str(e)
        return jsonify({"error": {"code": "SERVER_ERROR", "message": err_msg}}), 500


@student_form_bp.route("", methods=["GET"])
def get_student_form():
    filters, error_response = _extract_student_form_filters()
    if error_response:
        return error_response

    objs = StudentForm.query.filter_by(**filters).all()
    if "section_id" in filters and "student_id" in filters and not objs:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Student form not found"}}), 404
    return jsonify({"data": response_schema.dump(objs, many=True)}), 200


@student_form_bp.route("/<int:form_id>", methods=["GET"])
def get_student_form_by_id(form_id):
    obj = StudentForm.query.filter_by(id=form_id).first()
    if not obj:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Student form not found"}}), 404
    return jsonify({"data": response_schema.dump(obj)}), 200


@student_form_bp.route("/submitted", methods=["GET"])
def get_submitted_forms():
    filters, error_response = _extract_student_form_filters()
    if error_response:
        return error_response

    objs = StudentForm.query.filter_by(submitted=True, **filters).all()
    if "section_id" in filters and "student_id" in filters and not objs:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Student form not found"}}), 404
    return jsonify({"data": response_schema.dump(objs, many=True)}), 200


@student_form_bp.route("/unsubmitted", methods=["GET"])
def get_unsubmitted_forms():
    filters, error_response = _extract_student_form_filters()
    if error_response:
        return error_response

    objs = StudentForm.query.filter_by(submitted=False, **filters).all()
    if "section_id" in filters and "student_id" in filters and not objs:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Student form not found"}}), 404
    return jsonify({"data": response_schema.dump(objs, many=True)}), 200



@student_form_bp.route("", methods=["PUT"])
def update_student_form_submitted():
    payload = request.get_json()
    try:
        data = update_schema.load(payload)
    except ValidationError as err:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": err.messages}}), 400

    student_id = data["student_id"]
    section_id = data["section_id"]
    try:
        obj = StudentForm.query.filter_by(student_id=student_id, section_id=section_id).first()
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Student form not found"}}), 404
        obj.submitted = True
        db.session.commit()
        return jsonify({"data": response_schema.dump(obj)}), 200
    except Exception as e:
        db.session.rollback()
        err_msg = str(e)
        return jsonify({"error": {"code": "SERVER_ERROR", "message": err_msg}}), 500


@student_form_bp.route("", methods=["DELETE"])
def delete_student_form():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"error": {"code": "MISSING_PARAMS", "message": "section_id is required"}}), 400
    try:
        objs = StudentForm.query.filter_by(section_id=section_id).all()
        if not objs:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "No forms found for section"}}), 404
        deleted_data = response_schema.dump(objs, many=True)
        for obj in objs:
            db.session.delete(obj)
        db.session.commit()
        return jsonify({"data": deleted_data}), 200
    except Exception as e:
        db.session.rollback()
        err_msg = str(e)
        return jsonify({"error": {"code": "SERVER_ERROR", "message": err_msg}}), 500


class StudentFormCreateEnvelope(StudentFormCreateSchema):
    data = fields.List(fields.Nested(StudentFormResponseSchema()))


class StudentFormListEnvelope(StudentFormResponseSchema):
    data = fields.List(fields.Nested(StudentFormResponseSchema()))


_OPENAPI_STUDENT_FORM_QUERY_PARAMETERS = [
    {
        "name": "section_id",
        "in": "query",
        "required": False,
        "schema": {"type": "string", "format": "uuid"},
        "description": "Filter by section UUID. Provide section_id, student_id, or both.",
    },
    {
        "name": "student_id",
        "in": "query",
        "required": False,
        "schema": {"type": "integer"},
        "description": "Filter by student ID. Provide section_id, student_id, or both.",
    },
]


create_or_update_student_form._openapi_request_schema = StudentFormCreateSchema()
create_or_update_student_form._openapi_response_schema = StudentFormCreateEnvelope()
get_student_form._openapi_response_schema = StudentFormListEnvelope()
get_student_form._openapi_query_parameters = _OPENAPI_STUDENT_FORM_QUERY_PARAMETERS
get_student_form._openapi_description = "Get student forms filtered by section_id, student_id, or both. At least one filter must be provided."
get_student_form_by_id._openapi_response_schema = StudentFormResponseSchema()
get_submitted_forms._openapi_response_schema = StudentFormListEnvelope()
get_submitted_forms._openapi_query_parameters = _OPENAPI_STUDENT_FORM_QUERY_PARAMETERS
get_submitted_forms._openapi_description = "Get submitted student forms filtered by section_id, student_id, or both. At least one filter must be provided."
get_unsubmitted_forms._openapi_response_schema = StudentFormListEnvelope()
get_unsubmitted_forms._openapi_query_parameters = _OPENAPI_STUDENT_FORM_QUERY_PARAMETERS
get_unsubmitted_forms._openapi_description = "Get unsubmitted student forms filtered by section_id, student_id, or both. At least one filter must be provided."
update_student_form_submitted._openapi_request_schema = StudentFormUpdateSchema()
update_student_form_submitted._openapi_response_schema = StudentFormResponseSchema()
delete_student_form._openapi_response_schema = StudentFormListEnvelope()

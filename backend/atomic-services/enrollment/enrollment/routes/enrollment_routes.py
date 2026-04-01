from flask import Blueprint, request, jsonify
from ..models.enrollment_model import Enrollment
from ..models.enrollment_model import db
from ..schemas.enrollment_schema import EnrollmentResponseSchema

enrollment_bp = Blueprint("enrollment", __name__)
response_schema = EnrollmentResponseSchema()
many_response_schema = EnrollmentResponseSchema(many=True)

@enrollment_bp.route("", methods=["GET"])
def get_enrollments():
    section_id = request.args.get("section_id")
    query = Enrollment.query
    if section_id:
        query = query.filter_by(section_id=section_id)
    enrollments = query.all()
    return jsonify({
        "code": 200,
        "data": many_response_schema.dump(enrollments)
    }), 200


from marshmallow import Schema, fields


# Attach OpenAPI schema annotation for swagger_helper to pick up
class EnrollmentListEnvelopeSchema(Schema):
    code = fields.Integer()
    data = fields.List(fields.Nested(EnrollmentResponseSchema()))


get_enrollments._openapi_response_schema = EnrollmentListEnvelopeSchema()

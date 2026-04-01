from ..schemas.reputation_schema import (
    ReputationCreateSchema,
    ReputationResponseSchema,
    ReputationUpdateSchema,
)
from flask import Blueprint, request, jsonify
from ..models.reputation_model import Reputation, db
from marshmallow import ValidationError
from marshmallow import Schema, fields

reputation_bp = Blueprint("reputation", __name__)
response_schema = ReputationResponseSchema()
many_response_schema = ReputationResponseSchema(many=True)
create_schema = ReputationCreateSchema()

@reputation_bp.route("", methods=["GET"])
def get_reputations():
    reputations = Reputation.query.all()
    return jsonify({
        "data": many_response_schema.dump(reputations),
        "meta": {}
    }), 200


# OpenAPI envelope for GET /reputation
class ReputationListEnvelope(Schema):
    data = fields.List(fields.Nested(ReputationResponseSchema()))
    meta = fields.Dict()


get_reputations._openapi_response_schema = ReputationListEnvelope()


@reputation_bp.route("", methods=["POST"])
def create_reputation():
    payload = request.get_json() or {}
    try:
        data = create_schema.load(payload)
    except ValidationError as err:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": err.messages}}), 400

    student_id = data["student_id"]
    existing = Reputation.query.get(student_id)
    if existing:
        return jsonify({"error": {"code": "CONFLICT", "message": "Reputation already exists"}}), 409

    reputation = Reputation(student_id=student_id, reputation_score=50)
    db.session.add(reputation)
    db.session.commit()

    return jsonify({
        "data": response_schema.dump(reputation),
        "meta": {}
    }), 201


create_reputation._openapi_request_schema = ReputationCreateSchema()
create_reputation._openapi_response_schema = ReputationListEnvelope()

@reputation_bp.route("/<int:student_id>", methods=["GET"])
def get_reputation_by_student_id(student_id):
    reputation = Reputation.query.get(student_id)
    if not reputation:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Reputation not found"}}), 404
    return jsonify({
        "data": response_schema.dump(reputation),
        "meta": {}
    }), 200


get_reputation_by_student_id._openapi_response_schema = ReputationListEnvelope()


# PUT route to update reputation score
@reputation_bp.route("/<int:student_id>", methods=["PUT"])
def update_reputation_score(student_id):
    data = request.get_json()
    if not data or "delta" not in data:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "Missing 'delta' in request body"}}), 400
    delta = data["delta"]
    if not isinstance(delta, int):
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "'delta' must be an integer"}}), 400
    reputation = Reputation.query.get(student_id)
    if not reputation:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Reputation not found"}}), 404
    reputation.reputation_score += delta
    db.session.commit()
    return jsonify({
        "data": response_schema.dump(reputation),
        "meta": {}
    }), 200


update_reputation_score._openapi_request_schema = ReputationUpdateSchema()
update_reputation_score._openapi_response_schema = ReputationListEnvelope()

from ..schemas.reputation_schema import ReputationResponseSchema
from flask import Blueprint, request, jsonify
from ..models.reputation_model import Reputation, db

reputation_bp = Blueprint("reputation", __name__)
response_schema = ReputationResponseSchema()
many_response_schema = ReputationResponseSchema(many=True)

@reputation_bp.route("", methods=["GET"])
def get_reputations():
    reputations = Reputation.query.all()
    return jsonify({
        "data": many_response_schema.dump(reputations),
        "meta": {}
    }), 200

@reputation_bp.route("/<int:student_id>", methods=["GET"])
def get_reputation_by_student_id(student_id):
    reputation = Reputation.query.get(student_id)
    if not reputation:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Reputation not found"}}), 404
    return jsonify({
        "data": response_schema.dump(reputation),
        "meta": {}
    }), 200


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

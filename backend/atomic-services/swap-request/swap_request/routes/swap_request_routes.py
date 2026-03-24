from flask import Blueprint, jsonify, request

from ..consumer import update_status_directly
from ..models.swap_request_model import SwapRequest, db
from ..schemas.swap_request_schema import (
    SwapRequestCreateSchema,
    SwapRequestResponseSchema,
    SwapRequestStatusUpdateSchema,
)

swap_request_bp = Blueprint("swap_request", __name__)

create_schema = SwapRequestCreateSchema()
response_schema = SwapRequestResponseSchema()
many_response_schema = SwapRequestResponseSchema(many=True)
status_update_schema = SwapRequestStatusUpdateSchema()


@swap_request_bp.route("", methods=["POST"])
def create_swap_request():
    # HTTP endpoint: student submits swap request from UI/API.
    payload = request.get_json() or {}
    data = create_schema.load(payload)

    row = SwapRequest(
        student_id=data["student_id"],
        current_team=data["current_team"],
        reason=data["reason"],
        status="PENDING",
    )

    db.session.add(row)
    db.session.commit()

    return (
        jsonify(
            {
                "code": 201,
                "message": "HTTP success: swap request created and stored.",
                "data": response_schema.dump(row),
            }
        ),
        201,
    )


@swap_request_bp.route("", methods=["GET"])
def get_swap_requests():
    # HTTP endpoint: UI display reads swap requests; this is not RabbitMQ.
    query = SwapRequest.query

    status = request.args.get("status")
    student_id = request.args.get("student_id")
    current_team = request.args.get("current_team")

    if status:
        query = query.filter_by(status=status)
    if student_id:
        query = query.filter_by(student_id=student_id)
    if current_team:
        query = query.filter_by(current_team=current_team)

    rows = query.order_by(SwapRequest.created_at.desc()).all()

    return (
        jsonify(
            {
                "code": 200,
                "message": "HTTP success: swap requests retrieved for display.",
                "data": many_response_schema.dump(rows),
            }
        ),
        200,
    )


@swap_request_bp.route("/<uuid:swap_request_id>", methods=["GET"])
def get_swap_request_by_id(swap_request_id):
    # HTTP endpoint: UI/API retrieves one swap request record.
    row = SwapRequest.query.get(swap_request_id)
    if not row:
        return jsonify({"code": 404, "message": "Swap request not found"}), 404

    return (
        jsonify(
            {
                "code": 200,
                "message": "HTTP success: swap request retrieved.",
                "data": response_schema.dump(row),
            }
        ),
        200,
    )


@swap_request_bp.route("/<uuid:swap_request_id>/status", methods=["PATCH"])
def update_swap_request_status(swap_request_id):
    payload = request.get_json() or {}
    data = status_update_schema.load(payload)
    result = update_status_directly(swap_request_id=swap_request_id, status=data["status"])
    return jsonify(result), result.get("http_status", 200)

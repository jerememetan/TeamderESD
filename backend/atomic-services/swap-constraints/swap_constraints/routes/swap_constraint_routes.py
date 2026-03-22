from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from ..app import db
from ..models.swap_constraint_model import SwapConstraint
from ..schemas.swap_constraint_schema import SwapConstraintCreateSchema, SwapConstraintResponseSchema


swap_constraint_bp = Blueprint("swap_constraint", __name__)
create_schema = SwapConstraintCreateSchema()
response_schema = SwapConstraintResponseSchema()
many_response_schema = SwapConstraintResponseSchema(many=True)


@swap_constraint_bp.route("", methods=["GET"])
def get_swap_constraints():
    course_id = request.args.get("course_id")
    module_id = request.args.get("module_id")
    class_id = request.args.get("class_id")

    query = SwapConstraint.query
    if course_id:
        query = query.filter_by(course_id=course_id)
    if module_id:
        query = query.filter_by(module_id=module_id)
    if class_id:
        query = query.filter_by(class_id=class_id)

    rows = query.all()
    return jsonify({"code": 200, "data": many_response_schema.dump(rows)}), 200


@swap_constraint_bp.route("/<uuid:constraint_id>", methods=["GET"])
def get_swap_constraint_by_id(constraint_id):
    row = SwapConstraint.query.get(constraint_id)
    if not row:
        return jsonify({"code": 404, "error": "Swap constraint not found"}), 404
    return jsonify({"code": 200, "data": response_schema.dump(row)}), 200


@swap_constraint_bp.route("", methods=["POST"])
def create_swap_constraint():
    payload = request.get_json() or {}
    data = create_schema.load(payload)

    row = SwapConstraint(
        course_id=data["course_id"],
        module_id=data["module_id"],
        class_id=data["class_id"],
        min_team_avg_gpa=data["min_team_avg_gpa"],
        require_year_diversity=data["require_year_diversity"],
        max_skill_imbalance=data["max_skill_imbalance"],
        swap_window_days=data["swap_window_days"],
    )

    try:
        db.session.add(row)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return (
            jsonify(
                {
                    "code": 409,
                    "error": "Swap constraints already exist for this class/course/module",
                }
            ),
            409,
        )

    return jsonify({"code": 201, "data": response_schema.dump(row)}), 201

from ..schemas.criteria_schema import CriteriaCreateSchema, CriteriaResponseSchema
from flask import Blueprint, request, jsonify
from ..app import db
from ..models.criteria_model import Criteria

criteria_bp = Blueprint("criteria", __name__)
create_schema = CriteriaCreateSchema()
response_schema = CriteriaResponseSchema()
many_response_schema = CriteriaResponseSchema(many=True)

@criteria_bp.route("", methods=["GET"])
def get_criteria():
    course_id = request.args.get("course_id")
    section_id = request.args.get("section_id")
    query = Criteria.query
    if section_id:
        query = query.filter_by(section_id=section_id)
    if course_id:
        try:
            course_id = int(course_id)
        except ValueError:
            return jsonify({"code": 400, "error": "course_id must be an integer."}), 400
        query = query.filter_by(course_id=course_id)
    criteria = query.all()
    return jsonify({
     "code": 200,
     "data": many_response_schema.dump(criteria)   
    }), 200
    
@criteria_bp.route("", methods=["POST"])
def create_criteria():
    payload = request.get_json()
    data = create_schema.load(payload)
    
    criteria = Criteria(
        section_id=data["section_id"],
        course_id=data["course_id"],
        num_groups=data["num_groups"],
        school_weight=data["school_weight"],
        year_weight=data["year_weight"],
        gender_weight=data["gender_weight"],
        gpa_weight=data["gpa_weight"],
        reputation_weight=data["reputation_weight"],
        mbti_weight=data["mbti_weight"],
        buddy_weight=data["buddy_weight"],
        topic_weight=data["topic_weight"],
        skill_weight=data["skill_weight"],
        randomness=data["randomness"],
    )
    db.session.add(criteria)
    db.session.commit()
    
    return jsonify({
        "code": 201,
        "data": response_schema.dump(criteria)
    }), 201

@criteria_bp.route("", methods=["PUT"])
def update_criteria():
    try:
        section_id = request.args.get("section_id")
        if not section_id:
            return jsonify({"code": 400, "error": "Missing section_id in query parameters."}), 400

        criteria = Criteria.query.filter_by(section_id=section_id).first()
        if not criteria:
            return jsonify({"code": 404, "error": "Criteria not found for the given section_id."}), 404

        payload = request.get_json()
        if not payload:
            return jsonify({"code": 400, "error": "Missing JSON body."}), 400

        data = create_schema.load(payload, partial=True)
        for field in [
            "section_id", "num_groups", "school_weight", "year_weight", "gender_weight", "gpa_weight",
            "reputation_weight", "mbti_weight", "buddy_weight", "topic_weight", "skill_weight", "randomness"
        ]:
            if field in data:
                setattr(criteria, field, data[field])

        db.session.commit()
        return jsonify({"code": 200, "data": response_schema.dump(criteria)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"code": 500, "error": str(e)}), 500
    
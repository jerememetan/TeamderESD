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
    if course_id and section_id:
        criteria = Criteria.query.filter_by(course_id=course_id, section_id=section_id).all()
    elif course_id:
        criteria = Criteria.query.filter_by(course_id=course_id).all()
    elif section_id:
        criteria = Criteria.query.filter_by(section_id=section_id).all()
    else:
        criteria = Criteria.query.all()
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
    
from ..schemas.skill_schema import SkillCreateSchema, SkillResponseSchema
from flask import Blueprint, request, jsonify
from uuid import uuid4
from ..app import db
from ..models.skill_model import Skill

skills_bp = Blueprint("skills", __name__)
create_schema = SkillCreateSchema()
response_schema = SkillResponseSchema()
many_response_schema = SkillResponseSchema(many=True)

@skills_bp.route("", methods=["GET"])
def get_skills():
    course_id = request.args.get("course_id")
    if course_id:
        skills = Skill.query.filter_by(course_id=course_id).all()
    else:
        skills = Skill.query.all()
    return jsonify({
     "code": 200,
     "data": many_response_schema.dump(skills)   
    }), 200
    
@skills_bp.route("", methods=["POST"])
def create_skill():
    payload = request.get_json()
    data = create_schema.load(payload)
    
    skill = Skill(
        skill_id=uuid4(),
        course_id=data["course_id"],
        skill_label=data["skill_label"],
        skill_importance=data["skill_importance"],
    )
    db.session.add(skill)
    db.session.commit()
    
    return jsonify({
        "code": 201,
        "data": response_schema.dump(skill)
    }), 201
    
@skills_bp.route("/<uuid:skill_id>", methods=["GET"])
def get_skill_by_id(skill_id):
    skill = Skill.query.get(skill_id)
    if not skill:
        return jsonify({"code": 404, "message": "Skill not found"}), 404
    return jsonify({"code": 200, "data": response_schema.dump(skill)}, 200)
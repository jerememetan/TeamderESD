from ..schemas.skill_schema import SkillCreateSchema, SkillResponseSchema
from flask import Blueprint, request, jsonify
from uuid import uuid4
from ..app import db
from ..models.skill_model import Skill
from marshmallow import Schema, fields


# OpenAPI envelope schemas for swagger generator
class SkillListEnvelopeSchema(Schema):
    code = fields.Integer()
    data = fields.List(fields.Nested(SkillResponseSchema()))


class SkillEnvelopeSchema(Schema):
    code = fields.Integer()
    data = fields.Nested(SkillResponseSchema())


class DeleteResponseSchema(Schema):
    code = fields.Integer()
    deleted = fields.Integer()

skill_bp = Blueprint("skill", __name__)
create_schema = SkillCreateSchema()
response_schema = SkillResponseSchema()
many_response_schema = SkillResponseSchema(many=True)

@skill_bp.route("", methods=["GET"])
def get_skills():
    section_id = request.args.get("section_id")
    query = Skill.query
    if section_id:
        query = query.filter_by(section_id=section_id)
    skills = query.all()
    return jsonify({
     "code": 200,
     "data": many_response_schema.dump(skills)   
    }), 200
get_skills._openapi_response_schema = SkillListEnvelopeSchema()
    
@skill_bp.route("", methods=["POST"])
def create_skill():
    payload = request.get_json()
    data = create_schema.load(payload)
    
    skill = Skill(
        section_id=data["section_id"],
        skill_label=data["skill_label"],
        skill_importance=data["skill_importance"],
    )
    db.session.add(skill)
    db.session.commit()
    
    return jsonify({
        "code": 201,
        "data": response_schema.dump(skill)
    }), 201
create_skill._openapi_request_schema = SkillCreateSchema()
create_skill._openapi_response_schema = SkillEnvelopeSchema()
    
@skill_bp.route("/<uuid:skill_id>", methods=["GET"])
def get_skill_by_id(skill_id):
    skill = Skill.query.get(skill_id)
    if not skill:
        return jsonify({"code": 404, "message": "Skill not found"}), 404
    return jsonify({"code": 200, "data": response_schema.dump(skill)}), 200
get_skill_by_id._openapi_response_schema = SkillEnvelopeSchema()
    
@skill_bp.route("", methods=["DELETE"])
def delete_skills_by_section():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"code": 400, "error": "Missing section_id in query parameters."}), 400
    deleted = Skill.query.filter_by(section_id=section_id).delete()
    db.session.commit()
    return jsonify({"code": 200, "deleted": deleted}), 200
delete_skills_by_section._openapi_response_schema = DeleteResponseSchema()
from flask import Blueprint, request, jsonify
from sqlalchemy import and_
from ..models.competence_model import Competence
from ..app import db
from ..schemas.competence_schema import CompetenceBatchSchema, CompetenceCreateSchema, CompetenceResponseSchema

from marshmallow import ValidationError, fields
create_schema = CompetenceCreateSchema()
response_schema = CompetenceResponseSchema()
many_response_schema = CompetenceResponseSchema(many=True)

competence_bp = Blueprint('competence', __name__)


@competence_bp.route("", methods=["POST"])
def create_competences():
    payload = request.get_json()
    schema = CompetenceBatchSchema()
    try:
        batch = schema.load(payload)
    except ValidationError as err:
        return jsonify({"code": 400, "error": err.messages}), 400
    section_id = batch["section_id"]
    student_id = batch["student_id"]
    competences = batch["competences"]
    try:
        Competence.query.filter_by(section_id=section_id, student_id=student_id).delete()
        db.session.commit()
        results = []
        for comp in competences:
            obj = Competence(
                skill_id=comp["skill_id"],
                section_id=section_id,
                student_id=student_id,
                skill_level=comp.get("skill_level")
            )
            db.session.merge(obj)
            results.append(obj)
        db.session.commit()
        return jsonify({"code": 201, "data": many_response_schema.dump(results)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"code": 500, "error": str(e)}), 500


@competence_bp.route("", methods=["GET"])
def get_competences():
    section_id = request.args.get("section_id")
    student_id = request.args.get("student_id")
    skill_id = request.args.get("skill_id")
    query = Competence.query
    if section_id:
        query = query.filter_by(section_id=section_id)
    if student_id:
        query = query.filter_by(student_id=student_id)
    if skill_id:
        query = query.filter_by(skill_id=skill_id)
    results = query.all()
    return jsonify({"code": 200, "data": many_response_schema.dump(results)}), 200


class CompetenceBatchEnvelopeSchema(CompetenceBatchSchema):
    code = fields.Integer()
    data = fields.List(fields.Nested(CompetenceResponseSchema()))


class CompetenceListEnvelopeSchema(CompetenceResponseSchema):
    code = fields.Integer()
    data = fields.List(fields.Nested(CompetenceResponseSchema()))


create_competences._openapi_request_schema = CompetenceBatchSchema()
create_competences._openapi_response_schema = CompetenceBatchEnvelopeSchema()
get_competences._openapi_response_schema = CompetenceListEnvelopeSchema()

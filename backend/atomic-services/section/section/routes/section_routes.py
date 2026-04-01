import uuid

from flask import Blueprint, jsonify, request

from ..models.section_model import Section, db
from ..schemas.section_schema import SectionResponseSchema
from sqlalchemy.exc import IntegrityError
section_bp = Blueprint("section", __name__)
response_schema = SectionResponseSchema()
many_response_schema = SectionResponseSchema(many=True)
from marshmallow import Schema, fields


@section_bp.route("", methods=["GET"])
def get_sections():
    course_id = request.args.get("course_id", type=int)
    is_active = request.args.get("is_active")

    query = Section.query.order_by(Section.section_number.asc())

    if course_id is not None:
        query = query.filter_by(course_id=course_id)

    if is_active is not None:
        query = query.filter_by(is_active=is_active.lower() == "true")

    sections = query.all()
    return jsonify({"code": 200, "data": many_response_schema.dump(sections)}), 200


# OpenAPI envelope schema for list responses
class SectionListEnvelopeSchema(Schema):
    code = fields.Integer()
    data = fields.List(fields.Nested(SectionResponseSchema()))


get_sections._openapi_response_schema = SectionListEnvelopeSchema()


@section_bp.route("/<section_id>", methods=["GET"])
def get_section(section_id):
    section = Section.query.filter_by(id=section_id).first()
    if not section:
        return jsonify({"code": 404, "error": {"message": "Section not found"}}), 404

    return jsonify({"code": 200, "data": response_schema.dump(section)}), 200


get_section._openapi_response_schema = SectionResponseSchema()

# input: requires body to have 
@section_bp.route("", methods=["POST"])
def create_section():
    payload = request.get_json(silent=True) or {}

    try:
        existing_section = Section.query.filter_by(
            section_number=int(payload["section_number"]),
            course_id=int(payload["course_id"])
        ).first()
        if existing_section:
            return jsonify({
                "code": 400,
                "error": {"message": "Section with this section_number and course_id already exists"}
            }), 400
        else:
            section = Section(
                id=uuid.UUID(str(payload.get("id"))) if payload.get("id") else uuid.uuid4(),
                section_number=int(payload["section_number"]),
                course_id=int(payload["course_id"]),
                is_active=bool(payload.get("is_active", True)),
                stage=(str(payload.get("stage", "setup")))
            )
            db.session.add(section)
            db.session.commit()
            return jsonify({"code": 201, "data": response_schema.dump(section)}), 201
    except IntegrityError as error:
        db.session.rollback()
        return jsonify({
            "code": 400,
            "error": {"message": "Section with this section_number and course_id already exists (DB constraint)"}
        }), 400
    except KeyError as error:
        db.session.rollback()
        return jsonify({"code": 400, "error": {"message": f"Missing field: {error.args[0]}"}}), 400
    except Exception as error:
        db.session.rollback()
        return jsonify({"code": 400, "error": {"message": str(error)}}), 400


# Request schema for creating/updating a section
class SectionCreateSchema(Schema):
    id = fields.UUID(required=False)
    section_number = fields.Integer(required=True)
    course_id = fields.Integer(required=True)
    is_active = fields.Boolean(required=False)
    stage = fields.String(required=False)


class SectionUpdateSchema(Schema):
    section_number = fields.Integer(required=False)
    course_id = fields.Integer(required=False)
    is_active = fields.Boolean(required=False)
    stage = fields.String(required=False)


create_section._openapi_request_schema = SectionCreateSchema()
create_section._openapi_response_schema = SectionResponseSchema()


@section_bp.route("/<section_id>", methods=["PUT"])
def update_section(section_id):
    section = Section.query.filter_by(id=section_id).first()
    if not section:
        return jsonify({"code": 404, "error": {"message": "Section not found"}}), 404

    payload = request.get_json(silent=True) or {}

    try:
        if "section_number" in payload:
            section.section_number = int(payload["section_number"])
        if "course_id" in payload:
            section.course_id = int(payload["course_id"])
        if "is_active" in payload:
            section.is_active = bool(payload["is_active"])
        if "stage" in payload:
            section.stage = str(payload["stage"])

        db.session.commit()
        return jsonify({"code": 200, "data": response_schema.dump(section)}), 200
    except IntegrityError as error:
        db.session.rollback()
        return jsonify({
            "code": 400,
            "error": {"message": "Section with this section_number and course_id already exists (DB constraint)"}
        }), 400
    except Exception as error:
        db.session.rollback()
        return jsonify({"code": 400, "error": {"message": str(error)}}), 400


update_section._openapi_request_schema = SectionUpdateSchema()
update_section._openapi_response_schema = SectionResponseSchema()


@section_bp.route("/<section_id>", methods=["DELETE"])
def delete_section(section_id):
    section = Section.query.filter_by(id=section_id).first()
    if not section:
        return jsonify({"code": 404, "error": {"message": "Section not found"}}), 404

    db.session.delete(section)
    db.session.commit()
    return jsonify({"code": 200, "data": {"deleted": True, "id": section_id}}), 200


class DeleteSectionResponseSchema(Schema):
    code = fields.Integer()
    data = fields.Dict()


delete_section._openapi_response_schema = DeleteSectionResponseSchema()

from ..schemas.criteria_schema import CriteriaCreateSchema, CriteriaResponseSchema
from flask import Blueprint, request, jsonify
from ..app import db
from ..models.criteria_model import Criteria
from marshmallow import fields
from uuid import UUID

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
        try:
            UUID(str(section_id))
        except (ValueError, TypeError):
            return jsonify({"code": 400, "error": "section_id must be a valid UUID."}), 400
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

class CriteriaListEnvelopeSchema(CriteriaResponseSchema):
    code = fields.Integer()
    data = fields.List(fields.Nested(CriteriaResponseSchema()))

get_criteria._openapi_response_schema = CriteriaListEnvelopeSchema()


# OpenAPI annotations for GET /criteria
get_criteria.__openapi__ = {
    "summary": "List criteria",
    "description": "Returns a list of criteria filtered by optional query parameters.",
    "parameters": [
        {
            "name": "section_id",
            "in": "query",
            "required": False,
            "schema": {"type": "string", "format": "uuid"},
            "description": "UUID of the section to filter by"
        },
        {
            "name": "course_id",
            "in": "query",
            "required": False,
            "schema": {"type": "integer"},
            "description": "Integer course id to filter by"
        }
    ],
    "responses": {
        "200": {
            "description": "List of criteria",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "code": {"type": "integer"},
                            "data": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "section_id": {"type": "string", "format": "uuid"},
                                        "course_id": {"type": "integer"},
                                        "num_groups": {"type": "integer"},
                                        "school_weight": {"type": "number"},
                                        "year_weight": {"type": "number"},
                                        "gender_weight": {"type": "number"},
                                        "gpa_weight": {"type": "number"},
                                        "reputation_weight": {"type": "number"},
                                        "mbti_weight": {"type": "number"},
                                        "buddy_weight": {"type": "number"},
                                        "topic_weight": {"type": "number"},
                                        "skill_weight": {"type": "number"},
                                        "randomness": {"type": "number"}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
    
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

class CriteriaCreateEnvelopeSchema(CriteriaCreateSchema):
    code = fields.Integer()
    data = fields.Nested(CriteriaResponseSchema())

create_criteria._openapi_request_schema = CriteriaCreateSchema()
create_criteria._openapi_response_schema = CriteriaCreateEnvelopeSchema()


# OpenAPI annotations for POST /criteria
create_criteria.__openapi__ = {
    "summary": "Create criteria",
    "description": "Create a new criteria row. Body must follow CriteriaCreateSchema.",
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "required": ["course_id", "section_id", "num_groups"],
                    "properties": {
                        "course_id": {"type": "integer"},
                        "section_id": {"type": "string", "format": "uuid"},
                        "num_groups": {"type": "integer"},
                        "school_weight": {"type": "number"},
                        "year_weight": {"type": "number"},
                        "gender_weight": {"type": "number"},
                        "gpa_weight": {"type": "number"},
                        "reputation_weight": {"type": "number"},
                        "mbti_weight": {"type": "number"},
                        "buddy_weight": {"type": "number"},
                        "topic_weight": {"type": "number"},
                        "skill_weight": {"type": "number"},
                        "randomness": {"type": "number"}
                    }
                }
            }
        }
    },
    "responses": {
        "201": {
            "description": "Created criteria",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "code": {"type": "integer"},
                            "data": {
                                "type": "object",
                                "properties": {
                                    "section_id": {"type": "string", "format": "uuid"},
                                    "course_id": {"type": "integer"},
                                    "num_groups": {"type": "integer"}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

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
    
# OpenAPI annotations for PUT /criteria
update_criteria.__openapi__ = {
    "summary": "Update criteria",
    "description": "Update criteria for a section. `section_id` must be provided as query parameter.",
    "parameters": [
        {
            "name": "section_id",
            "in": "query",
            "required": True,
            "schema": {"type": "string", "format": "uuid"},
            "description": "Section UUID of the criteria to update"
        }
    ],
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "num_groups": {"type": "integer"},
                        "school_weight": {"type": "number"},
                        "year_weight": {"type": "number"},
                        "gender_weight": {"type": "number"},
                        "gpa_weight": {"type": "number"},
                        "reputation_weight": {"type": "number"},
                        "mbti_weight": {"type": "number"},
                        "buddy_weight": {"type": "number"},
                        "topic_weight": {"type": "number"},
                        "skill_weight": {"type": "number"},
                        "randomness": {"type": "number"}
                    }
                }
            }
        }
    },
    "responses": {
        "200": {
            "description": "Updated criteria",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "code": {"type": "integer"},
                            "data": {"type": "object"}
                        }
                    }
                }
            }
        }
    }
}
update_criteria._openapi_request_schema = CriteriaCreateSchema()
update_criteria._openapi_response_schema = CriteriaResponseSchema()

from collections import defaultdict
from uuid import UUID

from flask import Blueprint, request, jsonify
from ..models.enrollment_model import Enrollment
from ..models.enrollment_model import db
from ..schemas.enrollment_schema import EnrollmentResponseSchema
from ..schemas.enrollment_schema import EnrollmentBulkResponseSchema

enrollment_bp = Blueprint("enrollment", __name__)
response_schema = EnrollmentResponseSchema()
many_response_schema = EnrollmentResponseSchema(many=True)
bulk_response_schema = EnrollmentBulkResponseSchema()

@enrollment_bp.route("", methods=["GET"])
def get_enrollments():
    section_id = request.args.get("section_id")
    section_ids_args = request.args.getlist("section_ids")

    expanded_section_ids = []
    for raw_value in section_ids_args:
        if not raw_value:
            continue
        if "," in raw_value:
            expanded_section_ids.extend(
                [part.strip() for part in raw_value.split(",") if part.strip()]
            )
        else:
            expanded_section_ids.append(raw_value.strip())

    requested_section_ids = []
    if section_id:
        requested_section_ids.append(section_id)
    requested_section_ids.extend(expanded_section_ids)

    deduped_section_ids = []
    seen = set()
    for sid in requested_section_ids:
        if sid not in seen:
            seen.add(sid)
            deduped_section_ids.append(sid)

    parsed_section_ids = []
    for sid in deduped_section_ids:
        try:
            parsed_section_ids.append(UUID(str(sid)))
        except (ValueError, TypeError):
            return jsonify({"code": 400, "message": f"Invalid section_id: {sid}"}), 400

    query = Enrollment.query
    if parsed_section_ids:
        query = query.filter(Enrollment.section_id.in_(parsed_section_ids))
    enrollments = query.all()

    if section_id and not section_ids_args:
        return jsonify({
            "code": 200,
            "data": many_response_schema.dump(enrollments)
        }), 200

    if section_ids_args:
        enrollments_by_section = defaultdict(list)
        for enrollment in enrollments:
            enrollments_by_section[str(enrollment.section_id)].append(
                response_schema.dump(enrollment)
            )

        sections_payload = [
            {
                "section_id": sid,
                "enrollments": enrollments_by_section.get(str(sid), []),
            }
            for sid in deduped_section_ids
        ]

        return jsonify({
            "code": 200,
            "data": {
                "sections": sections_payload,
            }
        }), 200

    return jsonify({
        "code": 200,
        "data": many_response_schema.dump(enrollments)
    }), 200


from marshmallow import Schema, fields


# Attach OpenAPI schema annotation for swagger_helper to pick up
class EnrollmentListEnvelopeSchema(Schema):
    code = fields.Integer()
    data = fields.Raw()


get_enrollments._openapi_response_schema = EnrollmentListEnvelopeSchema()
get_enrollments._openapi_parameters = [
    {
        "name": "section_id",
        "in": "query",
        "required": False,
        "schema": {"type": "string", "format": "uuid"},
        "description": "Return enrollments for a single section.",
    },
    {
        "name": "section_ids",
        "in": "query",
        "required": False,
        "schema": {"type": "string"},
        "description": "Return grouped enrollments for multiple sections. Accepts comma-separated UUIDs or repeated section_ids params.",
    },
]
get_enrollments._openapi_responses = {
    "200": {
        "description": "Successful response for unfiltered, single-section, or bulk-section enrollment queries.",
        "content": {
            "application/json": {
                "schema": {
                    "oneOf": [
                        {
                            "type": "object",
                            "properties": {
                                "code": {"type": "integer", "example": 200},
                                "data": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "section_id": {"type": "string", "format": "uuid"},
                                            "student_id": {"type": "integer"},
                                        },
                                    },
                                },
                            },
                        },
                        {
                            "type": "object",
                            "properties": {
                                "code": {"type": "integer", "example": 200},
                                "data": {
                                    "type": "object",
                                    "properties": {
                                        "sections": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "section_id": {
                                                        "type": "string",
                                                        "format": "uuid",
                                                    },
                                                    "enrollments": {
                                                        "type": "array",
                                                        "items": {
                                                            "type": "object",
                                                            "properties": {
                                                                "section_id": {
                                                                    "type": "string",
                                                                    "format": "uuid",
                                                                },
                                                                "student_id": {"type": "integer"},
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        }
                                    },
                                },
                            },
                        },
                    ]
                },
                "examples": {
                    "singleSection": {
                        "summary": "Single section response",
                        "value": {
                            "code": 200,
                            "data": [
                                {
                                    "section_id": "11111111-1111-1111-1111-111111111111",
                                    "student_id": 101,
                                },
                                {
                                    "section_id": "11111111-1111-1111-1111-111111111111",
                                    "student_id": 102,
                                },
                            ],
                        },
                    },
                    "bulkSections": {
                        "summary": "Bulk sections response",
                        "value": {
                            "code": 200,
                            "data": {
                                "sections": [
                                    {
                                        "section_id": "11111111-1111-1111-1111-111111111111",
                                        "enrollments": [
                                            {
                                                "section_id": "11111111-1111-1111-1111-111111111111",
                                                "student_id": 101,
                                            }
                                        ],
                                    },
                                    {
                                        "section_id": "22222222-2222-2222-2222-222222222222",
                                        "enrollments": [],
                                    },
                                ]
                            },
                        },
                    },
                },
            }
        },
    },
    "400": {
        "description": "Invalid section_id or section_ids format.",
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "code": {"type": "integer", "example": 400},
                        "message": {"type": "string"},
                    },
                },
            }
        },
    },
    "500": {"description": "Internal server error"},
}

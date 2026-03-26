from marshmallow import Schema, fields


class SectionResponseSchema(Schema):
    id = fields.UUID()
    section_number = fields.Integer()
    course_id = fields.Integer()
    is_active = fields.Boolean()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()

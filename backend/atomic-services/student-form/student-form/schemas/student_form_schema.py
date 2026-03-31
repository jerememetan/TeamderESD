from marshmallow import Schema, fields


class StudentFormCreateSchema(Schema):
    section_id = fields.UUID(required=True)
    students = fields.List(fields.Integer(), required=True)


class StudentFormUpdateSchema(Schema):
    student_id = fields.Integer(required=True)
    section_id = fields.UUID(required=True)


class StudentFormResponseSchema(Schema):
    id = fields.Integer()
    student_id = fields.Integer()
    section_id = fields.UUID()
    submitted = fields.Boolean()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()

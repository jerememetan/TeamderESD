from marshmallow import Schema, fields



class FormDataCreateSchema(Schema):
    section_id = fields.UUID(required=True)
    student_id = fields.Integer(required=True)
    buddy_id = fields.Integer(allow_none=True)
    mbti = fields.String(allow_none=True)


class FormDataResponseSchema(Schema):
    section_id = fields.UUID()
    student_id = fields.Integer()
    buddy_id = fields.Integer(allow_none=True)
    mbti = fields.String(allow_none=True)

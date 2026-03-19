from marshmallow import Schema, fields

class EnrollmentResponseSchema(Schema):
    section_id = fields.UUID()
    student_id = fields.Integer()


from marshmallow import Schema, fields

class EnrollmentResponseSchema(Schema):
    section_id = fields.UUID()
    student_id = fields.Integer()


class EnrollmentBySectionSchema(Schema):
    section_id = fields.UUID()
    enrollments = fields.List(fields.Nested(EnrollmentResponseSchema()))


class EnrollmentBulkResponseSchema(Schema):
    sections = fields.List(fields.Nested(EnrollmentBySectionSchema()))


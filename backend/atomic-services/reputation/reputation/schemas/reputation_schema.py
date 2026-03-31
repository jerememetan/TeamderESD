from marshmallow import Schema, fields

class ReputationResponseSchema(Schema):
    student_id = fields.Int()
    reputation_score = fields.Int()


class ReputationCreateSchema(Schema):
    student_id = fields.Int(required=True)


# Schema for PUT request body
class ReputationUpdateSchema(Schema):
    delta = fields.Int(required=True)

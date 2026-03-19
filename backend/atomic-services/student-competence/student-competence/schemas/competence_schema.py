from marshmallow import Schema, fields



class CompetenceCreateSchema(Schema):
    skill_id = fields.UUID(required=True)
    skill_level = fields.Integer(allow_none=True)

class CompetenceBatchSchema(Schema):
    section_id = fields.UUID(required=True)
    student_id = fields.Integer(required=True)
    competences = fields.List(fields.Nested(lambda: CompetenceCreateSchema()), required=True)

class CompetenceResponseSchema(Schema):
    skill_id = fields.UUID()
    section_id = fields.UUID()
    student_id = fields.Integer()
    skill_level = fields.Integer()

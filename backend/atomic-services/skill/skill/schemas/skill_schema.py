from marshmallow import Schema, fields

class SkillCreateSchema(Schema):
    section_id = fields.UUID(required=True)
    skill_label = fields.Str(required=True)
    skill_importance = fields.Float(required=False, load_default=1.0)

class SkillResponseSchema(Schema):
    skill_id = fields.UUID()
    section_id = fields.UUID()
    skill_label = fields.Str()
    skill_importance = fields.Float()
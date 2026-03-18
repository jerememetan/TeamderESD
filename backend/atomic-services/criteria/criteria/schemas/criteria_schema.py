from marshmallow import Schema, fields

class CriteriaCreateSchema(Schema):
    course_id = fields.UUID(required=True)
    num_groups = fields.Integer(required=True)
    school_weight = fields.Float(required=False, load_default=0.0)
    year_weight = fields.Float(required=False, load_default=0.0)
    gender_weight = fields.Float(required=False, load_default=0.0)
    gpa_weight = fields.Float(required=False, load_default=0.0)
    reputation_weight = fields.Float(required=False, load_default=0.0)
    mbti_weight = fields.Float(required=False, load_default=0.0)
    buddy_weight = fields.Float(required=False, load_default=0.0)
    topic_weight = fields.Float(required=False, load_default=0.0)
    skill_weight = fields.Float(required=False, load_default=0.0)
    randomness = fields.Float(required=False, load_default=0.0)

class CriteriaResponseSchema(Schema):
    course_id = fields.UUID()
    num_groups = fields.Integer()
    school_weight = fields.Float()
    year_weight = fields.Float()
    gender_weight = fields.Float()
    gpa_weight = fields.Float()
    reputation_weight = fields.Float()
    mbti_weight = fields.Float()
    buddy_weight = fields.Float()
    topic_weight = fields.Float()
    skill_weight = fields.Float()
    randomness = fields.Float()

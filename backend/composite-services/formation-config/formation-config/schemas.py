from marshmallow import Schema, fields


class CriteriaSchema(Schema):
    num_groups = fields.Integer(required=True)
    school_weight = fields.Float(required=True)
    year_weight = fields.Float(required=True)
    gender_weight = fields.Float(required=True)
    gpa_weight = fields.Float(required=True)
    reputation_weight = fields.Float(required=True)
    mbti_weight = fields.Float(required=True)
    buddy_weight = fields.Float(required=True)
    topic_weight = fields.Float(required=True)
    skill_weight = fields.Float(required=True)
    randomness = fields.Float(required=True)


class TopicSchema(Schema):
    topic_label = fields.Str(required=True)
    section_id = fields.UUID(required=False)


class SkillSchema(Schema):
    skill_label = fields.Str(required=True)
    skill_importance = fields.Float(required=False)
    section_id = fields.UUID(required=False)


class FormationRequestSchema(Schema):
    course_id = fields.Integer(required=True)
    section_id = fields.UUID(required=True)
    criteria = fields.Nested(CriteriaSchema, required=True)
    topics = fields.List(fields.Nested(TopicSchema), required=False)
    skills = fields.List(fields.Nested(SkillSchema), required=False)


class FormationResponseSchema(Schema):
    criteria = fields.Raw()  # echo of criteria response
    topics = fields.List(fields.Nested(TopicSchema))
    skills = fields.List(fields.Nested(SkillSchema))


class FormationGetResponseSchema(Schema):
    course_id = fields.UUID(allow_none=True)
    section_id = fields.UUID()
    criteria = fields.Nested(CriteriaSchema, allow_none=True)
    topics = fields.List(fields.Nested(TopicSchema))
    skills = fields.List(fields.Nested(SkillSchema))

from marshmallow import Schema, fields


class SkillScoreSchema(Schema):
    skill_id = fields.UUID(required=True)
    skill_level = fields.Integer(required=True)


class TopicRankingSchema(Schema):
    topic_id = fields.UUID(required=True)
    rank = fields.Integer(required=True)


class SubmitRequestSchema(Schema):
    section_id = fields.UUID(required=True)
    student_id = fields.Integer(required=True)
    buddy_id = fields.Integer(allow_none=True)
    mbti = fields.String(allow_none=True)
    skill_scores = fields.List(fields.Nested(SkillScoreSchema()), required=False)
    topic_rankings = fields.List(fields.Nested(TopicRankingSchema()), required=False)


class SubmitResultSchema(Schema):
    section_id = fields.UUID(required=True)
    student_id = fields.Integer(required=True)
    submitted = fields.Boolean(required=True)
    writes = fields.Dict(keys=fields.String(), values=fields.Raw())

from marshmallow import Schema, fields


class TopicPreferenceCreateSchema(Schema):
    topic_id = fields.UUID(required=True)
    rank = fields.Integer(required=True)

class TopicPreferenceBatchSchema(Schema):
    section_id = fields.UUID(required=True)
    student_id = fields.Integer(required=True)
    preferences = fields.List(fields.Nested(lambda: TopicPreferenceCreateSchema()), required=True)

class TopicPreferenceResponseSchema(Schema):
    topic_id = fields.UUID()
    section_id = fields.UUID()
    student_id = fields.Integer()
    rank = fields.Integer()

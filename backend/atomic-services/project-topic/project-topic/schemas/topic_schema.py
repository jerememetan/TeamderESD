from marshmallow import Schema, fields

class TopicCreateSchema(Schema):
    section_id = fields.UUID(required=True)
    topic_label = fields.Str(required=True)

class TopicResponseSchema(Schema):
    topic_id = fields.UUID()
    section_id = fields.UUID()
    topic_label = fields.Str()

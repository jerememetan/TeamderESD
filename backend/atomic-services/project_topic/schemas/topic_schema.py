from marshmallow import Schema, fields

class TopicCreateSchema(Schema):
    course_id = fields.UUID(required=True)
    topic_label = fields.Str(required=True)
    
class TopicResponseSchema(Schema):
    topic_id = fields.UUID()
    course_id = fields.UUID()
    topic_label = fields.Str()

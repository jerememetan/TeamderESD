from marshmallow import Schema, fields


class PeerEvalInitiateRequestSchema(Schema):
    section_id = fields.Str(required=True)
    title = fields.Str(required=False)
    due_at = fields.Str(required=False, allow_none=True)
    eval_link = fields.Str(required=False)


class PeerEvalInitiateResponseSchema(Schema):
    code = fields.Int()
    data = fields.Dict()

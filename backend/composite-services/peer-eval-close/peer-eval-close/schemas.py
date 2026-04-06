from marshmallow import Schema, fields


class PeerEvalCloseRequestSchema(Schema):
    round_id = fields.Str(required=True)


class PeerEvalCloseResponseSchema(Schema):
    code = fields.Int()
    data = fields.Dict()

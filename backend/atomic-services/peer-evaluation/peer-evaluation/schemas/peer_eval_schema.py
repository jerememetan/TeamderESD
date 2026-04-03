from marshmallow import Schema, fields, validate


class RoundCreateSchema(Schema):
    section_id = fields.String(required=True)
    title = fields.String(load_default=None)
    due_at = fields.DateTime(load_default=None)


class SubmissionEntrySchema(Schema):
    evaluatee_id = fields.Integer(required=True)
    rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    justification = fields.String(load_default="")


class SubmissionCreateSchema(Schema):
    evaluator_id = fields.Integer(required=True)
    team_id = fields.String(required=True)
    entries = fields.List(fields.Nested(SubmissionEntrySchema), required=True, validate=validate.Length(min=1))


class RoundCloseSchema(Schema):
    """Optional body when closing a round — currently empty but extensible."""
    pass

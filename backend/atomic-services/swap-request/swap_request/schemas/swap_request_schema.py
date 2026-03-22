from marshmallow import Schema, fields, validate


VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXECUTED", "FAILED"]


class SwapRequestCreateSchema(Schema):
    student_id = fields.Integer(required=True)
    current_team = fields.UUID(required=True)
    reason = fields.String(required=True)


class SwapRequestResponseSchema(Schema):
    swap_request_id = fields.UUID()
    student_id = fields.Integer()
    current_team = fields.UUID()
    reason = fields.String()
    status = fields.String(validate=validate.OneOf(VALID_STATUSES))
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class SwapRequestSimulateEventSchema(Schema):
    swap_request_id = fields.UUID(required=True)
    event_type = fields.String(
        required=False,
        load_default=None,
        validate=validate.OneOf(["SwapRejected", "SwapExecuted", "SwapFailed"]),
    )

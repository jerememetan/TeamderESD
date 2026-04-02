from marshmallow import Schema, fields


class ErrorLogResponseSchema(Schema):
    id = fields.Integer(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    source_service = fields.String(required=True)
    routing_key = fields.String(required=True)
    error_code = fields.String(allow_none=True)
    error_message = fields.String(required=True)
    correlation_id = fields.String(allow_none=True)
    context_json = fields.Raw(allow_none=True)
    status = fields.String(required=True)


class ErrorLogListMetaSchema(Schema):
    page = fields.Integer(required=True)
    page_size = fields.Integer(required=True)
    total = fields.Integer(required=True)
    total_pages = fields.Integer(required=True)


class ErrorLogListResponseSchema(Schema):
    data = fields.List(fields.Nested(ErrorLogResponseSchema), required=True)
    meta = fields.Nested(ErrorLogListMetaSchema, required=True)
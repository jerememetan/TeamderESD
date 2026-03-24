from marshmallow import Schema, fields, validate


class FormTemplateCreateSchema(Schema):
    section_id = fields.UUID(required=True)
    criteria = fields.Dict(required=True)
    custom_entries = fields.List(fields.Dict(), required=False, load_default=[])


class FormSubmissionCreateSchema(Schema):
    section_id = fields.UUID(required=True)
    student_id = fields.Integer(required=True)
    responses = fields.Dict(required=True)


class FormTemplateResponseSchema(Schema):
    section_id = fields.UUID()
    criteria_snapshot = fields.Dict()
    fields = fields.List(fields.Dict())
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class FormLinkBatchCreateSchema(Schema):
    section_id = fields.UUID(required=True)
    student_ids = fields.List(fields.Integer(), required=True)
    base_form_url = fields.String(required=False, load_default="")


class FormLinkResponseSchema(Schema):
    section_id = fields.UUID()
    student_id = fields.Integer()
    link_token = fields.String()
    form_url = fields.String()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class FormSubmissionResponseSchema(Schema):
    section_id = fields.UUID()
    student_id = fields.Integer()
    responses = fields.Dict()
    generated_version = fields.DateTime(allow_none=True)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class GeneratedFieldSchema(Schema):
    key = fields.String(required=True, validate=validate.Length(min=1))
    label = fields.String(required=True, validate=validate.Length(min=1))
    input_type = fields.String(required=True, validate=validate.OneOf(
        ["text", "number", "select", "multiselect", "boolean"]
    ))
    required = fields.Boolean(required=True)
    weight = fields.Float(required=True)
    source = fields.String(required=True)
    options = fields.List(fields.String(), required=False, load_default=[])

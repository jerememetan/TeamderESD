from marshmallow import Schema, fields


class FormationNotificationRequestSchema(Schema):
    section_id = fields.Str(required=True)


class NotificationCreatedItemSchema(Schema):
    student_id = fields.Integer()
    email = fields.Str()
    form_id = fields.Str()
    form_link = fields.Str()


class NotificationFailedItemSchema(Schema):
    student_id = fields.Integer()
    reason = fields.Str()


class FormationNotificationResponseSchema(Schema):
    section_id = fields.Str()
    notifications_created = fields.List(fields.Nested(NotificationCreatedItemSchema))
    notifications_failed = fields.List(fields.Nested(NotificationFailedItemSchema))
    summary = fields.Dict()
    message = fields.Str(required=False)

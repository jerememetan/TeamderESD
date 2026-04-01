from marshmallow import Schema, fields


class TeamStudentSchema(Schema):
    student_id = fields.Integer(required=True)


class TeamSchema(Schema):
    team_id = fields.String(required=True)
    team_number = fields.Integer(allow_none=True)
    students = fields.List(fields.Nested(TeamStudentSchema), required=True)


class DataSchema(Schema):
    section_id = fields.String(required=True)
    teams = fields.List(fields.Nested(TeamSchema), required=True)


class TeamFormationSuccessSchema(Schema):
    code = fields.Integer(required=True)
    data = fields.Nested(DataSchema, required=True)


class ErrorSchema(Schema):
    code = fields.Integer(required=True)
    message = fields.String(required=True)


class TeamFormationDebugSchema(Schema):
    code = fields.Integer(required=True)
    message = fields.String(required=True)
    data = fields.Dict(required=True)

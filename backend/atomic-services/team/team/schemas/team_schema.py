from marshmallow import Schema, fields


class TeamStudentSchema(Schema):
    student_id = fields.Int(required=True)

class TeamInRequestSchema(Schema):
    team_id = fields.UUID(required=True)
    students = fields.List(fields.Nested(TeamStudentSchema), required=True)

class TeamBulkCreateSchema(Schema):
    section_id = fields.UUID(required=True)
    teams = fields.List(fields.Nested(TeamInRequestSchema), required=True)


class TeamCreateSchema(TeamBulkCreateSchema):
    pass

class TeamResponseSchema(Schema):
    team_id = fields.UUID()
    team_number = fields.Int()
    students = fields.List(fields.Nested(TeamStudentSchema))

class TeamsBySectionResponseSchema(Schema):
    section_id = fields.UUID()
    teams = fields.List(fields.Nested(TeamResponseSchema))


class TeamsBySectionsDataSchema(Schema):
    sections = fields.List(fields.Nested(TeamsBySectionResponseSchema))


class TeamsBySectionsResponseSchema(Schema):
    code = fields.Int()
    data = fields.Nested(TeamsBySectionsDataSchema)

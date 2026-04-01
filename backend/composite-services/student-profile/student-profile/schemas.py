from marshmallow import Schema, fields


class CompetenceSchema(Schema):
    skill_id = fields.String(required=True)
    skill_level = fields.Integer(required=True)


class ProfileSchema(Schema):
    name = fields.String(allow_none=True)
    email = fields.String(allow_none=True)
    school_id = fields.String(allow_none=True)
    year = fields.Integer(allow_none=True)
    gpa = fields.Float(allow_none=True)
    gender = fields.String(allow_none=True)
    buddy_id = fields.Integer(allow_none=True)
    mbti = fields.String(allow_none=True)
    reputation_score = fields.Integer(allow_none=True)
    topic_preferences = fields.List(fields.String(), allow_none=True)
    competences = fields.List(fields.Nested(CompetenceSchema), allow_none=True)


class StudentItemSchema(Schema):
    student_id = fields.Integer(required=True)
    profile = fields.Nested(ProfileSchema, required=True)


class DataSchema(Schema):
    section_id = fields.String(required=True)
    students = fields.List(fields.Nested(StudentItemSchema), required=True)


class StudentProfileResponseSchema(Schema):
    code = fields.Integer(required=True)
    data = fields.Nested(DataSchema, required=True)

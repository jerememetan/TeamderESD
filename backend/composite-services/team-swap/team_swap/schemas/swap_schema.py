from marshmallow import Schema, fields


class StudentSchema(Schema):
    student_id = fields.Integer(required=True)
    year = fields.Integer(required=True)
    gender = fields.String(required=True)
    gpa = fields.Float(required=False, load_default=None)
    skills = fields.Dict(required=False, load_default={})


class TeamSchema(Schema):
    team_id = fields.UUID(required=True)
    team_number = fields.Integer(required=True)
    section_id = fields.UUID(required=True)
    students = fields.List(fields.Integer(), required=True)


class ApprovedSwapRequestSchema(Schema):
    swap_request_id = fields.UUID(required=True)
    student_id = fields.Integer(required=True)
    current_team = fields.UUID(required=True)


class SwapConstraintsSchema(Schema):
    min_team_avg_gpa = fields.Float(required=False, load_default=None)
    require_year_diversity = fields.Boolean(required=False, load_default=False)
    max_skill_imbalance = fields.Float(required=False, load_default=None)
    swap_window_days = fields.Integer(required=False, load_default=None)


class OptimizeRequestSchema(Schema):
    section_id = fields.UUID(required=True)
    course_id = fields.Integer(required=True)
    module_id = fields.UUID(required=True)
    class_id = fields.UUID(required=True)
    teams = fields.List(fields.Nested(TeamSchema), required=True)
    students = fields.List(fields.Nested(StudentSchema), required=True)
    approved_swap_requests = fields.List(fields.Nested(ApprovedSwapRequestSchema), required=True)
    swap_constraints = fields.Nested(SwapConstraintsSchema, required=True)


class SwapPairSchema(Schema):
    student_id_1 = fields.Integer()
    student_id_2 = fields.Integer()
    team_id_1 = fields.UUID()
    team_id_2 = fields.UUID()


class RequestResultSchema(Schema):
    swap_request_id = fields.UUID()
    student_id = fields.Integer()
    status = fields.String()  # EXECUTED or FAILED
    reason = fields.String(required=False)


class OptimizeResponseSchema(Schema):
    code = fields.Integer()
    message = fields.String()
    data = fields.Dict()
    # data contains:
    # - new_team_roster: {section_id, teams[...]}
    # - per_request_result: [RequestResultSchema]
    # - selected_pairs: [SwapPairSchema]
    # - solver_objective: float (penalty minimized)
    # - num_executed: int

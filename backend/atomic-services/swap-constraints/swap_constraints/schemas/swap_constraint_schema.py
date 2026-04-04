from marshmallow import Schema, fields, validate


class SwapConstraintCreateSchema(Schema):
    course_id = fields.UUID(required=True)
    module_id = fields.UUID(required=True)
    class_id = fields.UUID(required=True)
    gpa_variance_level = fields.String(required=False, load_default="standard", validate=validate.OneOf(["strict", "standard", "none"]))
    class_avg_gpa = fields.Float(required=False, load_default=0.0)
    require_year_diversity = fields.Boolean(required=False, load_default=False)
    max_skill_imbalance = fields.Float(required=False, load_default=0.0)
    swap_window_days = fields.Integer(required=False, load_default=2)


class SwapConstraintResponseSchema(Schema):
    constraint_id = fields.UUID()
    course_id = fields.UUID()
    module_id = fields.UUID()
    class_id = fields.UUID()
    gpa_variance_level = fields.Method("get_gpa_variance_level")
    class_avg_gpa = fields.Float()
    require_year_diversity = fields.Boolean()
    max_skill_imbalance = fields.Float()
    swap_window_days = fields.Integer()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()

    def get_gpa_variance_level(self, obj):
        value = getattr(obj, "gpa_variance_level", None)
        return getattr(value, "value", value)

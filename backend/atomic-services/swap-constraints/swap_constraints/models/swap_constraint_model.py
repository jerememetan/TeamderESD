import uuid

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint, func


db = SQLAlchemy()


class SwapConstraint(db.Model):
    __tablename__ = "swap_constraint"
    __table_args__ = (
        UniqueConstraint("course_id", "module_id", "class_id", name="uq_swap_constraint_scope"),
        {"schema": "swap_constraints"},
    )

    constraint_id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    course_id = db.Column(db.Uuid, nullable=False, index=True)
    module_id = db.Column(db.Uuid, nullable=False, index=True)
    class_id = db.Column(db.Uuid, nullable=False, index=True)

    # Example hard constraints for scenario configuration.
    min_team_avg_gpa = db.Column(db.Float, nullable=False, default=0.0)
    require_year_diversity = db.Column(db.Boolean, nullable=False, default=False)
    max_skill_imbalance = db.Column(db.Float, nullable=False, default=0.0)
    swap_window_days = db.Column(db.Integer, nullable=False, default=2)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

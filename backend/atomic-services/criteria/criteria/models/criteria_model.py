from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func

db = SQLAlchemy()

class Criteria(db.Model):
    __tablename__ = "criteria"
    __table_args__ = {"schema": "criteria"}
    
    section_id = db.Column(db.Uuid, primary_key=True)
    course_id = db.Column(db.Uuid, nullable=False)
    num_groups = db.Column(db.Integer, nullable=False)
    school_weight = db.Column(db.Float, nullable=False, default=0.0)
    year_weight = db.Column(db.Float, nullable=False, default=0.0)
    gender_weight = db.Column(db.Float, nullable=False, default=0.0)
    gpa_weight = db.Column(db.Float, nullable=False, default=0.0)
    reputation_weight = db.Column(db.Float, nullable=False, default=0.0)
    mbti_weight = db.Column(db.Float, nullable=False, default=0.0)
    buddy_weight = db.Column(db.Float, nullable=False, default=0.0)
    topic_weight = db.Column(db.Float, nullable=False, default=0.0)
    skill_weight = db.Column(db.Float, nullable=False, default=0.0)
    randomness = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
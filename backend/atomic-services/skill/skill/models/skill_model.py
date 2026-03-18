from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
import uuid

db = SQLAlchemy()

class Skill(db.Model):
    __tablename__ = "skills"
    __table_args__ = {"schema": "skills"}

    skill_id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    section_id = db.Column(db.Uuid, nullable=False)
    skill_label = db.Column(db.Text, nullable=False)
    skill_importance = db.Column(db.Float, nullable=False, default=1.0)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
from flask_sqlalchemy import SQLAlchemy
import uuid
from sqlalchemy import func

db = SQLAlchemy()

class Competence(db.Model):
    __tablename__ = "competence"
    __table_args__ = {"schema": "student_competence"}

    skill_id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    section_id = db.Column(db.Uuid, primary_key=True, nullable=False)
    student_id = db.Column(db.Integer, primary_key=True, nullable=False)
    skill_level = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

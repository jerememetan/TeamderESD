import uuid
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func

db = SQLAlchemy()

class Enrollment(db.Model):
    __tablename__ = "enrollment"
    __table_args__ = {"schema": "enrollment"}

    section_id = db.Column(db.Uuid, primary_key=True)
    student_id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)

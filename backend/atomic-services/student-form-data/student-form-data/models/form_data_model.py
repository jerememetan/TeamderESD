
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, CheckConstraint
import uuid

db = SQLAlchemy()




class FormData(db.Model):
    __tablename__ = "form_data"
    __table_args__ = (
        {"schema": "student_form_data"},
    )

    section_id = db.Column(db.Uuid, primary_key=True, nullable=False)
    student_id = db.Column(db.Integer, primary_key=True, nullable=False)
    buddy_id = db.Column(db.Integer, nullable=True)
    mbti = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

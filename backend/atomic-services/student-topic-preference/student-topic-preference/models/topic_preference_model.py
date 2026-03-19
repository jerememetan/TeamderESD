from flask_sqlalchemy import SQLAlchemy
import uuid
from sqlalchemy import func

db = SQLAlchemy()

class TopicPreference(db.Model):
    __tablename__ = "topic_preference"
    __table_args__ = {"schema": "student_topic_preference"}

    topic_id = db.Column(db.Uuid, primary_key=True, nullable=False)
    section_id = db.Column(db.Uuid, primary_key=True, nullable=False)
    student_id = db.Column(db.Integer, primary_key=True, nullable=False)
    rank = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

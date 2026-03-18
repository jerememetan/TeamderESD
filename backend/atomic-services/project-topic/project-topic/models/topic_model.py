from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
import uuid

db = SQLAlchemy()

class Topic(db.Model):
    __tablename__ = "project_topics"
    __table_args__ = {"schema": "project_topics"}

    topic_id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    section_id = db.Column(db.Uuid, nullable=False)
    topic_label = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
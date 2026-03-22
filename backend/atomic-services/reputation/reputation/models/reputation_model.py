from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func

db = SQLAlchemy()

class Reputation(db.Model):
    __tablename__ = "reputation"
    __table_args__ = {"schema": "reputation"}

    student_id = db.Column(db.Integer, primary_key=True)
    reputation_score = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

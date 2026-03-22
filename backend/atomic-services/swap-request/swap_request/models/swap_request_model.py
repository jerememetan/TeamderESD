import uuid

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func


db = SQLAlchemy()


class SwapRequest(db.Model):
    __tablename__ = "swap_request"
    __table_args__ = {"schema": "swap_request"}

    swap_request_id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    student_id = db.Column(db.Integer, nullable=False)
    current_team = db.Column(db.Uuid, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.Text, nullable=False, server_default="PENDING")
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)

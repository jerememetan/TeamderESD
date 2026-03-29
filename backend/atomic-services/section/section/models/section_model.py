from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func


db = SQLAlchemy()


class Section(db.Model):
    __tablename__ = "section"
    __table_args__ = (
        db.UniqueConstraint('section_number', 'course_id', name='uix_section_course'),
        {"schema": "section"}
        )

    id = db.Column(db.Uuid, primary_key=True)
    section_number = db.Column(db.BigInteger, nullable=False)
    course_id = db.Column(db.BigInteger, nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, server_default="true")
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    stage = db.Column(db.Text, nullable=False, server_default="setup")

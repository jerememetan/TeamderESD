from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, UniqueConstraint, text

db = SQLAlchemy()


class StudentForm(db.Model):
    __tablename__ = "student_form"
    __table_args__ = (
        UniqueConstraint('student_id', 'section_id', name='student_section_unique'),
        {"schema": "student_form"},
    )

    id = db.Column(db.BigInteger, primary_key=True, nullable=False, autoincrement=True)
    student_id = db.Column(db.BigInteger, nullable=False)
    section_id = db.Column(db.Uuid, nullable=False)
    submitted = db.Column(db.Boolean, nullable=False, server_default=text('false'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

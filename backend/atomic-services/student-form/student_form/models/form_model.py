from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func

db = SQLAlchemy()


class StudentFormTemplate(db.Model):
    __tablename__ = "form_template"
    __table_args__ = ({"schema": "student_form"},)

    section_id = db.Column(db.Uuid, primary_key=True, nullable=False)
    criteria_snapshot = db.Column(db.JSON, nullable=False)
    fields = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class StudentFormSubmission(db.Model):
    __tablename__ = "form_submission"
    __table_args__ = ({"schema": "student_form"},)

    section_id = db.Column(db.Uuid, primary_key=True, nullable=False)
    student_id = db.Column(db.Integer, primary_key=True, nullable=False)
    responses = db.Column(db.JSON, nullable=False)
    generated_version = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class StudentFormLink(db.Model):
    __tablename__ = "form_link"
    __table_args__ = ({"schema": "student_form"},)

    section_id = db.Column(db.Uuid, primary_key=True, nullable=False)
    student_id = db.Column(db.Integer, primary_key=True, nullable=False)
    link_token = db.Column(db.Text, nullable=False, unique=True)
    form_url = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
import uuid

db = SQLAlchemy()

class Team(db.Model):
    __tablename__ = "team"
    __table_args__ = {"schema": "team"}

    team_id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    section_id = db.Column(db.Uuid, nullable=False)
    team_number = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    students = db.relationship("TeamStudent", back_populates="team", cascade="all, delete-orphan")

class TeamStudent(db.Model):
    __tablename__ = "team_student"
    __table_args__ = {"schema": "team"}

    team_id = db.Column(db.Uuid, db.ForeignKey("team.team.team_id"), primary_key=True)
    student_id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    team = db.relationship("Team", back_populates="students")

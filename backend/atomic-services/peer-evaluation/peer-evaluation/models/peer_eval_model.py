from flask_sqlalchemy import SQLAlchemy
import uuid

db = SQLAlchemy()


class PeerEvalRound(db.Model):
    __tablename__ = "peer_eval_rounds"

    round_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    section_id = db.Column(db.String(36), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="active")
    title = db.Column(db.String(255), nullable=True)
    due_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    submissions = db.relationship("PeerEvalSubmission", backref="round", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "round_id": self.round_id,
            "section_id": self.section_id,
            "status": self.status,
            "title": self.title,
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PeerEvalSubmission(db.Model):
    __tablename__ = "peer_eval_submissions"

    submission_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    round_id = db.Column(db.String(36), db.ForeignKey("peer_eval_rounds.round_id", ondelete="CASCADE"), nullable=False)
    evaluator_id = db.Column(db.Integer, nullable=False)
    evaluatee_id = db.Column(db.Integer, nullable=False)
    team_id = db.Column(db.String(36), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    justification = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    __table_args__ = (
        db.UniqueConstraint("round_id", "evaluator_id", "evaluatee_id", name="uq_round_evaluator_evaluatee"),
    )

    def to_dict(self):
        return {
            "submission_id": self.submission_id,
            "round_id": self.round_id,
            "evaluator_id": self.evaluator_id,
            "evaluatee_id": self.evaluatee_id,
            "team_id": self.team_id,
            "rating": self.rating,
            "justification": self.justification,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
        }

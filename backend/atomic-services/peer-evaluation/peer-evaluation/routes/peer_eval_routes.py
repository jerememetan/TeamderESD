from flask import Blueprint, request, jsonify
from models.peer_eval_model import db, PeerEvalRound, PeerEvalSubmission
from schemas.peer_eval_schema import RoundCreateSchema, SubmissionCreateSchema
from marshmallow import ValidationError
from sqlalchemy import func

peer_eval_bp = Blueprint("peer_eval", __name__)

round_create_schema = RoundCreateSchema()
submission_create_schema = SubmissionCreateSchema()


# ── Rounds ────────────────────────────────────────────────────────────

@peer_eval_bp.route("/peer-eval/rounds", methods=["POST"])
def create_round():
    """Create a new peer evaluation round for a section."""
    payload = request.get_json()
    if not payload:
        return jsonify({"code": 400, "message": "request body is required"}), 400

    try:
        data = round_create_schema.load(payload)
    except ValidationError as err:
        return jsonify({"code": 400, "message": "validation error", "errors": err.messages}), 400

    # Check for existing active round for this section
    existing = PeerEvalRound.query.filter_by(
        section_id=data["section_id"], status="active"
    ).first()
    if existing:
        return jsonify({
            "code": 409,
            "message": "an active peer evaluation round already exists for this section",
            "data": existing.to_dict(),
        }), 409

    new_round = PeerEvalRound(
        section_id=data["section_id"],
        title=data.get("title"),
        due_at=data.get("due_at"),
        status="active",
    )
    db.session.add(new_round)
    db.session.commit()

    return jsonify({"code": 201, "data": new_round.to_dict()}), 201


@peer_eval_bp.route("/peer-eval/rounds", methods=["GET"])
def get_rounds():
    """Get peer evaluation rounds, optionally filtered by section_id and/or status."""
    section_id = request.args.get("section_id")
    status = request.args.get("status")

    query = PeerEvalRound.query
    if section_id:
        query = query.filter_by(section_id=section_id)
    if status:
        query = query.filter_by(status=status)

    rounds = query.order_by(PeerEvalRound.created_at.desc()).all()
    return jsonify({"code": 200, "data": [r.to_dict() for r in rounds]}), 200


@peer_eval_bp.route("/peer-eval/rounds/<round_id>", methods=["GET"])
def get_round(round_id):
    """Get a single round with submission summary."""
    peer_round = PeerEvalRound.query.get(round_id)
    if not peer_round:
        return jsonify({"code": 404, "message": "round not found"}), 404

    # Count submissions and unique evaluators
    submission_count = PeerEvalSubmission.query.filter_by(round_id=round_id).count()
    evaluator_count = (
        db.session.query(func.count(func.distinct(PeerEvalSubmission.evaluator_id)))
        .filter_by(round_id=round_id)
        .scalar()
    )

    result = peer_round.to_dict()
    result["submission_count"] = submission_count
    result["evaluator_count"] = evaluator_count

    return jsonify({"code": 200, "data": result}), 200


# ── Submissions ───────────────────────────────────────────────────────

@peer_eval_bp.route("/peer-eval/rounds/<round_id>/submit", methods=["POST"])
def submit_evaluations(round_id):
    """Student submits peer evaluations for all teammates in one request."""
    peer_round = PeerEvalRound.query.get(round_id)
    if not peer_round:
        return jsonify({"code": 404, "message": "round not found"}), 404

    if peer_round.status != "active":
        return jsonify({"code": 400, "message": f"round is {peer_round.status}, submissions not accepted"}), 400

    payload = request.get_json()
    if not payload:
        return jsonify({"code": 400, "message": "request body is required"}), 400

    try:
        data = submission_create_schema.load(payload)
    except ValidationError as err:
        return jsonify({"code": 400, "message": "validation error", "errors": err.messages}), 400

    evaluator_id = data["evaluator_id"]
    team_id = data["team_id"]
    entries = data["entries"]

    # Check if evaluator already submitted for this round
    existing = PeerEvalSubmission.query.filter_by(
        round_id=round_id, evaluator_id=evaluator_id
    ).first()
    if existing:
        return jsonify({
            "code": 409,
            "message": "evaluator has already submitted for this round",
        }), 409

    created = []
    for entry in entries:
        submission = PeerEvalSubmission(
            round_id=round_id,
            evaluator_id=evaluator_id,
            evaluatee_id=entry["evaluatee_id"],
            team_id=team_id,
            rating=entry["rating"],
            justification=entry.get("justification", ""),
        )
        db.session.add(submission)
        created.append(submission)

    db.session.commit()

    return jsonify({
        "code": 201,
        "data": {
            "round_id": round_id,
            "evaluator_id": evaluator_id,
            "submissions": [s.to_dict() for s in created],
        },
    }), 201


@peer_eval_bp.route("/peer-eval/rounds/<round_id>/submissions", methods=["GET"])
def get_submissions(round_id):
    """Get all submissions for a round, optionally filtered by evaluator_id."""
    peer_round = PeerEvalRound.query.get(round_id)
    if not peer_round:
        return jsonify({"code": 404, "message": "round not found"}), 404

    evaluator_id = request.args.get("evaluator_id", type=int)
    query = PeerEvalSubmission.query.filter_by(round_id=round_id)
    if evaluator_id is not None:
        query = query.filter_by(evaluator_id=evaluator_id)

    submissions = query.order_by(PeerEvalSubmission.submitted_at).all()
    return jsonify({"code": 200, "data": [s.to_dict() for s in submissions]}), 200


# ── Close Round & Compute Reputation ──────────────────────────────────

@peer_eval_bp.route("/peer-eval/rounds/<round_id>/close", methods=["POST"])
def close_round(round_id):
    """
    Close a round and compute per-student reputation deltas.

    The delta for each student is: (average rating received - 3.0) * 10
    This means a rating of 3 is neutral, above 3 is positive, below 3 is negative.

    Returns the computed deltas so the orchestrator can push them to the
    Reputation Service.
    """
    peer_round = PeerEvalRound.query.get(round_id)
    if not peer_round:
        return jsonify({"code": 404, "message": "round not found"}), 404

    if peer_round.status == "closed":
        return jsonify({"code": 400, "message": "round is already closed"}), 400

    # Get all submissions for this round
    submissions = PeerEvalSubmission.query.filter_by(round_id=round_id).all()

    if not submissions:
        peer_round.status = "closed"
        peer_round.updated_at = func.now()
        db.session.commit()
        return jsonify({
            "code": 200,
            "data": {
                "round": peer_round.to_dict(),
                "reputation_deltas": [],
                "message": "round closed with no submissions",
            },
        }), 200

    # Aggregate ratings per evaluatee
    evaluatee_ratings = {}
    for sub in submissions:
        if sub.evaluatee_id not in evaluatee_ratings:
            evaluatee_ratings[sub.evaluatee_id] = []
        evaluatee_ratings[sub.evaluatee_id].append(sub.rating)

    # Compute deltas: (avg_rating - 3) * 10, rounded to int
    reputation_deltas = []
    for student_id, ratings in evaluatee_ratings.items():
        avg_rating = sum(ratings) / len(ratings)
        delta = round((avg_rating - 3.0) * 10)
        reputation_deltas.append({
            "student_id": student_id,
            "avg_rating": round(avg_rating, 2),
            "num_evaluations": len(ratings),
            "delta": delta,
        })

    # Mark round as closed
    peer_round.status = "closed"
    peer_round.updated_at = func.now()
    db.session.commit()

    return jsonify({
        "code": 200,
        "data": {
            "round": peer_round.to_dict(),
            "reputation_deltas": reputation_deltas,
        },
    }), 200

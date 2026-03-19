from flask import Blueprint, request, jsonify
from sqlalchemy import and_
from ..models.topic_preference_model import TopicPreference
from ..app import db
from ..schemas.topic_preference_schema import TopicPreferenceBatchSchema, TopicPreferenceCreateSchema, TopicPreferenceResponseSchema

from marshmallow import ValidationError
create_schema = TopicPreferenceCreateSchema()
response_schema = TopicPreferenceResponseSchema()
many_response_schema = TopicPreferenceResponseSchema(many=True)

topic_preference_bp = Blueprint('topic_preference', __name__)

@topic_preference_bp.route("", methods=["POST"])
def create_topic_preferences():
    payload = request.get_json()
    schema = TopicPreferenceBatchSchema()
    try:
        batch = schema.load(payload)
    except ValidationError as err:
        return jsonify({"code": 400, "error": err.messages}), 400
    section_id = batch["section_id"]
    student_id = batch["student_id"]
    preferences = batch["preferences"]
    try:
        TopicPreference.query.filter_by(section_id=section_id, student_id=student_id).delete()
        db.session.commit()
        results = []
        for pref in preferences:
            obj = TopicPreference(
                topic_id=pref["topic_id"],
                section_id=section_id,
                student_id=student_id,
                rank=pref["rank"]
            )
            db.session.merge(obj)
            results.append(obj)
        db.session.commit()
        return jsonify({"code": 201, "data": many_response_schema.dump(results)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"code": 500, "error": str(e)}), 500

@topic_preference_bp.route("", methods=["GET"])
def get_topic_preferences():
    section_id = request.args.get("section_id")
    student_id = request.args.get("student_id")
    topic_id = request.args.get("topic_id")
    query = TopicPreference.query
    if section_id:
        query = query.filter_by(section_id=section_id)
    if student_id:
        query = query.filter_by(student_id=student_id)
    if topic_id:
        query = query.filter_by(topic_id=topic_id)
    results = query.all()
    return jsonify({"code": 200, "data": many_response_schema.dump(results)}), 200


from ..schemas.topic_schema import TopicCreateSchema, TopicResponseSchema
from flask import Blueprint, request, jsonify
from uuid import uuid4
from ..app import db
from ..models.topic_model import Topic

topic_bp = Blueprint("topic", __name__)
create_schema = TopicCreateSchema()
response_schema = TopicResponseSchema()
many_response_schema = TopicResponseSchema(many=True)

@topic_bp.route("", methods=["GET"])
def get_topics():
    section_id = request.args.get("section_id")
    query = Topic.query
    if section_id:
        query = query.filter_by(section_id=section_id)
    topics = query.all()
    return jsonify({
     "code": 200,
     "data": many_response_schema.dump(topics)   
    }), 200
    
@topic_bp.route("", methods=["POST"])
def create_topic():
    payload = request.get_json()
    data = create_schema.load(payload)
    topic = Topic(
        section_id=data["section_id"],
        topic_label=data["topic_label"],
    )
    db.session.add(topic)
    db.session.commit()
    
    return jsonify({
        "code": 201,
        "data": response_schema.dump(topic)
    }), 201

@topic_bp.route("/<uuid:topic_id>", methods=["GET"])
def get_topic_by_id(topic_id):
    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({"code": 404, "message": "Topic not found"}), 404
    return jsonify({"code": 200, "data": response_schema.dump(topic)}), 200
    
@topic_bp.route("", methods=["DELETE"])
def delete_topics_by_section():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"code": 400, "error": "Missing section_id in query parameters."}), 400
    deleted = Topic.query.filter_by(section_id=section_id).delete()
    db.session.commit()
    return jsonify({"code": 200, "deleted": deleted}), 200
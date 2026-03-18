from ..schemas.topic_schema import TopicCreateSchema, TopicResponseSchema
from flask import Blueprint, request, jsonify
from uuid import uuid4
from ..app import db
from ..models.topic_model import Topic

topics_bp = Blueprint("topics", __name__)
create_schema = TopicCreateSchema()
response_schema = TopicResponseSchema()
many_response_schema = TopicResponseSchema(many=True)

@topics_bp.route("", methods=["GET"])
def get_topics():
    course_id = request.args.get("course_id")
    if course_id:
        topics = Topic.query.filter_by(course_id=course_id).all()
    else:
        topics = Topic.query.all()
    return jsonify({
     "code": 200,
     "data": many_response_schema.dump(topics)   
    }), 200
    
@topics_bp.route("", methods=["POST"])
def create_topic():
    payload = request.get_json()
    data = create_schema.load(payload)
    
    topic = Topic(
        topic_id=uuid4(),
        course_id=data["course_id"],
        topic_label=data["topic_label"],
    )
    db.session.add(topic)
    db.session.commit()
    
    return jsonify({
        "code": 201,
        "data": response_schema.dump(topic)
    }), 201
    
@topics_bp.route("/<uuid:skill_id>", methods=["GET"])
def get_topic_by_id(topic_id):
    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({"code": 404, "message": "Topic not found"}), 404
    return jsonify({"code": 200, "data": response_schema.dump(topic)}, 200)
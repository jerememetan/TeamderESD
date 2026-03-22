from ..schemas.team_schema import TeamCreateSchema, TeamResponseSchema
from flask import Blueprint, request, jsonify
from uuid import uuid4
from ..models.team_model import db, Team, TeamStudent

team_bp = Blueprint("team", __name__)

from ..schemas.team_schema import TeamsBySectionResponseSchema

create_schema = TeamCreateSchema()
response_schema = TeamResponseSchema()
teams_by_section_response_schema = TeamsBySectionResponseSchema()

@team_bp.route("", methods=["POST"])
def create_teams():
    payload = request.get_json()
    data = create_schema.load(payload)
    section_id = data["section_id"]
    Team.query.filter_by(section_id=section_id).delete()
    db.session.commit()

    created_teams = []
    for team_data in data["teams"]:
        team = Team(
            team_id=team_data["team_id"],
            section_id=section_id
        )
        db.session.add(team)
        db.session.flush()
        for student in team_data["students"]:
            ts = TeamStudent(
                team_id=team.team_id,
                student_id=student["student_id"]
            )
            db.session.add(ts)
        db.session.commit()
        db.session.refresh(team)
        team.students = TeamStudent.query.filter_by(team_id=team.team_id).all()
        created_teams.append(team)
    return jsonify({
        "code": 201,
        "data": {
            "section_id": str(section_id),
            "teams": [response_schema.dump(team) for team in created_teams]
        }
    }), 201

@team_bp.route("/<uuid:team_id>", methods=["GET"])
def get_team_by_id(team_id):
    team = Team.query.get(team_id)
    if not team:
        return jsonify({"code": 404, "message": "Team not found"}), 404
    team.students = TeamStudent.query.filter_by(team_id=team.team_id).all()
    return jsonify({"code": 200, "data": response_schema.dump(team)}), 200

@team_bp.route("", methods=["GET"])
def get_teams_by_section():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"code": 400, "message": "Missing section_id"}), 400
    teams = Team.query.filter_by(section_id=section_id).all()
    for team in teams:
        team.students = TeamStudent.query.filter_by(team_id=team.team_id).all()
    return jsonify({
        "code": 200,
        "data": {
            "section_id": section_id,
            "teams": [response_schema.dump(team) for team in teams]
        }
    }), 200

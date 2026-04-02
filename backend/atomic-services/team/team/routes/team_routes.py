from ..schemas.team_schema import TeamCreateSchema, TeamResponseSchema
from flask import Blueprint, request, jsonify
from uuid import uuid4
from ..models.team_model import db, Team, TeamStudent
from collections import defaultdict
from uuid import UUID

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

# OpenAPI annotations
create_teams._openapi_request_schema = TeamCreateSchema
create_teams._openapi_response_schema = TeamsBySectionResponseSchema

@team_bp.route("/<uuid:team_id>", methods=["GET"])
def get_team_by_id(team_id):
    team = Team.query.get(team_id)
    if not team:
        return jsonify({"code": 404, "message": "Team not found"}), 404
    team.students = TeamStudent.query.filter_by(team_id=team.team_id).all()
    return jsonify({"code": 200, "data": response_schema.dump(team)}), 200

get_team_by_id._openapi_response_schema = TeamResponseSchema

@team_bp.route("", methods=["GET"])
def get_teams_by_section():
    section_id = request.args.get("section_id")
    section_ids_args = request.args.getlist("section_ids")

    # Support `section_ids=a,b,c` and `section_ids=a&section_ids=b` formats.
    expanded_section_ids = []
    for raw_value in section_ids_args:
        if not raw_value:
            continue
        if "," in raw_value:
            expanded_section_ids.extend([part.strip() for part in raw_value.split(",") if part.strip()])
        else:
            expanded_section_ids.append(raw_value.strip())

    requested_section_ids = []
    if section_id:
        requested_section_ids.append(section_id)
    requested_section_ids.extend(expanded_section_ids)

    if not requested_section_ids:
        return jsonify({"code": 400, "message": "Missing section_id or section_ids"}), 400

    deduped_section_ids = []
    seen = set()
    for sid in requested_section_ids:
        if sid not in seen:
            seen.add(sid)
            deduped_section_ids.append(sid)

    parsed_section_ids = []
    for sid in deduped_section_ids:
        try:
            parsed_section_ids.append(UUID(str(sid)))
        except (ValueError, TypeError):
            return jsonify({"code": 400, "message": f"Invalid section_id: {sid}"}), 400

    teams = Team.query.filter(Team.section_id.in_(parsed_section_ids)).all()

    team_ids = [team.team_id for team in teams]
    students_by_team_id = defaultdict(list)
    if team_ids:
        team_students = TeamStudent.query.filter(TeamStudent.team_id.in_(team_ids)).all()
        for team_student in team_students:
            students_by_team_id[team_student.team_id].append(team_student)

    for team in teams:
        team.students = students_by_team_id.get(team.team_id, [])

    teams_by_section = defaultdict(list)
    for team in teams:
        teams_by_section[str(team.section_id)].append(response_schema.dump(team))

    # Preserve existing contract for single-section queries.
    if section_id and not section_ids_args:
        return jsonify({
            "code": 200,
            "data": {
                "section_id": section_id,
                "teams": teams_by_section.get(str(section_id), [])
            }
        }), 200

    sections_payload = [
        {
            "section_id": sid,
            "teams": teams_by_section.get(str(sid), []),
        }
        for sid in deduped_section_ids
    ]

    return jsonify({
        "code": 200,
        "data": {
            "sections": sections_payload,
        }
    }), 200

get_teams_by_section._openapi_response_schema = TeamsBySectionResponseSchema

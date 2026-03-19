from flask import Flask, request, jsonify
import requests
import os


app = Flask(__name__)

def safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {}

CRITERIA_URL = os.getenv("CRITERIA_URL", "http://localhost:3004/criteria")
TOPIC_URL = os.getenv("TOPIC_URL", "http://localhost:3003/topic")
SKILL_URL = os.getenv("SKILL_URL", "http://localhost:3002/skill")

@app.route("/", methods=["POST"])
def aggregate():
    payload = request.get_json()
    if not payload or "course_id" not in payload or "section_id" not in payload:
        return jsonify({"error": "Missing course_id, section_id, or payload"}), 400
    course_id = payload["course_id"]
    section_id = payload["section_id"]
    results = {"criteria": None, "topics": [], "skills": []}

    # --- Criteria ---
    criteria_data = payload.get("criteria")
    if not criteria_data or not isinstance(criteria_data, dict):
        return jsonify({"error": "Missing or invalid criteria. Please provide a valid criteria object."}), 400
    resp = requests.get(CRITERIA_URL, params={"section_id": section_id})
    if resp.status_code == 200 and resp.json()["data"]:
        put_resp = requests.put(CRITERIA_URL + f"?section_id={section_id}", json=criteria_data)
        results["criteria"] = put_resp.json()
    else:
        post_resp = requests.post(CRITERIA_URL, json=criteria_data)
        results["criteria"] = post_resp.json()

    # --- Project Topics ---
    topics = payload.get("topics", [])
    # Delete all topics for this section_id first
    requests.delete(TOPIC_URL, params={"section_id": section_id})
    for topic in topics:
        if "section_id" not in topic:
            topic["section_id"] = section_id
        post_resp = requests.post(TOPIC_URL, json=topic)
        results["topics"].append(safe_json(post_resp))

    # --- Skills ---
    skills = payload.get("skills", [])
    # Delete all skills for this section_id first
    requests.delete(SKILL_URL, params={"section_id": section_id})
    for skill in skills:
        if "section_id" not in skill:
            skill["section_id"] = section_id
        post_resp = requests.post(SKILL_URL, json=skill)
        results["skills"].append(safe_json(post_resp))

    return jsonify(results), 200

@app.route("/", methods=["GET"])
def aggregate_get():
    section_id = request.args.get("section_id")
    if not section_id:
        return jsonify({"error": "Missing section_id in query params"}), 400

    # --- Criteria ---
    crit_resp = requests.get(CRITERIA_URL, params={"section_id": section_id})
    crit_data = None
    course_id = None
    if crit_resp.status_code == 200:
        crit_json = crit_resp.json()
        if crit_json.get("data"):
            crit_data = crit_json["data"][0] if isinstance(crit_json["data"], list) and crit_json["data"] else crit_json["data"]
            course_id = crit_data.get("course_id")
            crit_data.pop("course_id", None)
            crit_data.pop("section_id", None)

    # --- Topics ---
    topic_resp = requests.get(TOPIC_URL, params={"section_id": section_id})
    topics = []
    if topic_resp.status_code == 200:
        topic_json = topic_resp.json()
        for t in topic_json.get("data", []):
            topics.append({"topic_label": t.get("topic_label")})

    # --- Skills ---
    skill_resp = requests.get(SKILL_URL, params={"section_id": section_id})
    skills = []
    if skill_resp.status_code == 200:
        skill_json = skill_resp.json()
        for s in skill_json.get("data", []):
            skills.append({
                "skill_label": s.get("skill_label"),
                "skill_importance": s.get("skill_importance")
            })

    result = {
        "course_id": course_id,
        "section_id": section_id,
        "criteria": crit_data,
        "topics": topics,
        "skills": skills
    }
    return jsonify(result), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 4000)), debug=True)

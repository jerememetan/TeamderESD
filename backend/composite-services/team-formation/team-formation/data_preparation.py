from __future__ import annotations

from typing import Any, Dict, Optional

from config_interpreter import safe_float, safe_int
from solver_models import Pair, PreparedData, SolverConfig, StudentRecord


def normalize_mbti(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = value.strip().upper()
    return text if len(text) == 4 else None


def pair_key(i: int, j: int) -> Pair:
    return (i, j) if i < j else (j, i)


def collect_topic_rank_map(topic_preferences: Any) -> Dict[str, int]:
    if not isinstance(topic_preferences, list):
        return {}
    ranks: Dict[str, int] = {}
    for index, topic_id in enumerate(topic_preferences):
        if isinstance(topic_id, str) and topic_id not in ranks:
            ranks[topic_id] = index + 1
    return ranks


def prepare_data(
    formation_config: Dict[str, Any],
    student_profile: Dict[str, Any],
    config: SolverConfig,
    diagnostics: Dict[str, list[str]],
) -> PreparedData:
    students_payload = student_profile.get("data", {}).get("students")
    if not isinstance(students_payload, list):
        diagnostics["errors"].append("student_profile.data.students must be a list.")
        students_payload = []

    section_from_profile = student_profile.get("data", {}).get("section_id")
    if not isinstance(section_from_profile, str):
        section_from_profile = None

    section_id = config.section_id if config.section_id is not None else section_from_profile
    if (
        config.section_id is not None
        and section_from_profile is not None
        and config.section_id != section_from_profile
    ):
        diagnostics["errors"].append(
            "section_id mismatch between formation_config and student_profile."
        )

    parsed_students: list[StudentRecord] = []
    student_id_set = set()
    student_skill_ids = set()

    for row in students_payload:
        if not isinstance(row, dict):
            diagnostics["warnings"].append("Skipped malformed student row (not an object).")
            continue

        student_id = safe_int(row.get("student_id"))
        profile = row.get("profile", {})
        if student_id is None:
            diagnostics["warnings"].append("Skipped student row with non-integer student_id.")
            continue
        if student_id in student_id_set:
            diagnostics["errors"].append(f"Duplicate student_id found: {student_id}")
            continue
        student_id_set.add(student_id)

        if not isinstance(profile, dict):
            profile = {}

        competences_payload = profile.get("competences")
        competences: Dict[str, float] = {}
        if isinstance(competences_payload, list):
            for comp in competences_payload:
                if not isinstance(comp, dict):
                    continue
                skill_id = comp.get("skill_id")
                skill_level = safe_float(comp.get("skill_level"))
                if not isinstance(skill_id, str) or skill_level is None:
                    continue
                competences[skill_id] = max(skill_level, 0.0)
                student_skill_ids.add(skill_id)

        topic_ranks = collect_topic_rank_map(profile.get("topic_preferences"))
        parsed_students.append(
            StudentRecord(
                student_id=student_id,
                buddy_id=safe_int(profile.get("buddy_id")),
                gender=profile.get("gender") if isinstance(profile.get("gender"), str) else None,
                gpa=safe_float(profile.get("gpa")),
                mbti=normalize_mbti(profile.get("mbti")),
                reputation=safe_float(profile.get("reputation_score")),
                school_id=safe_int(profile.get("school_id")),
                year=safe_int(profile.get("year")),
                competences=competences,
                topic_ranks=topic_ranks,
            )
        )

    student_count = len(parsed_students)
    if student_count == 0:
        diagnostics["errors"].append("No valid students found in student_profile.")
    if config.num_groups < 1:
        diagnostics["errors"].append("criteria.num_groups must be >= 1.")
    if student_count > 0 and config.num_groups > student_count:
        diagnostics["errors"].append("criteria.num_groups cannot be greater than number of students.")

    skills_payload = formation_config.get("skills")
    if not isinstance(skills_payload, list):
        skills_payload = []
        diagnostics["warnings"].append(
            "formation_config.skills is missing or invalid; skipping skill criterion."
        )

    filtered_skills: list[Dict[str, Any]] = []
    for entry in skills_payload:
        if not isinstance(entry, dict):
            continue
        skill_id = entry.get("skill_id")
        if not isinstance(skill_id, str):
            diagnostics["warnings"].append("Skipped skill without skill_id.")
            continue
        if skill_id not in student_skill_ids:
            diagnostics["warnings"].append(
                f"Skipped unknown skill_id (not in student profiles): {skill_id}"
            )
            continue
        importance = safe_float(entry.get("skill_importance", 1.0))
        if importance is None:
            diagnostics["warnings"].append(
                f"Invalid skill_importance for {skill_id}; defaulted to 1.0."
            )
            importance = 1.0
        filtered_skills.append(
            {
                "skill_id": skill_id,
                "skill_label": entry.get("skill_label"),
                "skill_importance": max(importance, 0.0),
            }
        )

    topics_payload = formation_config.get("topics")
    if not isinstance(topics_payload, list):
        topics_payload = []
        diagnostics["warnings"].append(
            "formation_config.topics is missing or invalid; skipping topic criterion."
        )

    filtered_topics: list[Dict[str, Any]] = []
    for entry in topics_payload:
        if not isinstance(entry, dict):
            continue
        topic_id = entry.get("topic_id")
        if not isinstance(topic_id, str):
            diagnostics["warnings"].append("Skipped topic without topic_id.")
            continue
        filtered_topics.append({"topic_id": topic_id, "topic_label": entry.get("topic_label")})

    student_index_by_id = {student.student_id: index for index, student in enumerate(parsed_students)}
    buddy_pairs: Dict[Pair, int] = {}
    for left_index, student in enumerate(parsed_students):
        buddy_id = student.buddy_id
        if buddy_id is None:
            continue
        right_index = student_index_by_id.get(buddy_id)
        if right_index is None:
            diagnostics["warnings"].append(
                f"Student {student.student_id} has buddy_id {buddy_id} not in section; skipped."
            )
            continue
        if right_index == left_index:
            diagnostics["warnings"].append(
                f"Student {student.student_id} has self buddy_id; skipped."
            )
            continue
        pair = pair_key(left_index, right_index)
        buddy_pairs[pair] = buddy_pairs.get(pair, 0) + 1

    return PreparedData(
        section_id=section_id,
        num_groups=config.num_groups,
        students=parsed_students,
        skills=filtered_skills,
        topics=filtered_topics,
        buddy_pairs=buddy_pairs,
        diagnostics=diagnostics,
    )

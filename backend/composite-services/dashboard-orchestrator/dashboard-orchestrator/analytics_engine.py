"""
Analytics computation engine.

Pure functions that take team + student data and return metrics.
No I/O, no Flask, no external calls — just maths.
"""

from collections import Counter

import numpy as np


def _safe_std(values):
    """Standard deviation, 0.0 for length <= 1."""
    if len(values) <= 1:
        return 0.0
    return float(np.std(values, ddof=1))


def _distribution(items):
    """Return {value: count} dict."""
    return dict(Counter(items))


def _balance_score(distributions):
    """
    Given a list of Counter-style dicts (one per team), compute how
    evenly a categorical variable is spread. Returns 0-1 where 1 = perfect.
    Uses coefficient of variation of category proportions across teams.
    """
    if not distributions:
        return 1.0

    all_keys = set()
    for distribution in distributions:
        all_keys.update(distribution.keys())
    if not all_keys:
        return 1.0

    proportion_stds = []
    for key in all_keys:
        proportions = []
        for distribution in distributions:
            total = sum(distribution.values()) or 1
            proportions.append(distribution.get(key, 0) / total)
        proportion_stds.append(_safe_std(proportions))

    avg_std = float(np.mean(proportion_stds)) if proportion_stds else 0.0
    return round(max(0.0, 1.0 - avg_std * 2), 4)


def compute_team_metrics(team, student_lookup, skill_definitions):
    """
    Compute all metrics for a single team.

    Parameters
    ----------
    team : dict with team_id, team_number, students[{student_id}]
    student_lookup : dict student_id -> profile dict
    skill_definitions : list of {skill_id, skill_label, skill_importance}

    Returns dict of metrics.
    """
    student_ids = [student["student_id"] for student in team.get("students", [])]
    profiles = [student_lookup[student_id] for student_id in student_ids if student_id in student_lookup]

    if not profiles:
        return _empty_team_metrics(team)

    gpas = [profile["gpa"] for profile in profiles if profile.get("gpa") is not None]
    gpa_metrics = {
        "mean": round(float(np.mean(gpas)), 4) if gpas else None,
        "min": round(float(min(gpas)), 4) if gpas else None,
        "max": round(float(max(gpas)), 4) if gpas else None,
        "std": round(_safe_std(gpas), 4) if gpas else None,
    }

    years = [profile["year"] for profile in profiles if profile.get("year") is not None]
    year_dist = _distribution(years)

    schools = [
        profile.get("school") or profile.get("school_id")
        for profile in profiles
        if profile.get("school") is not None or profile.get("school_id") is not None
    ]
    school_dist = _distribution(schools)

    genders = [profile["gender"] for profile in profiles if profile.get("gender") is not None]
    gender_dist = _distribution(genders)

    mbtis = [profile["mbti"] for profile in profiles if profile.get("mbti") is not None]
    mbti_dist = _distribution(mbtis)

    reps = [profile["reputation_score"] for profile in profiles if profile.get("reputation_score") is not None]
    reputation_metrics = {
        "mean": round(float(np.mean(reps)), 4) if reps else None,
        "min": int(min(reps)) if reps else None,
        "max": int(max(reps)) if reps else None,
        "std": round(_safe_std(reps), 4) if reps else None,
    }

    skill_balance = []
    for skill_def in (skill_definitions or []):
        skill_id = skill_def["skill_id"]
        levels = []
        for profile in profiles:
            for competence in profile.get("competences") or []:
                if competence.get("skill_id") == skill_id:
                    levels.append(competence["skill_level"])
        skill_balance.append(
            {
                "skill_id": skill_id,
                "skill_label": skill_def.get("skill_label", skill_id),
                "skill_importance": skill_def.get("skill_importance"),
                "avg_level": round(float(np.mean(levels)), 4) if levels else None,
                "min_level": int(min(levels)) if levels else None,
                "max_level": int(max(levels)) if levels else None,
                "coverage": len(levels),
            }
        )

    top_prefs = []
    for profile in profiles:
        prefs = profile.get("topic_preferences") or []
        if prefs:
            top_prefs.append(prefs[0])
    top_pref_dist = _distribution(top_prefs)
    most_common_count = max(top_pref_dist.values()) if top_pref_dist else 0
    topic_alignment = {
        "top_preference_distribution": top_pref_dist,
        "max_shared_top_preference": most_common_count,
        "alignment_ratio": round(most_common_count / len(profiles), 4) if profiles else 0,
    }

    sid_set = set(student_ids)
    buddy_requests = 0
    buddy_satisfied = 0
    for profile in profiles:
        buddy_id = profile.get("buddy_id")
        if buddy_id is not None:
            buddy_requests += 1
            if buddy_id in sid_set:
                buddy_satisfied += 1
    buddy_metrics = {
        "requests": buddy_requests,
        "satisfied": buddy_satisfied,
        "rate": round(buddy_satisfied / buddy_requests, 4) if buddy_requests else None,
    }

    return {
        "team_id": team["team_id"],
        "team_number": team.get("team_number"),
        "size": len(profiles),
        "gpa": gpa_metrics,
        "year_distribution": year_dist,
        "school_distribution": school_dist,
        "gender_distribution": gender_dist,
        "mbti_distribution": mbti_dist,
        "reputation": reputation_metrics,
        "skill_balance": skill_balance,
        "topic_alignment": topic_alignment,
        "buddy_satisfaction": buddy_metrics,
    }


def _empty_team_metrics(team):
    return {
        "team_id": team["team_id"],
        "team_number": team.get("team_number"),
        "size": 0,
        "gpa": {"mean": None, "min": None, "max": None, "std": None},
        "year_distribution": {},
        "school_distribution": {},
        "gender_distribution": {},
        "mbti_distribution": {},
        "reputation": {"mean": None, "min": None, "max": None, "std": None},
        "skill_balance": [],
        "topic_alignment": {"top_preference_distribution": {}, "max_shared_top_preference": 0, "alignment_ratio": 0},
        "buddy_satisfaction": {"requests": 0, "satisfied": 0, "rate": None},
    }


def compute_section_metrics(team_metrics_list):
    """
    Compute cross-team (section-wide) summary metrics.

    Parameters
    ----------
    team_metrics_list : list of per-team metric dicts (output of compute_team_metrics)
    """
    if not team_metrics_list:
        return _empty_section_metrics()

    team_gpa_means = [team["gpa"]["mean"] for team in team_metrics_list if team["gpa"]["mean"] is not None]
    gpa_cross_team = {
        "team_means": team_gpa_means,
        "std_of_means": round(_safe_std(team_gpa_means), 4) if team_gpa_means else None,
        "range": round(max(team_gpa_means) - min(team_gpa_means), 4) if team_gpa_means else None,
    }

    team_rep_means = [team["reputation"]["mean"] for team in team_metrics_list if team["reputation"]["mean"] is not None]
    reputation_cross_team = {
        "team_means": team_rep_means,
        "std_of_means": round(_safe_std(team_rep_means), 4) if team_rep_means else None,
        "range": round(max(team_rep_means) - min(team_rep_means), 4) if team_rep_means else None,
    }

    year_dists = [team["year_distribution"] for team in team_metrics_list]
    school_dists = [team["school_distribution"] for team in team_metrics_list]
    gender_dists = [team["gender_distribution"] for team in team_metrics_list]

    skill_fairness = []
    if team_metrics_list and team_metrics_list[0].get("skill_balance"):
        skill_ids = [skill["skill_id"] for skill in team_metrics_list[0]["skill_balance"]]
        for skill_id in skill_ids:
            avg_levels = []
            label = skill_id
            for team_metrics in team_metrics_list:
                for skill in team_metrics["skill_balance"]:
                    if skill["skill_id"] == skill_id:
                        label = skill.get("skill_label", skill_id)
                        if skill["avg_level"] is not None:
                            avg_levels.append(skill["avg_level"])
            skill_fairness.append(
                {
                    "skill_id": skill_id,
                    "skill_label": label,
                    "team_avg_levels": avg_levels,
                    "std_across_teams": round(_safe_std(avg_levels), 4) if avg_levels else None,
                }
            )

    total_requests = sum(team["buddy_satisfaction"]["requests"] for team in team_metrics_list)
    total_satisfied = sum(team["buddy_satisfaction"]["satisfied"] for team in team_metrics_list)
    buddy_overall = {
        "total_requests": total_requests,
        "total_satisfied": total_satisfied,
        "rate": round(total_satisfied / total_requests, 4) if total_requests else None,
    }

    sizes = [team["size"] for team in team_metrics_list]

    return {
        "num_teams": len(team_metrics_list),
        "team_sizes": sizes,
        "gpa_fairness": gpa_cross_team,
        "reputation_fairness": reputation_cross_team,
        "year_balance_score": _balance_score(year_dists),
        "school_balance_score": _balance_score(school_dists),
        "gender_balance_score": _balance_score(gender_dists),
        "skill_fairness": skill_fairness,
        "buddy_satisfaction_overall": buddy_overall,
    }


def _empty_section_metrics():
    return {
        "num_teams": 0,
        "team_sizes": [],
        "gpa_fairness": {"team_means": [], "std_of_means": None, "range": None},
        "reputation_fairness": {"team_means": [], "std_of_means": None, "range": None},
        "year_balance_score": None,
        "school_balance_score": None,
        "gender_balance_score": None,
        "skill_fairness": [],
        "buddy_satisfaction_overall": {"total_requests": 0, "total_satisfied": 0, "rate": None},
    }
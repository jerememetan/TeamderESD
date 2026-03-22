"""Constraint evaluation for swap feasibility."""
from typing import Dict, List, Optional, Tuple


def evaluate_year_diversity(teams_data: Dict, students_data: Dict, constraints) -> Tuple[bool, Optional[str]]:
    """
    Check if require_year_diversity constraint is satisfied.
    Evaluates if each team has sufficient year diversity.
    
    For now, a simple heuristic: if require_year_diversity is True,
    each team should have at least 2 different year levels represented.
    Returns (feasible, reason).
    """
    if not constraints.get("require_year_diversity", False):
        return True, None

    for team_id, student_ids in teams_data.items():
        years = set()
        for sid in student_ids:
            if sid in students_data:
                years.add(students_data[sid]["year"])
        if len(years) < 2:
            return False, f"Team {team_id} lacks year diversity (only {len(years)} year level(s))"

    return True, None


def evaluate_gender_balance(teams_data: Dict, students_data: Dict, class_baseline: Dict = None) -> Tuple[bool, Optional[str]]:
    """
    Check if gender ratios per team are within tolerance of class baseline.
    For now, tolerance = reasonable deviation (e.g., within ±20% of baseline if baseline known).
    Returns (feasible, reason).
    """
    gender_tolerance = 0.2  # Allow ±20% deviation from class baseline

    if not class_baseline:
        # If no baseline provided, just check team doesn't have extreme ratios.
        for team_id, student_ids in teams_data.items():
            genders = {}
            for sid in student_ids:
                if sid in students_data:
                    g = students_data[sid]["gender"]
                    genders[g] = genders.get(g, 0) + 1
            if len(student_ids) > 0:
                max_ratio = max(genders.values()) / len(student_ids)
                if max_ratio > 0.8:  # Arbitrary: if one gender is >80% of team, flag as imbalanced
                    return False, f"Team {team_id} has gender imbalance (max ratio {max_ratio:.2f})"
        return True, None

    # If baseline is provided, compare team ratios to it.
    for team_id, student_ids in teams_data.items():
        genders = {}
        for sid in student_ids:
            if sid in students_data:
                g = students_data[sid]["gender"]
                genders[g] = genders.get(g, 0) + 1
        team_total = len(student_ids)
        if team_total == 0:
            continue

        for gender, baseline_ratio in class_baseline.items():
            expected_count = baseline_ratio * team_total
            actual_count = genders.get(gender, 0)
            if expected_count > 0:
                ratio_deviation = abs(actual_count - expected_count) / expected_count
                if ratio_deviation > gender_tolerance:
                    return False, f"Team {team_id} gender {gender}: expected ~{expected_count:.1f}, got {actual_count}"

    return True, None


def evaluate_skill_imbalance(teams_data: Dict, students_data: Dict, max_imbalance: Optional[float]) -> Tuple[bool, Optional[str]]:
    """
    Check if skill imbalance per team is within max_imbalance tolerance.
    Imbalance = max_skill_level - min_skill_level per skill across team members.
    Returns (feasible, reason).
    """
    if max_imbalance is None:
        return True, None

    for team_id, student_ids in teams_data.items():
        # Collect skill levels per skill across team members.
        skill_levels: Dict[str, List[float]] = {}
        for sid in student_ids:
            if sid in students_data:
                skills = students_data[sid].get("skills", {})
                for skill_id, level in skills.items():
                    if skill_id not in skill_levels:
                        skill_levels[skill_id] = []
                    skill_levels[skill_id].append(level)

        # Check each skill for imbalance.
        for skill_id, levels in skill_levels.items():
            if len(levels) > 1:
                imbalance = max(levels) - min(levels)
                if imbalance > max_imbalance:
                    return False, f"Team {team_id} skill {skill_id}: imbalance {imbalance:.2f} exceeds {max_imbalance}"

    return True, None


def evaluate_min_gpa(teams_data: Dict, students_data: Dict, min_gpa: Optional[float]) -> Tuple[bool, Optional[str]]:
    """
    Check if average GPA per team meets minimum threshold.
    Returns (feasible, reason).
    """
    if min_gpa is None:
        return True, None

    for team_id, student_ids in teams_data.items():
        gpas = []
        for sid in student_ids:
            if sid in students_data:
                gpa = students_data[sid].get("gpa")
                if gpa is not None:
                    gpas.append(gpa)

        if len(gpas) > 0:
            avg_gpa = sum(gpas) / len(gpas)
            if avg_gpa < min_gpa:
                return False, f"Team {team_id}: avg GPA {avg_gpa:.2f} below minimum {min_gpa}"

    return True, None


def check_all_constraints(teams_data: Dict, students_data: Dict, constraints) -> Tuple[bool, Optional[str]]:
    """Check all constraints. Returns (feasible, reason_if_violated)."""
    checks = [
        evaluate_year_diversity(teams_data, students_data, constraints),
        evaluate_gender_balance(teams_data, students_data),
        evaluate_skill_imbalance(teams_data, students_data, constraints.get("max_skill_imbalance")),
        evaluate_min_gpa(teams_data, students_data, constraints.get("min_team_avg_gpa")),
    ]

    for feasible, reason in checks:
        if not feasible:
            return False, reason

    return True, None

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

from ortools.sat.python import cp_model

from config_interpreter import CRITERION_SCALE, IMPORTANCE_SCALE, EPSILON, scaled_int
from solver_models import Pair, PreparedData, SolverConfig, StudentRecord


@dataclass
class DeterministicBuildResult:
    expression: cp_model.LinearExpr
    has_terms: bool
    abs_bound: int
    criterion_meta: Dict[str, Dict[str, Any]]


def _criterion_scale_from_bound(bound_raw: int) -> int:
    if bound_raw <= 0:
        return 0
    return max(1, int(round(CRITERION_SCALE / bound_raw)))


def build_assignment_and_pair_vars(
    model: cp_model.CpModel,
    student_count: int,
    num_groups: int,
) -> Tuple[
    Dict[Tuple[int, int], cp_model.IntVar],
    Dict[int, cp_model.IntVar],
    Dict[Pair, cp_model.IntVar],
    int,
    int,
]:

    print(f"[LOG] Initializing assignment and team size variables for {student_count} students and {num_groups} groups.")
    team_size_lower = student_count // num_groups
    team_size_upper = team_size_lower + (1 if student_count % num_groups else 0)


    assignment: Dict[Tuple[int, int], cp_model.IntVar] = {}
    for student_index in range(student_count):
        for team_index in range(num_groups):
            assignment[(student_index, team_index)] = model.NewBoolVar(
                f"x_s{student_index}_g{team_index}"
            )


    print(f"[LOG] Created assignment variables. Now creating team size variables.")
    team_sizes: Dict[int, cp_model.IntVar] = {}
    for team_index in range(num_groups):
        team_sizes[team_index] = model.NewIntVar(
            team_size_lower,
            team_size_upper,
            f"team_size_{team_index}",
        )


    print(f"[LOG] Created team size variables. Adding assignment constraints.")
    for student_index in range(student_count):
        model.Add(
            sum(assignment[(student_index, team_index)] for team_index in range(num_groups))
            == 1
        )


    print(f"[LOG] Added assignment constraints. Adding team size constraints.")
    for team_index in range(num_groups):
        model.Add(
            sum(assignment[(student_index, team_index)] for student_index in range(student_count))
            == team_sizes[team_index]
        )


    print(f"[LOG] Finished building assignment and team size variables and constraints.")
    same_team: Dict[Pair, cp_model.IntVar] = {}
    return assignment, team_sizes, same_team, team_size_lower, team_size_upper


def add_group_symmetry_breaking(
    model: cp_model.CpModel,
    assignment: Dict[Tuple[int, int], cp_model.IntVar],
    team_sizes: Dict[int, cp_model.IntVar],
    student_count: int,
    num_groups: int,
) -> None:
    if num_groups <= 1 or student_count <= 1:
        return

    max_signature = student_count * (student_count + 1) // 2
    signatures: List[cp_model.IntVar] = []
    for g in range(num_groups):
        sig_var = model.NewIntVar(0, max_signature, f"team_sig_{g}")
        model.Add(sig_var == sum((s + 1) * assignment[(s, g)] for s in range(student_count)))
        signatures.append(sig_var)

    for g in range(num_groups - 1):
        # Canonicalize label-equivalent solutions:
        # first by team size, then by member-index signature.
        model.Add(team_sizes[g] <= team_sizes[g + 1])
        equal_size = model.NewBoolVar(f"team_size_eq_{g}_{g + 1}")
        model.Add(team_sizes[g] == team_sizes[g + 1]).OnlyEnforceIf(equal_size)
        model.Add(team_sizes[g] != team_sizes[g + 1]).OnlyEnforceIf(equal_size.Not())
        model.Add(signatures[g] <= signatures[g + 1]).OnlyEnforceIf(equal_size)


def _normalize_pair_coefficients(raw_metric_by_pair: Dict[Pair, int]) -> Dict[Pair, int]:
    total_raw = sum(value for value in raw_metric_by_pair.values() if value > 0)
    if total_raw <= 0:
        return {}
    normalized: Dict[Pair, int] = {}
    for pair, value in raw_metric_by_pair.items():
        if value <= 0:
            continue
        coeff = int(round((CRITERION_SCALE * value) / total_raw))
        if coeff > 0:
            normalized[pair] = coeff
    return normalized


def _numeric_bucket_map(values: Iterable[Optional[float]], bucket_count: int = 3) -> Dict[int, int]:
    present = sorted(value for value in values if value is not None)
    if len(present) == 0:
        return {}
    if len(present) < bucket_count:
        bucket_count = len(present)
    cut_points = []
    for b in range(1, bucket_count):
        idx = int(round((len(present) - 1) * (b / bucket_count)))
        cut_points.append(present[idx])

    mapping: Dict[int, int] = {}
    for idx, value in enumerate(values):
        if value is None:
            continue
        bucket = 0
        while bucket < len(cut_points) and value > cut_points[bucket] + EPSILON:
            bucket += 1
        mapping[idx] = bucket
    return mapping


def _add_diversity_from_labels(
    model: cp_model.CpModel,
    assignment: Dict[Tuple[int, int], cp_model.IntVar],
    team_sizes: Dict[int, cp_model.IntVar],
    labels: List[Optional[str]],
    num_groups: int,
    team_size_upper: int,
    criterion_name: str,
    weight_int: int,
    criterion_meta: Dict[str, Dict[str, Any]],
    deterministic_terms: List[cp_model.LinearExpr],
) -> int:
    if weight_int == 0:
        criterion_meta[criterion_name] = {"type": "diversity", "weight_int": weight_int, "dev_terms": []}
        return 0

    categories = sorted({label for label in labels if label is not None})
    if len(categories) <= 1:
        criterion_meta[criterion_name] = {"type": "diversity", "weight_int": weight_int, "dev_terms": []}
        return 0

    category_index = {value: idx for idx, value in enumerate(categories)}
    members_by_category: Dict[int, List[int]] = {idx: [] for idx in range(len(categories))}
    for student_index, label in enumerate(labels):
        if label is None:
            continue
        members_by_category[category_index[label]].append(student_index)

    max_imbalance = len(categories) * team_size_upper
    total_dev_bound = num_groups * len(categories) * max_imbalance
    coeff = _criterion_scale_from_bound(total_dev_bound)
    dev_terms = []
    abs_bound = 0

    for g in range(num_groups):
        for cat_idx in range(len(categories)):
            count_var = model.NewIntVar(0, team_size_upper, f"{criterion_name}_count_g{g}_c{cat_idx}")
            model.Add(
                count_var
                == sum(assignment[(s, g)] for s in members_by_category[cat_idx])
            )
            dev_var = model.NewIntVar(0, max_imbalance, f"{criterion_name}_dev_g{g}_c{cat_idx}")
            model.AddAbsEquality(dev_var, len(categories) * count_var - team_sizes[g])
            dev_terms.append({"coeff": coeff, "dev_var": dev_var, "dev_ub": max_imbalance})
            term_coeff = -weight_int * coeff
            deterministic_terms.append(term_coeff * dev_var)
            abs_bound += abs(term_coeff) * max_imbalance

    criterion_meta[criterion_name] = {
        "type": "diversity",
        "weight_int": weight_int,
        "dev_terms": dev_terms,
    }
    return abs_bound


def _add_diversity_from_buckets(
    model: cp_model.CpModel,
    assignment: Dict[Tuple[int, int], cp_model.IntVar],
    team_sizes: Dict[int, cp_model.IntVar],
    bucket_map: Dict[int, int],
    bucket_count: int,
    num_groups: int,
    team_size_upper: int,
    criterion_name: str,
    weight_int: int,
    criterion_meta: Dict[str, Dict[str, Any]],
    deterministic_terms: List[cp_model.LinearExpr],
) -> int:
    if weight_int == 0:
        criterion_meta[criterion_name] = {"type": "diversity", "weight_int": weight_int, "dev_terms": []}
        return 0

    if len(bucket_map) == 0 or bucket_count <= 1:
        criterion_meta[criterion_name] = {"type": "diversity", "weight_int": weight_int, "dev_terms": []}
        return 0

    members_by_bucket: Dict[int, List[int]] = {bucket: [] for bucket in range(bucket_count)}
    for student_index, bucket in bucket_map.items():
        members_by_bucket[bucket].append(student_index)

    max_imbalance = bucket_count * team_size_upper
    total_dev_bound = num_groups * bucket_count * max_imbalance
    coeff = _criterion_scale_from_bound(total_dev_bound)
    dev_terms = []
    abs_bound = 0

    for g in range(num_groups):
        for b in range(bucket_count):
            count_var = model.NewIntVar(0, team_size_upper, f"{criterion_name}_count_g{g}_b{b}")
            model.Add(count_var == sum(assignment[(s, g)] for s in members_by_bucket[b]))
            dev_var = model.NewIntVar(0, max_imbalance, f"{criterion_name}_dev_g{g}_b{b}")
            model.AddAbsEquality(dev_var, bucket_count * count_var - team_sizes[g])
            dev_terms.append({"coeff": coeff, "dev_var": dev_var, "dev_ub": max_imbalance})
            term_coeff = -weight_int * coeff
            deterministic_terms.append(term_coeff * dev_var)
            abs_bound += abs(term_coeff) * max_imbalance

    criterion_meta[criterion_name] = {
        "type": "diversity",
        "weight_int": weight_int,
        "dev_terms": dev_terms,
    }
    return abs_bound


def _add_mbti_diversity(
    model: cp_model.CpModel,
    assignment: Dict[Tuple[int, int], cp_model.IntVar],
    team_sizes: Dict[int, cp_model.IntVar],
    students: List[StudentRecord],
    num_groups: int,
    team_size_upper: int,
    weight_int: int,
    criterion_meta: Dict[str, Dict[str, Any]],
    deterministic_terms: List[cp_model.LinearExpr],
) -> int:
    if weight_int == 0:
        criterion_meta["mbti"] = {"type": "diversity", "weight_int": weight_int, "dev_terms": []}
        return 0

    position_letters = [("I", "E"), ("N", "S"), ("T", "F"), ("J", "P")]
    members_by_pos_letter: Dict[Tuple[int, str], List[int]] = {}
    for pos, (left, _) in enumerate(position_letters):
        members_by_pos_letter[(pos, left)] = []
        for student_idx, student in enumerate(students):
            if student.mbti is None:
                continue
            if student.mbti[pos] == left:
                members_by_pos_letter[(pos, left)].append(student_idx)

    max_imbalance = 2 * team_size_upper
    total_dev_bound = num_groups * 4 * max_imbalance
    coeff = _criterion_scale_from_bound(total_dev_bound)
    dev_terms = []
    abs_bound = 0

    for g in range(num_groups):
        for pos, (left, _) in enumerate(position_letters):
            count_left = model.NewIntVar(0, team_size_upper, f"mbti_count_g{g}_p{pos}_{left}")
            model.Add(count_left == sum(assignment[(s, g)] for s in members_by_pos_letter[(pos, left)]))
            dev_var = model.NewIntVar(0, max_imbalance, f"mbti_dev_g{g}_p{pos}")
            model.AddAbsEquality(dev_var, 2 * count_left - team_sizes[g])
            dev_terms.append({"coeff": coeff, "dev_var": dev_var, "dev_ub": max_imbalance})
            term_coeff = -weight_int * coeff
            deterministic_terms.append(term_coeff * dev_var)
            abs_bound += abs(term_coeff) * max_imbalance

    criterion_meta["mbti"] = {"type": "diversity", "weight_int": weight_int, "dev_terms": dev_terms}
    return abs_bound


def _add_topics_concentration(
    model: cp_model.CpModel,
    assignment: Dict[Tuple[int, int], cp_model.IntVar],
    prepared: PreparedData,
    students: List[StudentRecord],
    num_groups: int,
    team_size_upper: int,
    weight_int: int,
    criterion_meta: Dict[str, Dict[str, Any]],
    deterministic_terms: List[cp_model.LinearExpr],
) -> int:
    if weight_int == 0:
        criterion_meta["topics"] = {
            "type": "concentration",
            "weight_int": weight_int,
            "conc_terms": [],
            "team_total_point_terms": [],
            "num_topics": 0,
        }
        return 0

    topic_ids = [entry["topic_id"] for entry in prepared.topics]
    if len(topic_ids) == 0:
        criterion_meta["topics"] = {
            "type": "concentration",
            "weight_int": weight_int,
            "conc_terms": [],
            "team_total_point_terms": [],
            "num_topics": 0,
        }
        return 0

    topic_index = {topic_id: idx for idx, topic_id in enumerate(topic_ids)}
    num_topics = len(topic_ids)

    points_by_student_topic: Dict[Tuple[int, int], int] = {}
    max_points_per_student = 0
    point_vectors = set()
    topic_total_points = [0 for _ in range(num_topics)]
    for student_idx, student in enumerate(students):
        total_points = 0
        vector = [0] * num_topics
        for topic_id, rank in student.topic_ranks.items():
            if topic_id not in topic_index:
                continue
            points = max(num_topics - (rank - 1), 0)
            points_by_student_topic[(student_idx, topic_index[topic_id])] = points
            vector[topic_index[topic_id]] = points
            topic_total_points[topic_index[topic_id]] += points
            total_points += points
        max_points_per_student = max(max_points_per_student, total_points)
        point_vectors.add(tuple(vector))

    if max_points_per_student <= 0:
        criterion_meta["topics"] = {
            "type": "concentration",
            "weight_int": weight_int,
            "conc_terms": [],
            "team_total_point_terms": [],
            "num_topics": num_topics,
        }
        return 0
    if len(point_vectors) <= 1:
        prepared.diagnostics["warnings"].append(
            "Topic preference vectors are uniform; topics criterion was skipped as no-op."
        )
        criterion_meta["topics"] = {
            "type": "concentration",
            "weight_int": weight_int,
            "conc_terms": [],
            "team_total_point_terms": [],
            "num_topics": num_topics,
        }
        return 0

    active_topic_indices = [topic_idx for topic_idx, total in enumerate(topic_total_points) if total > 0]
    active_topic_count = len(active_topic_indices)
    if active_topic_count <= 1:
        prepared.diagnostics["warnings"].append(
            "Topic criterion has <=1 active topic after simplification; skipped as no-op."
        )
        criterion_meta["topics"] = {
            "type": "concentration",
            "weight_int": weight_int,
            "conc_terms": [],
            "team_total_point_terms": [],
            "num_topics": active_topic_count,
        }
        return 0

    team_points_ub = team_size_upper * max_points_per_student
    conc_terms = []
    team_total_terms = []
    abs_bound = 0
    conc_ub = active_topic_count * team_points_ub
    coeff = _criterion_scale_from_bound(num_groups * conc_ub)

    for g in range(num_groups):
        topic_score_vars = []
        for t in active_topic_indices:
            score_var = model.NewIntVar(0, team_points_ub, f"topic_score_g{g}_t{t}")
            model.Add(
                score_var
                == sum(
                    points_by_student_topic.get((s, t), 0) * assignment[(s, g)]
                    for s in range(len(students))
                )
            )
            topic_score_vars.append(score_var)

        max_topic_var = model.NewIntVar(0, team_points_ub, f"topic_max_g{g}")
        for score_var in topic_score_vars:
            model.Add(max_topic_var >= score_var)

        team_total_var = model.NewIntVar(0, team_points_ub, f"topic_total_g{g}")
        model.Add(team_total_var == sum(topic_score_vars))

        conc_var = model.NewIntVar(0, conc_ub, f"topic_conc_g{g}")
        model.Add(conc_var == active_topic_count * max_topic_var - team_total_var)

        conc_terms.append({"coeff": coeff, "conc_var": conc_var, "conc_ub": conc_ub})
        team_total_terms.append({"team_total_var": team_total_var, "num_topics": active_topic_count})

        term_coeff = weight_int * coeff
        deterministic_terms.append(term_coeff * conc_var)
        abs_bound += abs(term_coeff) * conc_ub

    criterion_meta["topics"] = {
        "type": "concentration",
        "weight_int": weight_int,
        "conc_terms": conc_terms,
        "team_total_point_terms": team_total_terms,
        "num_topics": active_topic_count,
    }
    return abs_bound


def _add_skills_balance(
    model: cp_model.CpModel,
    assignment: Dict[Tuple[int, int], cp_model.IntVar],
    prepared: PreparedData,
    students: List[StudentRecord],
    num_groups: int,
    team_size_upper: int,
    weight_int: int,
    criterion_meta: Dict[str, Dict[str, Any]],
    deterministic_terms: List[cp_model.LinearExpr],
) -> int:
    skill_meta: Dict[str, Any] = {"type": "skills", "weight_int": weight_int, "dev_terms": []}
    if weight_int == 0:
        criterion_meta["skills"] = skill_meta
        return 0

    if not prepared.skills:
        prepared.diagnostics["warnings"].append("No valid skills available for skill criterion.")
        criterion_meta["skills"] = skill_meta
        return 0

    max_skill_level = 0
    for student in students:
        if student.competences:
            max_skill_level = max(max_skill_level, int(max(student.competences.values())))
    max_skill_level = max(max_skill_level, 1)

    active_skill_entries = []
    for entry in prepared.skills:
        skill_id = entry["skill_id"]
        values = [student.competences.get(skill_id, 0.0) for student in students]
        if len(values) == 0:
            continue
        max_v = max(values)
        min_v = min(values)
        if max_v <= EPSILON:
            prepared.diagnostics["warnings"].append(
                f"Skipped skill_id {skill_id}: all competence values are zero."
            )
            continue
        if abs(max_v - min_v) <= EPSILON:
            prepared.diagnostics["warnings"].append(
                f"Skipped skill_id {skill_id}: no variance across students."
            )
            continue
        active_skill_entries.append(entry)

    if not active_skill_entries:
        prepared.diagnostics["warnings"].append(
            "No informative skills remain after simplification; skills criterion was skipped."
        )
        criterion_meta["skills"] = skill_meta
        return 0

    skill_ids = [entry["skill_id"] for entry in active_skill_entries]
    skill_importance_int = {
        entry["skill_id"]: max(0, scaled_int(entry["skill_importance"], IMPORTANCE_SCALE))
        for entry in active_skill_entries
    }
    skill_totals = {
        skill_id: int(round(sum(student.competences.get(skill_id, 0.0) for student in students)))
        for skill_id in skill_ids
    }

    max_weighted_imbalance = 0
    skill_specs = []
    for g in range(num_groups):
        for skill_id in skill_ids:
            max_team_skill = team_size_upper * max_skill_level
            dev_ub = max(abs(skill_totals[skill_id]), abs(num_groups * max_team_skill - skill_totals[skill_id]))
            importance = skill_importance_int[skill_id]
            max_weighted_imbalance += importance * dev_ub
            skill_specs.append((g, skill_id, dev_ub, importance))

    if max_weighted_imbalance <= 0:
        prepared.diagnostics["warnings"].append(
            "No non-zero skill imbalance capacity detected; skills criterion is neutral."
        )
        criterion_meta["skills"] = skill_meta
        return 0

    scale = _criterion_scale_from_bound(max_weighted_imbalance)
    abs_bound = 0
    for g, skill_id, dev_ub, importance in skill_specs:
        team_skill_sum = model.NewIntVar(0, team_size_upper * max_skill_level, f"team_skill_sum_g{g}_{skill_id}")
        model.Add(
            team_skill_sum
            == sum(
                int(round(students[s].competences.get(skill_id, 0.0))) * assignment[(s, g)]
                for s in range(len(students))
            )
        )

        dev_var = model.NewIntVar(0, dev_ub, f"skill_dev_g{g}_{skill_id}")
        model.AddAbsEquality(dev_var, num_groups * team_skill_sum - skill_totals[skill_id])

        coeff = int(round(importance * scale))
        if coeff == 0:
            continue

        skill_meta["dev_terms"].append({"coeff": coeff, "dev_var": dev_var, "dev_ub": dev_ub})
        term_coeff = -weight_int * coeff
        deterministic_terms.append(term_coeff * dev_var)
        abs_bound += abs(term_coeff) * dev_ub

    criterion_meta["skills"] = skill_meta
    return abs_bound


def build_deterministic_objective(
    model: cp_model.CpModel,
    prepared: PreparedData,
    config: SolverConfig,
    assignment: Dict[Tuple[int, int], cp_model.IntVar],
    same_team: Dict[Pair, cp_model.IntVar],
    team_size_upper: int,
    team_sizes: Dict[int, cp_model.IntVar],
) -> DeterministicBuildResult:
    _ = same_team
    students = prepared.students
    num_groups = prepared.num_groups


    print(f"[LOG] Building deterministic objective for {len(students)} students and {num_groups} groups.")
    deterministic_terms: List[cp_model.LinearExpr] = []
    abs_bound = 0
    criterion_meta: Dict[str, Dict[str, Any]] = {}


    print(f"[LOG] Adding buddy constraints...")
    buddy_terms = []
    buddy_weight = config.weight_ints["buddy_weight"]
    if buddy_weight != 0:
        buddy_coeff = _normalize_pair_coefficients(prepared.buddy_pairs)
        for (i, j), coeff in buddy_coeff.items():
            same_var = model.NewBoolVar(f"buddy_same_{i}_{j}")
            and_vars = []
            for g in range(num_groups):
                and_var = model.NewBoolVar(f"buddy_and_{i}_{j}_g{g}")
                and_vars.append(and_var)
                model.Add(and_var <= assignment[(i, g)])
                model.Add(and_var <= assignment[(j, g)])
                model.Add(and_var >= assignment[(i, g)] + assignment[(j, g)] - 1)
            model.Add(sum(and_vars) == same_var)

            buddy_terms.append({"coeff": coeff, "same_var": same_var})
            term_coeff = buddy_weight * coeff
            deterministic_terms.append(term_coeff * same_var)
            abs_bound += abs(term_coeff)
    print(f"[LOG] Finished adding buddy constraints.")

    criterion_meta["buddy"] = {
        "type": "buddy",
        "weight_int": buddy_weight,
        "buddy_terms": buddy_terms,
    }


    print(f"[LOG] Adding gender diversity constraints...")
    abs_bound += _add_diversity_from_labels(
        model=model,
        assignment=assignment,
        team_sizes=team_sizes,
        labels=[student.gender for student in students],
        num_groups=num_groups,
        team_size_upper=team_size_upper,
        criterion_name="gender",
        weight_int=config.weight_ints["gender_weight"],
        criterion_meta=criterion_meta,
        deterministic_terms=deterministic_terms,
    )
    print(f"[LOG] Finished adding gender diversity constraints.")


    print(f"[LOG] Adding school diversity constraints...")
    abs_bound += _add_diversity_from_labels(
        model=model,
        assignment=assignment,
        team_sizes=team_sizes,
        labels=[student.school for student in students],
        num_groups=num_groups,
        team_size_upper=team_size_upper,
        criterion_name="school",
        weight_int=config.weight_ints["school_weight"],
        criterion_meta=criterion_meta,
        deterministic_terms=deterministic_terms,
    )
    print(f"[LOG] Finished adding school diversity constraints.")


    print(f"[LOG] Adding year diversity constraints...")
    abs_bound += _add_diversity_from_labels(
        model=model,
        assignment=assignment,
        team_sizes=team_sizes,
        labels=[str(student.year) if student.year is not None else None for student in students],
        num_groups=num_groups,
        team_size_upper=team_size_upper,
        criterion_name="year",
        weight_int=config.weight_ints["year_weight"],
        criterion_meta=criterion_meta,
        deterministic_terms=deterministic_terms,
    )
    print(f"[LOG] Finished adding year diversity constraints.")


    print(f"[LOG] Adding GPA diversity constraints...")
    gpa_bucket_map = _numeric_bucket_map([student.gpa for student in students], bucket_count=3)
    gpa_bucket_count = (max(gpa_bucket_map.values()) + 1) if gpa_bucket_map else 0
    abs_bound += _add_diversity_from_buckets(
        model=model,
        assignment=assignment,
        team_sizes=team_sizes,
        bucket_map=gpa_bucket_map,
        bucket_count=gpa_bucket_count,
        num_groups=num_groups,
        team_size_upper=team_size_upper,
        criterion_name="gpa",
        weight_int=config.weight_ints["gpa_weight"],
        criterion_meta=criterion_meta,
        deterministic_terms=deterministic_terms,
    )
    print(f"[LOG] Finished adding GPA diversity constraints.")


    print(f"[LOG] Adding reputation diversity constraints...")
    rep_bucket_map = _numeric_bucket_map([student.reputation for student in students], bucket_count=3)
    rep_bucket_count = (max(rep_bucket_map.values()) + 1) if rep_bucket_map else 0
    abs_bound += _add_diversity_from_buckets(
        model=model,
        assignment=assignment,
        team_sizes=team_sizes,
        bucket_map=rep_bucket_map,
        bucket_count=rep_bucket_count,
        num_groups=num_groups,
        team_size_upper=team_size_upper,
        criterion_name="reputation",
        weight_int=config.weight_ints["reputation_weight"],
        criterion_meta=criterion_meta,
        deterministic_terms=deterministic_terms,
    )
    print(f"[LOG] Finished adding reputation diversity constraints.")


    print(f"[LOG] Adding MBTI diversity constraints...")
    abs_bound += _add_mbti_diversity(
        model=model,
        assignment=assignment,
        team_sizes=team_sizes,
        students=students,
        num_groups=num_groups,
        team_size_upper=team_size_upper,
        weight_int=config.weight_ints["mbti_weight"],
        criterion_meta=criterion_meta,
        deterministic_terms=deterministic_terms,
    )
    print(f"[LOG] Finished adding MBTI diversity constraints.")


    print(f"[LOG] Adding topic concentration constraints...")
    abs_bound += _add_topics_concentration(
        model=model,
        assignment=assignment,
        prepared=prepared,
        students=students,
        num_groups=num_groups,
        team_size_upper=team_size_upper,
        weight_int=config.weight_ints["topic_weight"],
        criterion_meta=criterion_meta,
        deterministic_terms=deterministic_terms,
    )
    print(f"[LOG] Finished adding topic concentration constraints.")


    print(f"[LOG] Adding skills balance constraints...")
    abs_bound += _add_skills_balance(
        model=model,
        assignment=assignment,
        prepared=prepared,
        students=students,
        num_groups=num_groups,
        team_size_upper=team_size_upper,
        weight_int=config.weight_ints["skill_weight"],
        criterion_meta=criterion_meta,
        deterministic_terms=deterministic_terms,
    )
    print(f"[LOG] Finished adding skills balance constraints.")


    print(f"[LOG] Finished building deterministic objective.")
    expression = sum(deterministic_terms) if deterministic_terms else 0
    return DeterministicBuildResult(
        expression=expression,
        has_terms=bool(deterministic_terms),
        abs_bound=abs_bound,
        criterion_meta=criterion_meta,
    )

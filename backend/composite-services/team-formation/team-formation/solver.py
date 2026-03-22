from __future__ import annotations

import argparse
import json
from typing import Any, Dict, Optional

from ortools.sat.python import cp_model

from config_interpreter import (
    SCORE_DENOMINATOR,
    compute_quality_frontier_drop,
    derive_seed,
    parse_solver_config,
)
from data_preparation import prepare_data
from objective_builder import (
    add_group_symmetry_breaking,
    build_assignment_and_pair_vars,
    build_deterministic_objective,
)
from randomness_engine import build_randomness_objective

SOLVER_SUCCESS_STATUSES = {"OPTIMAL", "FEASIBLE"}
SOLVER_FAILURE_STATUSES = {"INVALID_INPUT", "INFEASIBLE", "MODEL_INVALID", "UNKNOWN"}


def _status_name(status: int) -> str:
    mapping = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN",
    }
    return mapping.get(status, "UNKNOWN")


def _make_solver(seed: int, time_limit_s: float, search_workers: int) -> cp_model.CpSolver:
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(float(time_limit_s), 0.01)
    solver.parameters.num_search_workers = max(1, int(search_workers))
    solver.parameters.random_seed = seed
    return solver


def _invalid_result(
    section_id: Optional[str],
    num_groups: int,
    diagnostics: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "status": "INVALID_INPUT",
        "section_id": section_id,
        "num_groups": num_groups,
        "teams": [],
        "objective": {
            "total_score": 0.0,
            "criteria_scores": {
                "buddy": None,
                "gender": None,
                "gpa": None,
                "mbti": None,
                "reputation": None,
                "school": None,  
                "skills": None,
                "topics": None,
                "year": None,
                "randomness_jitter": None,
            },
        },
        "solver_stats": {},
        "diagnostics": diagnostics,
    }


def _score_criteria(
    criterion_meta: Dict[str, Dict[str, Any]],
    solver: cp_model.CpSolver,
) -> tuple[Dict[str, Any], int]:
    criteria_scores: Dict[str, Any] = {}
    weighted_total_int = 0

    ordered_score_keys = [
        "buddy",
        "gender",
        "gpa",
        "mbti",
        "reputation",
        "school",
        "skills",
        "topics",
        "year",
        "randomness_jitter",
    ]

    for key in ordered_score_keys:
        meta = criterion_meta.get(key)
        if not meta:
            criteria_scores[key] = None
            continue

        criterion_type = meta.get("type")
        weight_int = int(meta.get("weight_int", 0))

        if criterion_type == "buddy":
            buddy_terms = meta.get("buddy_terms", [])
            if not buddy_terms:
                criteria_scores[key] = None
                continue
            raw_int = sum(
                term["coeff"] * int(solver.Value(term["same_var"]))
                for term in buddy_terms
            )
            max_int = sum(term["coeff"] for term in buddy_terms)
            raw_score = (raw_int / max_int) if max_int > 0 else None
            weighted_int = weight_int * raw_int
            weighted_total_int += weighted_int
            criteria_scores[key] = {
                "raw_score": raw_score,
                "weighted_score": weighted_int / SCORE_DENOMINATOR,
            }
            continue

        if criterion_type == "diversity":
            dev_terms = meta.get("dev_terms", [])
            if not dev_terms:
                criteria_scores[key] = None
                continue
            weighted_dev_int = sum(
                term["coeff"] * int(solver.Value(term["dev_var"]))
                for term in dev_terms
            )
            max_dev_int = sum(term["coeff"] * term["dev_ub"] for term in dev_terms)
            raw_score = 1.0 - (weighted_dev_int / max_dev_int) if max_dev_int > 0 else None
            weighted_int = -weight_int * weighted_dev_int
            weighted_total_int += weighted_int
            criteria_scores[key] = {
                "raw_score": raw_score,
                "weighted_score": weighted_int / SCORE_DENOMINATOR,
            }
            continue

        if criterion_type == "concentration":
            conc_terms = meta.get("conc_terms", [])
            team_total_point_terms = meta.get("team_total_point_terms", [])
            num_topics = int(meta.get("num_topics", 0))
            if not conc_terms or not team_total_point_terms or num_topics <= 1:
                criteria_scores[key] = None
                continue
            weighted_conc_int = sum(
                term["coeff"] * int(solver.Value(term["conc_var"]))
                for term in conc_terms
            )
            max_conc_int = 0
            for t in team_total_point_terms:
                team_total = int(solver.Value(t["team_total_var"]))
                max_conc_int += max((num_topics - 1) * team_total, 0)
            # coeff already uniform for all conc terms in this criterion.
            coeff = int(conc_terms[0]["coeff"]) if conc_terms else 1
            denom = max(coeff * max_conc_int, 1)
            raw_score = weighted_conc_int / denom
            weighted_int = weight_int * weighted_conc_int
            weighted_total_int += weighted_int
            criteria_scores[key] = {
                "raw_score": raw_score,
                "weighted_score": weighted_int / SCORE_DENOMINATOR,
            }
            continue

        if criterion_type == "skills":
            dev_terms = meta.get("dev_terms", [])
            if not dev_terms:
                criteria_scores[key] = None
                continue
            weighted_imbalance_int = sum(
                term["coeff"] * int(solver.Value(term["dev_var"])) for term in dev_terms
            )
            max_imbalance_int = sum(term["coeff"] * term["dev_ub"] for term in dev_terms)
            raw_balance_score = (
                1.0 - (weighted_imbalance_int / max_imbalance_int)
                if max_imbalance_int > 0
                else None
            )
            weighted_int = -weight_int * weighted_imbalance_int
            weighted_total_int += weighted_int
            criteria_scores[key] = {
                "raw_score": raw_balance_score,
                "weighted_score": weighted_int / SCORE_DENOMINATOR,
            }
            continue

        if criterion_type == "assignment_jitter":
            jitter_terms = meta.get("terms", [])
            if not jitter_terms:
                criteria_scores[key] = None
                continue
            raw_int = sum(
                term["coeff"] * int(solver.Value(term["var"]))
                for term in jitter_terms
            )
            max_abs = sum(abs(term["coeff"]) for term in jitter_terms)
            raw_score = (raw_int / max_abs) if max_abs > 0 else None
            weighted_int = weight_int * raw_int
            weighted_total_int += weighted_int
            criteria_scores[key] = {
                "raw_score": raw_score,
                "weighted_score": weighted_int / SCORE_DENOMINATOR,
            }
            continue

        criteria_scores[key] = None

    return criteria_scores, weighted_total_int


def solve_teams(
    formation_config: Dict[str, Any],
    student_profile: Dict[str, Any],
    seed: Optional[int] = None,
    time_limit_s: float = 10.0,
) -> Dict[str, Any]:
    diagnostics: Dict[str, list[str]] = {"warnings": [], "errors": []}


    print("[LOG] Parsing solver config...")
    config = parse_solver_config(formation_config, diagnostics)
    print("[LOG] Preparing data...")
    prepared = prepare_data(formation_config, student_profile, config, diagnostics)
    diagnostics = prepared.diagnostics

    if diagnostics["errors"]:
        return _invalid_result(prepared.section_id, prepared.num_groups, diagnostics)

    students = prepared.students
    num_students = len(students)
    num_groups = prepared.num_groups
    section_id = prepared.section_id
    derived_seed = derive_seed(seed, section_id)
    search_workers = config.search_workers


    print("[LOG] Creating CP-SAT model...")
    model = cp_model.CpModel()
    print("[LOG] Building assignment and pair variables...")
    assignment, team_sizes, same_team, team_size_lower, team_size_upper = build_assignment_and_pair_vars(
        model=model,
        student_count=num_students,
        num_groups=num_groups,
    )
    print("[LOG] Adding group symmetry breaking constraints...")
    add_group_symmetry_breaking(
        model=model,
        assignment=assignment,
        team_sizes=team_sizes,
        student_count=num_students,
        num_groups=num_groups,
    )

    print("[LOG] Building deterministic objective...")
    deterministic = build_deterministic_objective(
        model=model,
        prepared=prepared,
        config=config,
        assignment=assignment,
        same_team=same_team,
        team_size_upper=team_size_upper,
        team_sizes=team_sizes,
    )

    print("[LOG] Building randomness objective...")
    randomness = build_randomness_objective(
        assignment=assignment,
        randomness_int=config.randomness_int,
        derived_seed=derived_seed,
        student_count=num_students,
        num_groups=num_groups,
    )
    deterministic.criterion_meta["randomness_jitter"] = randomness.criterion_meta

    phase1_det_score = 0
    phase2_det_score = 0
    allowed_drop = 0
    phase2_status_name = "NOT_RUN"
    phase2_fallback_used = False
    final_solver: Optional[cp_model.CpSolver] = None
    final_status = cp_model.UNKNOWN
    final_objective_value = 0.0
    phase1_solver: Optional[cp_model.CpSolver] = None
    phase1_status = cp_model.UNKNOWN
    phase1_assignment_hint: Dict[tuple[int, int], int] = {}

    configured_time_limit = config.max_time_s if config.max_time_s is not None else time_limit_s
    time_limit_s = max(float(configured_time_limit), 0.05)
    randomness_active = config.randomness > 0 and randomness.has_terms
    if deterministic.has_terms and randomness_active:
        phase1_time = max(0.05, time_limit_s * (1.0 - config.phase2_ratio))
        phase2_time = max(0.05, time_limit_s - phase1_time)
    elif randomness_active:
        phase1_time = 0.0
        phase2_time = time_limit_s
    else:
        phase1_time = time_limit_s
        phase2_time = 0.0


    if deterministic.has_terms:
        print("[LOG] Starting phase 1 deterministic solve...")
        model.Maximize(deterministic.expression)
        solver_phase1 = _make_solver(
            seed=derived_seed,
            time_limit_s=phase1_time,
            search_workers=search_workers,
        )
        status_phase1 = solver_phase1.Solve(model)
        print(f"[LOG] Phase 1 solve status: {_status_name(status_phase1)}. Wall time: {solver_phase1.WallTime():.2f}s")
        phase1_solver = solver_phase1
        phase1_status = status_phase1
        if status_phase1 not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            print("[LOG] Phase 1 did not find a feasible solution.")
            return {
                "status": _status_name(status_phase1),
                "section_id": section_id,
                "num_groups": num_groups,
                "teams": [],
                "objective": {
                    "total_score": 0.0,
                    "criteria_scores": {
                        "buddy": None,
                        "gender": None,
                        "gpa": None,
                        "mbti": None,
                        "reputation": None,
                        "school": None,
                        "skills": None,
                        "topics": None,
                        "year": None,
                        "randomness_jitter": None,
                    },
                },
                "solver_stats": {
                    "wall_time_s": solver_phase1.WallTime(),
                    "num_conflicts": solver_phase1.NumConflicts(),
                    "num_branches": solver_phase1.NumBranches(),
                    "best_objective_bound": solver_phase1.BestObjectiveBound(),
                    "search_workers": search_workers,
                },
                "diagnostics": {
                    **diagnostics,
                    "seed_used": derived_seed,
                    "phase1_det_score": 0,
                    "phase2_det_score": 0,
                    "allowed_drop": 0,
                    "randomness_effective_strength": randomness.effective_strength,
                    "search_workers": search_workers,
                    "time_limit_s": time_limit_s,
                    "phase1_time_s": phase1_time,
                    "phase2_time_s": phase2_time,
                },
            }
        phase1_det_score = int(round(solver_phase1.ObjectiveValue()))
        for s in range(num_students):
            for g in range(num_groups):
                phase1_assignment_hint[(s, g)] = int(solver_phase1.Value(assignment[(s, g)]))
        final_solver = solver_phase1
        final_status = status_phase1
        final_objective_value = solver_phase1.ObjectiveValue()


    if config.randomness > 0 and randomness.has_terms:
        if deterministic.has_terms:
            print("[LOG] Computing allowed drop for phase 2...")
            allowed_drop = compute_quality_frontier_drop(
                randomness=config.randomness,
                student_count=num_students,
                deterministic_best_score=phase1_det_score,
                deterministic_abs_bound=deterministic.abs_bound,
            )
            model.Add(deterministic.expression >= phase1_det_score - allowed_drop)
            for (s, g), value in phase1_assignment_hint.items():
                model.AddHint(assignment[(s, g)], value)

        tie_multiplier = min(max(deterministic.abs_bound + 1, 1), 1_000_000)
        if deterministic.has_terms:
            model.Maximize((tie_multiplier * randomness.expression) + deterministic.expression)
        else:
            model.Maximize(randomness.expression)

        print("[LOG] Starting phase 2 randomness solve...")
        solver_phase2 = _make_solver(
            seed=derived_seed,
            time_limit_s=phase2_time,
            search_workers=search_workers,
        )
        status_phase2 = solver_phase2.Solve(model)
        phase2_status_name = _status_name(status_phase2)
        print(f"[LOG] Phase 2 solve status: {phase2_status_name}. Wall time: {solver_phase2.WallTime():.2f}s")
        if status_phase2 in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            final_solver = solver_phase2
            final_status = status_phase2
            final_objective_value = solver_phase2.ObjectiveValue()
        elif phase1_solver is not None and phase1_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            print(f"[LOG] Phase 2 failed, falling back to phase 1 solution.")
            diagnostics["warnings"].append(
                f"Phase 2 status {phase2_status_name}; falling back to feasible phase-1 solution."
            )
            final_solver = phase1_solver
            final_status = phase1_status
            final_objective_value = phase1_solver.ObjectiveValue()
            phase2_fallback_used = True
        else:
            final_solver = solver_phase2
            final_status = status_phase2
            final_objective_value = solver_phase2.ObjectiveValue()


    elif final_solver is None:
        print("[LOG] No deterministic or randomness terms, running trivial solve...")
        model.Maximize(0)
        solver_single = _make_solver(
            seed=derived_seed,
            time_limit_s=time_limit_s,
            search_workers=search_workers,
        )
        status_single = solver_single.Solve(model)
        print(f"[LOG] Trivial solve status: {_status_name(status_single)}. Wall time: {solver_single.WallTime():.2f}s")
        final_solver = solver_single
        final_status = status_single
        final_objective_value = solver_single.ObjectiveValue()

    print(f"[LOG] Final solve status: {_status_name(final_status)}. Wall time: {final_solver.WallTime():.2f}s")
    if final_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        print("[LOG] No feasible solution found in final solve.")
        return {
            "status": _status_name(final_status),
            "section_id": section_id,
            "num_groups": num_groups,
            "teams": [],
            "objective": {
                "total_score": 0.0,
                "criteria_scores": {
                    "buddy": None,
                    "gender": None,
                    "gpa": None,
                    "mbti": None,
                    "reputation": None,
                    "school": None,
                    "skills": None,
                    "topics": None,
                    "year": None,
                    "randomness_jitter": None,
                },
            },
            "solver_stats": {
                "wall_time_s": final_solver.WallTime(),
                "num_conflicts": final_solver.NumConflicts(),
                "num_branches": final_solver.NumBranches(),
                "best_objective_bound": final_solver.BestObjectiveBound(),
                "search_workers": search_workers,
            },
            "diagnostics": {
                **diagnostics,
                "seed_used": derived_seed,
                "phase1_det_score": phase1_det_score,
                "phase2_det_score": 0,
                "allowed_drop": allowed_drop,
                "randomness_effective_strength": randomness.effective_strength,
                "phase2_status": phase2_status_name,
                "phase2_fallback_used": phase2_fallback_used,
                "search_workers": search_workers,
                "time_limit_s": time_limit_s,
                "phase1_time_s": phase1_time,
                "phase2_time_s": phase2_time,
            },
        }

    if deterministic.has_terms:
        phase2_det_score = int(final_solver.Value(deterministic.expression))


    print("[LOG] Extracting team assignments from solution...")
    assignment_by_team: Dict[int, list[int]] = {team_index: [] for team_index in range(num_groups)}
    for student_index, student in enumerate(students):
        for team_index in range(num_groups):
            if final_solver.Value(assignment[(student_index, team_index)]) == 1:
                assignment_by_team[team_index].append(student.student_id)
                break

    for student_ids in assignment_by_team.values():
        student_ids.sort()

    teams_payload = [
        {"team_index": team_index + 1, "student_ids": assignment_by_team[team_index]}
        for team_index in range(num_groups)
    ]


    print("[LOG] Scoring criteria...")
    criteria_scores, weighted_total_int = _score_criteria(
        criterion_meta=deterministic.criterion_meta,
        solver=final_solver,
    )

    print("[LOG] Returning final result.")
    return {
        "status": _status_name(final_status),
        "section_id": section_id,
        "num_groups": num_groups,
        "teams": teams_payload,
        "objective": {
            "total_score": weighted_total_int / SCORE_DENOMINATOR,
            "criteria_scores": criteria_scores,
            "solver_objective_value": final_objective_value,
        },
        "solver_stats": {
            "wall_time_s": final_solver.WallTime(),
            "num_conflicts": final_solver.NumConflicts(),
            "num_branches": final_solver.NumBranches(),
            "best_objective_bound": final_solver.BestObjectiveBound(),
            "search_workers": search_workers,
        },
        "diagnostics": {
            **diagnostics,
            "seed_used": derived_seed,
            "phase1_det_score": phase1_det_score,
            "phase2_det_score": phase2_det_score,
            "allowed_drop": allowed_drop,
            "randomness_effective_strength": randomness.effective_strength,
            "feasible_same_team_pairs": randomness.feasible_same_team_pairs,
            "phase2_status": phase2_status_name,
            "phase2_fallback_used": phase2_fallback_used,
            "input_summary": {
                "student_count": num_students,
                "team_size_lower": team_size_lower,
                "team_size_upper": team_size_upper,
                "valid_skill_count": len(prepared.skills),
                "valid_topic_count": len(prepared.topics),
                "search_workers": search_workers,
                "time_limit_s": time_limit_s,
                "phase1_time_s": phase1_time,
                "phase2_time_s": phase2_time,
            },
        },
    }


def is_solver_success_status(status: Any) -> bool:
    return str(status).upper() in SOLVER_SUCCESS_STATUSES


def is_solver_failure_status(status: Any) -> bool:
    return str(status).upper() in SOLVER_FAILURE_STATUSES


def filter_solver_result_for_api(
    solver_result: Dict[str, Any],
    debug: bool = False,
) -> Dict[str, Any]:
    section_id = solver_result.get("section_id")
    teams = solver_result.get("teams")
    if not isinstance(teams, list):
        teams = []

    response_data: Dict[str, Any] = {"section_id": section_id, "teams": teams}
    if not debug:
        return response_data

    for key in ("status", "num_groups", "objective", "solver_stats", "diagnostics"):
        response_data[key] = solver_result.get(key)
    return response_data


def _load_json_file(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Team Formation CP-SAT solver.")
    parser.add_argument(
        "--formation-config",
        default="formation-config.json",
        help="Path to formation-config JSON file.",
    )
    parser.add_argument(
        "--student-profile",
        default="student-profile.json",
        help="Path to student-profile JSON file.",
    )
    parser.add_argument("--seed", type=int, default=None, help="Optional deterministic seed.")
    parser.add_argument(
        "--time-limit-s",
        type=float,
        default=10.0,
        help="Solver time limit in seconds.",
    )
    args = parser.parse_args()


    print("[LOG] Loading formation config and student profile...")
    formation_config = _load_json_file(args.formation_config)
    student_profile = _load_json_file(args.student_profile)
    print("[LOG] Starting team formation solve...")
    result = solve_teams(
        formation_config=formation_config,
        student_profile=student_profile,
        seed=args.seed,
        time_limit_s=args.time_limit_s,
    )
    print("[LOG] Team formation solve complete. Outputting result...")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

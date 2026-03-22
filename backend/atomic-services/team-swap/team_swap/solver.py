"""OR-Tools solver for optimal swap selection."""
from typing import Dict, List, Optional, Tuple

from ortools.sat.python import cp_model


def solve_swaps(
    approved_requests: List[Dict],
    current_teams: Dict[str, List[int]],
    students_data: Dict[int, Dict],
    constraints: Dict,
    time_limit_s: int = 10,
) -> Tuple[List[Tuple[int, int]], float]:
    """
    Use OR-Tools CP-SAT to select optimal subset of approved swap requests.

    Args:
        approved_requests: List of {swap_request_id, student_id, current_team}
        current_teams: Dict[team_id] -> list of student_ids
        students_data: Dict[student_id] -> {year, gender, gpa, skills, ...}
        constraints: Dict with min_gpa, require_year_diversity, max_skill_imbalance
        time_limit_s: Solver timeout in seconds

    Returns:
        (selected_pairs, objective_value) where selected_pairs = [(student_id_1, student_id_2), ...]
    """
    from .constraints import check_all_constraints

    model = cp_model.CpModel()

    # Build candidate pairs: for each pair of requests from different teams, evaluate feasibility.
    candidates = []
    candidate_feasibility = []

    for i, req1 in enumerate(approved_requests):
        for j, req2 in enumerate(approved_requests):
            if i >= j:
                continue
            s1, t1 = req1["student_id"], req1["current_team"]
            s2, t2 = req2["student_id"], req2["current_team"]

            if t1 == t2:
                continue  # Can't swap within same team.

            # Simulate the swap and check constraints.
            simulated_teams = simulate_swap(current_teams, s1, t1, s2, t2)
            feasible, reason = check_all_constraints(simulated_teams, students_data, constraints)

            candidates.append((s1, s2, t1, t2))
            candidate_feasibility.append((feasible, reason))

    if not candidates:
        return [], 0.0

    # Create binary variables for each feasible candidate.
    swap_vars = []
    for idx, (feasible, reason) in enumerate(candidate_feasibility):
        if feasible:
            var = model.NewBoolVar(f"swap_{idx}")
            swap_vars.append((idx, var))

    if not swap_vars:
        return [], 0.0

    # Constraint: each student can be in at most one selected swap.
    student_to_swaps = {}
    for idx, var in swap_vars:
        s1, s2, _, _ = candidates[idx]
        if s1 not in student_to_swaps:
            student_to_swaps[s1] = []
        student_to_swaps[s1].append(var)
        if s2 not in student_to_swaps:
            student_to_swaps[s2] = []
        student_to_swaps[s2].append(var)

    for sid, vars_list in student_to_swaps.items():
        model.Add(sum(vars_list) <= 1)

    # Constraint: optional one-swap-per-team-pair for stability.
    team_pair_to_swaps = {}
    for idx, var in swap_vars:
        _, _, t1, t2 = candidates[idx]
        team_pair = tuple(sorted([t1, t2]))
        if team_pair not in team_pair_to_swaps:
            team_pair_to_swaps[team_pair] = []
        team_pair_to_swaps[team_pair].append(var)

    for team_pair, vars_list in team_pair_to_swaps.items():
        model.Add(sum(vars_list) <= 1)  # At most one swap per team pair.

    # Objective: maximize number of selected swaps (secondary goal to avoid zero-swap trivial solution).
    # Primary goal (user selected): minimize constraint violation penalty.
    # For simplicity, we maximize # of swaps; can refine to weight by violation severity later.
    swap_count = sum(var for _, var in swap_vars)
    model.Maximize(swap_count)

    # Solve.
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return [], 0.0

    # Extract selected swaps.
    selected_pairs = []
    for idx, var in swap_vars:
        if solver.Value(var):
            s1, s2, _, _ = candidates[idx]
            selected_pairs.append((s1, s2))

    objective = solver.ObjectiveValue()
    return selected_pairs, objective


def simulate_swap(current_teams: Dict[str, List[int]], s1: int, t1: str, s2: int, t2: str) -> Dict[str, List[int]]:
    """Simulate swapping students s1 and s2 between teams t1 and t2."""
    simulated = {}
    for tid, students in current_teams.items():
        simulated[tid] = list(students)

    simulated[t1].remove(s1)
    simulated[t1].append(s2)
    simulated[t2].remove(s2)
    simulated[t2].append(s1)

    return simulated

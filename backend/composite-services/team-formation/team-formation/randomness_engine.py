from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, Tuple

from ortools.sat.python import cp_model

from config_interpreter import CRITERION_SCALE


@dataclass
class RandomnessBuildResult:
    expression: cp_model.LinearExpr
    has_terms: bool
    criterion_meta: Dict[str, object]
    effective_strength: float
    feasible_same_team_pairs: int


def feasible_same_team_pairs(student_count: int, num_groups: int) -> int:
    if num_groups <= 0:
        return 0
    lower = student_count // num_groups
    upper = lower + (1 if student_count % num_groups else 0)
    upper_count = student_count % num_groups
    lower_count = num_groups - upper_count
    return upper_count * (upper * (upper - 1) // 2) + lower_count * (lower * (lower - 1) // 2)


def build_randomness_objective(
    assignment: Dict[Tuple[int, int], cp_model.IntVar],
    randomness_int: int,
    derived_seed: int,
    student_count: int,
    num_groups: int,
) -> RandomnessBuildResult:
    if student_count <= 0 or num_groups <= 0:
        return RandomnessBuildResult(
            expression=0,
            has_terms=False,
            criterion_meta={"type": "assignment_jitter", "weight_int": randomness_int, "terms": []},
            effective_strength=0.0,
            feasible_same_team_pairs=0,
        )

    rng = random.Random(derived_seed ^ 0x5EED5EED)
    base_coeff = max(CRITERION_SCALE // max(student_count * num_groups, 1), 1)

    terms = []
    expression_terms = []
    abs_coeff_sum = 0

    for s in range(student_count):
        for g in range(num_groups):
            var = assignment[(s, g)]
            raw = rng.uniform(-1.0, 1.0)
            coeff = int(round(raw * base_coeff))
            if coeff == 0:
                continue
            terms.append({"coeff": coeff, "var": var})
            abs_coeff_sum += abs(coeff)
            if randomness_int != 0:
                expression_terms.append(randomness_int * coeff * var)

    expression = sum(expression_terms) if expression_terms else 0
    effective_strength = abs_coeff_sum / max(student_count * num_groups, 1)

    return RandomnessBuildResult(
        expression=expression,
        has_terms=bool(expression_terms),
        criterion_meta={
            "type": "assignment_jitter",
            "weight_int": randomness_int,
            "terms": terms,
        },
        effective_strength=effective_strength,
        feasible_same_team_pairs=feasible_same_team_pairs(student_count, num_groups),
    )

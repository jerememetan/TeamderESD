from __future__ import annotations

import hashlib
import os
from typing import Any, Dict, Optional

from solver_models import SolverConfig

WEIGHT_SCALE = 1_000
CRITERION_SCALE = 10_000
PAIR_METRIC_SCALE = 1_000
IMPORTANCE_SCALE = 1_000
SCORE_DENOMINATOR = WEIGHT_SCALE * CRITERION_SCALE
EPSILON = 1e-9
INT32_MAX = 2_147_483_647

CRITERION_KEYS = (
    "buddy_weight",
    "gender_weight",
    "gpa_weight",
    "mbti_weight",
    "reputation_weight",
    "school_weight",
    "skill_weight",
    "topic_weight",
    "year_weight",
)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def scaled_int(value: float, scale: int) -> int:
    return int(round(value * scale))


def derive_seed(seed: Optional[int], section_id: Optional[str]) -> int:
    def _to_signed_int32(value: int) -> int:
        normalized = int(value) & 0xFFFFFFFF
        if normalized > INT32_MAX:
            normalized -= 0x1_0000_0000
        return normalized

    if seed is not None:
        return _to_signed_int32(seed)
    if not section_id:
        return 0
    digest = hashlib.sha256(section_id.encode("utf-8")).hexdigest()
    return _to_signed_int32(int(digest[:8], 16))


def parse_solver_config(
    formation_config: Dict[str, Any],
    diagnostics: Dict[str, list[str]],
) -> SolverConfig:
    criteria = formation_config.get("criteria")
    if not isinstance(criteria, dict):
        diagnostics["errors"].append("formation_config.criteria must be an object.")
        criteria = {}

    section_id = formation_config.get("section_id")
    if not isinstance(section_id, str):
        section_id = None

    num_groups = safe_int(criteria.get("num_groups"))
    if num_groups is None:
        diagnostics["errors"].append("criteria.num_groups must be an integer.")
        num_groups = 0

    weights: Dict[str, float] = {}
    for key in CRITERION_KEYS:
        value = safe_float(criteria.get(key, 0.0))
        if value is None:
            diagnostics["errors"].append(f"{key} must be numeric.")
            value = 0.0
        weights[key] = value

    randomness = safe_float(criteria.get("randomness", 0.0))
    if randomness is None:
        diagnostics["errors"].append("criteria.randomness must be numeric.")
        randomness = 0.0
    randomness = clamp(randomness, 0.0, 1.0)

    env_workers = safe_int(os.getenv("TEAM_FORMATION_SEARCH_WORKERS"))
    config_workers = safe_int(criteria.get("search_workers"))
    if config_workers is None:
        config_workers = env_workers
    cpu_guess = os.cpu_count() or 1
    default_workers = max(1, min(cpu_guess, 8))
    if config_workers is None:
        search_workers = default_workers
    else:
        if config_workers < 1:
            diagnostics["warnings"].append("criteria.search_workers < 1; clamped to 1.")
        search_workers = max(1, min(config_workers, 64))

    phase2_ratio = safe_float(criteria.get("phase2_ratio", 0.5))
    if phase2_ratio is None:
        diagnostics["warnings"].append("criteria.phase2_ratio is invalid; defaulted to 0.5.")
        phase2_ratio = 0.5
    phase2_ratio = clamp(phase2_ratio, 0.0, 0.95)

    max_time_s = safe_float(criteria.get("max_time_s"))
    if max_time_s is not None and max_time_s <= 0:
        diagnostics["warnings"].append("criteria.max_time_s must be > 0; ignored.")
        max_time_s = None

    weight_ints = {key: scaled_int(value, WEIGHT_SCALE) for key, value in weights.items()}
    randomness_int = scaled_int(randomness, WEIGHT_SCALE)

    return SolverConfig(
        section_id=section_id,
        num_groups=num_groups,
        weights=weights,
        weight_ints=weight_ints,
        randomness=randomness,
        randomness_int=randomness_int,
        search_workers=search_workers,
        phase2_ratio=phase2_ratio,
        max_time_s=max_time_s,
    )


def compute_quality_frontier_drop(
    randomness: float,
    student_count: int,
    deterministic_best_score: int,
    deterministic_abs_bound: int,
) -> int:
    if randomness <= 0:
        return 0


    size_factor = clamp((student_count - 20) / 20.0, 0.0, 1.0)
    max_drop_ratio = 0.03 + (0.09 * size_factor)  # 3%..12%
    effective_ratio = max_drop_ratio * (randomness ** 1.25)

    baseline = max(abs(deterministic_best_score), 1)
    fallback = max(deterministic_abs_bound // 20, 1)
    reference = max(baseline, fallback)
    return int(round(reference * effective_ratio))

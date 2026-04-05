"""Peer evaluation analytics engine for future formation weight suggestions.

This module is intentionally pure/business-logic only (no HTTP, Flask, or I/O)
so it can be reused and unit-tested independently.
"""

from math import log


MIN_EVALS_PER_TEAM = 3
STRONG_DELTA_THRESHOLD = 0.5


def _safe_number(value, default=None):
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default
    return numeric


def _normalized_entropy(distribution):
    """Return normalized entropy in [0, 1] for a categorical distribution."""
    if not isinstance(distribution, dict) or not distribution:
        return None

    counts = [int(v) for v in distribution.values() if _safe_number(v) is not None and float(v) > 0]
    total = sum(counts)
    if total <= 0:
        return None

    if len(counts) <= 1:
        return 0.0

    probabilities = [count / total for count in counts]
    entropy = -sum(prob * log(prob) for prob in probabilities if prob > 0)
    max_entropy = log(len(counts))
    if max_entropy <= 0:
        return 0.0
    return min(1.0, max(0.0, entropy / max_entropy))


def _inverse_spread(value):
    """Map spread values (std/range) to [0,1], where lower spread is better."""
    numeric = _safe_number(value)
    if numeric is None or numeric < 0:
        return None
    return 1.0 / (1.0 + numeric)


def _avg(values):
    if not values:
        return None
    return sum(values) / len(values)


def _build_team_rating_summary(submissions):
    ratings_by_team = {}
    for submission in submissions or []:
        team_id = submission.get("team_id")
        rating = _safe_number(submission.get("rating"))
        if team_id is None or rating is None:
            continue
        ratings_by_team.setdefault(str(team_id), []).append(rating)

    summary = {}
    for team_id, ratings in ratings_by_team.items():
        if not ratings:
            continue
        summary[team_id] = {
            "avg_rating": round(sum(ratings) / len(ratings), 4),
            "eval_count": len(ratings),
        }
    return summary


def _team_score_extractors():
    return {
        "gpa_weight": lambda team: _inverse_spread(team.get("gpa", {}).get("std")),
        "school_weight": lambda team: _normalized_entropy(team.get("school_distribution", {})),
        "year_weight": lambda team: _normalized_entropy(team.get("year_distribution", {})),
        "gender_weight": lambda team: _normalized_entropy(team.get("gender_distribution", {})),
        "mbti_weight": lambda team: _normalized_entropy(team.get("mbti_distribution", {})),
        "reputation_weight": lambda team: _inverse_spread(team.get("reputation", {}).get("std")),
        "buddy_weight": lambda team: _safe_number(team.get("buddy_satisfaction", {}).get("rate")),
        "topic_weight": lambda team: _safe_number(team.get("topic_alignment", {}).get("alignment_ratio")),
        "skill_weight": lambda team: _avg(
            [
                _safe_number(item.get("avg_level"))
                for item in (team.get("skill_balance") or [])
                if _safe_number(item.get("avg_level")) is not None
            ]
        ),
    }


def _criterion_label(weight_key):
    return weight_key.replace("_weight", "").replace("_", " ").title()


def _confidence_for_samples(samples):
    if not samples:
        return 0.0
    avg_eval_count = sum(sample["eval_count"] for sample in samples) / len(samples)
    team_factor = min(1.0, len(samples) / 4.0)
    eval_factor = min(1.0, avg_eval_count / 5.0)
    return round(team_factor * 0.45 + eval_factor * 0.55, 2)


def _recommendation_from_delta(delta):
    if delta >= STRONG_DELTA_THRESHOLD:
        return "INCREASE", "strong_positive"
    if delta <= -STRONG_DELTA_THRESHOLD:
        return "FLAG_REVIEW", "negative"
    return "KEEP_OR_SLIGHTLY_REDUCE", "weak_or_none"


def _reasoning_for_recommendation(association, delta, low_bucket_rating, high_bucket_rating):
    if association == "strong_positive":
        return (
            "Teams with stronger criterion outcomes received higher peer ratings "
            f"(+{delta:.2f} rating delta: {high_bucket_rating:.2f} vs {low_bucket_rating:.2f})."
        )
    if association == "negative":
        return (
            "Teams with stronger criterion outcomes received lower peer ratings "
            f"({delta:.2f} rating delta: {high_bucket_rating:.2f} vs {low_bucket_rating:.2f}). "
            "Flag for instructor review before increasing this weight."
        )
    return (
        "Criterion outcomes showed weak/no rating separation "
        f"({delta:.2f} rating delta: {high_bucket_rating:.2f} vs {low_bucket_rating:.2f})."
    )


def _analyze_single_criterion(weight_key, current_weight, team_metrics, team_rating_summary, extractor):
    samples = []
    for team_metric in team_metrics:
        team_id = str(team_metric.get("team_id"))
        rating_summary = team_rating_summary.get(team_id)
        if not rating_summary:
            continue
        if rating_summary["eval_count"] < MIN_EVALS_PER_TEAM:
            continue

        criterion_score = extractor(team_metric)
        if criterion_score is None:
            continue
        samples.append(
            {
                "team_id": team_id,
                "criterion_score": float(criterion_score),
                "avg_rating": float(rating_summary["avg_rating"]),
                "eval_count": int(rating_summary["eval_count"]),
            }
        )

    base_payload = {
        "criterion": weight_key,
        "criterion_label": _criterion_label(weight_key),
        "current_weight": _safe_number(current_weight, default=0.0),
        "min_evals_per_team": MIN_EVALS_PER_TEAM,
        "qualified_team_count": len(samples),
    }

    if len(samples) < 2:
        return {
            **base_payload,
            "association": "insufficient_data",
            "recommendation": "INSUFFICIENT_DATA",
            "confidence": 0.0,
            "rating_delta": None,
            "high_bucket_avg_rating": None,
            "low_bucket_avg_rating": None,
            "reasoning": "Not enough qualified team peer-evaluation samples for this criterion.",
        }

    samples_sorted = sorted(samples, key=lambda item: item["criterion_score"])
    midpoint = len(samples_sorted) // 2

    if midpoint == 0:
        return {
            **base_payload,
            "association": "insufficient_data",
            "recommendation": "INSUFFICIENT_DATA",
            "confidence": 0.0,
            "rating_delta": None,
            "high_bucket_avg_rating": None,
            "low_bucket_avg_rating": None,
            "reasoning": "Not enough sample spread to compare high vs low criterion buckets.",
        }

    low_bucket = samples_sorted[:midpoint]
    high_bucket = samples_sorted[-midpoint:]
    low_bucket_rating = sum(sample["avg_rating"] for sample in low_bucket) / len(low_bucket)
    high_bucket_rating = sum(sample["avg_rating"] for sample in high_bucket) / len(high_bucket)
    rating_delta = high_bucket_rating - low_bucket_rating

    recommendation, association = _recommendation_from_delta(rating_delta)
    confidence = _confidence_for_samples(samples)

    return {
        **base_payload,
        "association": association,
        "recommendation": recommendation,
        "confidence": confidence,
        "rating_delta": round(rating_delta, 4),
        "high_bucket_avg_rating": round(high_bucket_rating, 4),
        "low_bucket_avg_rating": round(low_bucket_rating, 4),
        "reasoning": _reasoning_for_recommendation(
            association, rating_delta, low_bucket_rating, high_bucket_rating
        ),
    }


def analyze_peer_eval_weight_recommendations(team_metrics, criteria, submissions):
    """Create instructor-only suggestions for next formation weight tuning.

    Returns a response payload that can be embedded into dashboard analytics.
    """
    extractors = _team_score_extractors()
    team_rating_summary = _build_team_rating_summary(submissions)
    total_eval_count = sum(item["eval_count"] for item in team_rating_summary.values())

    recommendations = []
    for weight_key, extractor in extractors.items():
        recommendations.append(
            _analyze_single_criterion(
                weight_key=weight_key,
                current_weight=(criteria or {}).get(weight_key, 0.0),
                team_metrics=team_metrics or [],
                team_rating_summary=team_rating_summary,
                extractor=extractor,
            )
        )

    recommendations.sort(
        key=lambda item: (
            item.get("recommendation") == "INSUFFICIENT_DATA",
            -(item.get("confidence") or 0.0),
            item.get("criterion", ""),
        )
    )

    return {
        "has_peer_eval": bool(team_rating_summary),
        "total_eval_count": total_eval_count,
        "teams_with_peer_eval": len(team_rating_summary),
        "min_evals_per_team": MIN_EVALS_PER_TEAM,
        "criteria_recommendations": recommendations,
    }

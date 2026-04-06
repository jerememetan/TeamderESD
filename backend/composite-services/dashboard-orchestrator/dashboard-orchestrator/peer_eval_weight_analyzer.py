"""Peer evaluation analytics engine for future formation weight suggestions.

This module is intentionally pure/business-logic only (no HTTP, Flask, or I/O)
so it can be reused and unit-tested independently.
"""

from math import log


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


def _low_sample_recommendation(base_payload, samples):
    avg_rating = sum(sample["avg_rating"] for sample in samples) / len(samples) if samples else None
    return {
        **base_payload,
        "association": "positive" if (avg_rating or 0) >= 3.0 else "negative",
        "rating_delta": 0.0,
        "high_bucket_avg_rating": round(avg_rating, 4) if avg_rating is not None else None,
        "low_bucket_avg_rating": round(avg_rating, 4) if avg_rating is not None else None,
    }


def _analyze_single_criterion(weight_key, current_weight, team_metrics, team_rating_summary, extractor):
    samples = []
    for team_metric in team_metrics:
        team_id = str(team_metric.get("team_id"))
        rating_summary = team_rating_summary.get(team_id)
        if not rating_summary:
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
        "qualified_team_count": len(samples),
    }

    if len(samples) < 2:
        return _low_sample_recommendation(base_payload, samples)

    samples_sorted = sorted(samples, key=lambda item: item["criterion_score"])
    midpoint = len(samples_sorted) // 2

    if midpoint == 0:
        return _low_sample_recommendation(base_payload, samples)

    low_bucket = samples_sorted[:midpoint]
    high_bucket = samples_sorted[-midpoint:]
    low_bucket_rating = sum(sample["avg_rating"] for sample in low_bucket) / len(low_bucket)
    high_bucket_rating = sum(sample["avg_rating"] for sample in high_bucket) / len(high_bucket)
    rating_delta = high_bucket_rating - low_bucket_rating

    association = "positive" if rating_delta >= 0 else "negative"

    return {
        **base_payload,
        "association": association,
        "rating_delta": round(rating_delta, 4),
        "high_bucket_avg_rating": round(high_bucket_rating, 4),
        "low_bucket_avg_rating": round(low_bucket_rating, 4),
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
            -(item.get("confidence") or 0.0),
            item.get("criterion", ""),
        )
    )

    return {
        "has_peer_eval": bool(team_rating_summary),
        "total_eval_count": total_eval_count,
        "teams_with_peer_eval": len(team_rating_summary),
        "criteria_recommendations": recommendations,
    }

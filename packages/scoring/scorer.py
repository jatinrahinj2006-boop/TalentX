# packages/scoring/scorer.py
"""
Deterministic Scoring Engine
MUST CONTAIN ZERO LLM AND ZERO NETWORK CALLS.

Formula:
final_score = (
    0.35 * required_skill_score +
    0.10 * preferred_skill_score +
    0.20 * experience_score +
    0.10 * responsibility_similarity +
    0.10 * role_domain_similarity +
    0.05 * education_score +
    0.05 * project_relevance +
    0.05 * certification_relevance
) - gap_penalty
"""

from typing import List, Dict, Any

def _avg(values: List[float]) -> float:
    return sum(values) / len(values) if values else 1.0

def score_candidate(
    skill_matches: List[Dict[str, Any]],
    candidate_exp_months: int,
    required_exp_months: int,
    responsibility_sim: float = 0.8,
    domain_sim: float = 0.8,
    education_score: float = 1.0,
    project_relevance: float = 0.8,
    certification_relevance: float = 0.8,
) -> Dict[str, Any]:
    """
    Computes overall score and breakdown deterministically.
    """
    required = [s for s in skill_matches if s.get("importance") == "must"]
    preferred = [s for s in skill_matches if s.get("importance") == "preferred"]

    required_skill_score = _avg([s.get("match_value", 0.0) for s in required]) if required else 1.0
    preferred_skill_score = _avg([s.get("match_value", 0.0) for s in preferred]) if preferred else 1.0

    # Experience score calculation
    if required_exp_months <= 0:
        experience_score = 1.0
    else:
        experience_score = min(1.0, float(candidate_exp_months) / float(required_exp_months))

    # Gap penalty: deduction of 8.0 points for each missing required skill beyond 1
    missing_required = sum(1 for s in required if s.get("match_value", 0.0) == 0.0)
    gap_penalty = max(0, missing_required - 1) * 8.0

    raw_weighted = (
        0.35 * required_skill_score +
        0.10 * preferred_skill_score +
        0.20 * experience_score +
        0.10 * responsibility_sim +
        0.10 * domain_sim +
        0.05 * education_score +
        0.05 * project_relevance +
        0.05 * certification_relevance
    )

    # Scale raw 0.0-1.0 score to 0-100 scale, then apply gap_penalty
    overall_score = max(0.0, min(100.0, (raw_weighted * 100.0) - gap_penalty))

    return {
        "overall_score": round(overall_score, 1),
        "score_breakdown": {
            "required_skill_score": round(required_skill_score, 2),
            "preferred_skill_score": round(preferred_skill_score, 2),
            "experience_score": round(experience_score, 2),
            "responsibility_similarity": round(responsibility_sim, 2),
            "role_domain_similarity": round(domain_sim, 2),
            "education_score": round(education_score, 2),
            "project_relevance": round(project_relevance, 2),
            "certification_relevance": round(certification_relevance, 2),
            "gap_penalty": round(gap_penalty, 1),
        }
    }

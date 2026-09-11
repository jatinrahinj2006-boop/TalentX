# packages/agents/skill_gap_agent.py
"""
Agent 4: Skill Gap Agent
Role: Classifies each required/preferred skill as matched/partial/missing and assigns severity.
  HIGH   → missing required skill
  MEDIUM → partial required or missing preferred (important)
  LOW    → missing preferred (non-critical)
"""

from typing import List
from packages.schemas.match import SkillMatch, SkillGapItem

# Skills considered high-impact if they appear in preferred but missing
HIGH_IMPACT_PREFERRED = {
    "docker", "kubernetes", "aws", "gcp", "azure",
    "postgresql", "redis", "fastapi", "django",
    "pytorch", "tensorflow", "scikit-learn",
}

def analyze_skill_gaps(skill_matches: List[SkillMatch]) -> List[SkillGapItem]:
    """
    Generates a prioritized list of skill gaps from matching results.
    """
    gaps: List[SkillGapItem] = []

    for sm in skill_matches:
        if sm.status == "matched":
            continue  # No gap

        is_must = sm.importance == "must"
        is_missing = sm.status == "missing"
        is_partial = sm.status == "partial"

        skill_lower = sm.skill_name.lower()

        if is_must and is_missing:
            severity = "HIGH"
            recommendation = (
                f"Candidate is missing '{sm.skill_name}' which is a required skill. "
                f"Consider candidates who can demonstrate this through coursework, projects, or certifications."
            )
        elif is_must and is_partial:
            severity = "MEDIUM"
            recommendation = (
                f"Candidate has partial proficiency in '{sm.skill_name}'. "
                f"Consider screening with a technical assessment."
            )
        elif not is_must and is_missing:
            if skill_lower in HIGH_IMPACT_PREFERRED:
                severity = "MEDIUM"
                recommendation = (
                    f"'{sm.skill_name}' is preferred and missing — this is a high-impact tool for this role."
                )
            else:
                severity = "LOW"
                recommendation = (
                    f"'{sm.skill_name}' is preferred but not required. Candidate can be onboarded."
                )
        elif not is_must and is_partial:
            severity = "LOW"
            recommendation = f"Candidate has partial experience with '{sm.skill_name}' (preferred)."
        else:
            continue

        gaps.append(SkillGapItem(
            skill_name=sm.skill_name,
            importance=sm.importance,
            severity=severity,
            recommendation=recommendation,
        ))

    # Sort: HIGH → MEDIUM → LOW
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    gaps.sort(key=lambda g: order.get(g.severity, 3))
    return gaps

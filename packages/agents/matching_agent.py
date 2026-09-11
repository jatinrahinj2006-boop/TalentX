# packages/agents/matching_agent.py
"""
Agent 3: Matching Agent
Role: Computes per-skill match values using exact/alias matching + cosine similarity fallback.
      Calls scorer.py (deterministic) — never sets a score via LLM.
Rule: Sensitive attributes (name, age, gender, etc.) are EXCLUDED before scoring.
"""

import math
from typing import List, Dict, Any, Optional
from packages.schemas.resume import ExtractedResume, ExtractedSkill
from packages.schemas.job import ExtractedJob, RequiredSkill, PreferredSkill
from packages.schemas.match import MatchResult, SkillMatch, ScoreBreakdown
from packages.knowledge.skill_normalizer import normalize_skill
from packages.scoring.scorer import score_candidate

# ── Simple embedding (char n-gram cosine) as fallback when sentence-transformers absent ──
def _ngram_vector(text: str, n: int = 3) -> Dict[str, int]:
    text = text.lower()
    vec: Dict[str, int] = {}
    for i in range(len(text) - n + 1):
        g = text[i:i+n]
        vec[g] = vec.get(g, 0) + 1
    return vec

def _cosine(a: Dict[str, int], b: Dict[str, int]) -> float:
    dot = sum(a.get(k, 0) * v for k, v in b.items())
    norm_a = math.sqrt(sum(v*v for v in a.values()))
    norm_b = math.sqrt(sum(v*v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

def _skill_match_value(candidate_skill_name: str, job_skill_name: str) -> float:
    """
    Returns match_value in [0, 1]:
      1.0  → exact or synonym match
      0.7+ → high cosine similarity (semantic overlap)
      0.4  → partial/related
      0.0  → missing
    """
    c_norm, _ = normalize_skill(candidate_skill_name)
    j_norm, _ = normalize_skill(job_skill_name)

    if c_norm.lower() == j_norm.lower():
        return 1.0

    sim = _cosine(_ngram_vector(c_norm), _ngram_vector(j_norm))
    if sim >= 0.75:
        return round(sim, 2)
    elif sim >= 0.45:
        return 0.4
    return 0.0

def _total_experience_months(resume: ExtractedResume) -> int:
    return sum(e.duration_months for e in resume.experience)

def _education_score(resume: ExtractedResume, job: ExtractedJob) -> float:
    degree_ranks = {"ph.d": 4, "m.s": 3, "m.tech": 3, "b.tech": 2, "b.s": 2, "b.e": 2, "diploma": 1}
    req_text = " ".join(job.education_requirements).lower()
    max_rank = 0
    for edu in resume.education:
        for key, rank in degree_ranks.items():
            if key in edu.degree.lower():
                max_rank = max(max_rank, rank)
    # If job mentions specific degree requirement, check against it
    if "bachelor" in req_text or "b.s" in req_text or "b.tech" in req_text:
        return 1.0 if max_rank >= 2 else 0.5
    if "master" in req_text or "m.s" in req_text:
        return 1.0 if max_rank >= 3 else 0.6
    if "phd" in req_text or "ph.d" in req_text:
        return 1.0 if max_rank >= 4 else 0.5
    return 1.0  # No specific requirement → full score

def match_candidate_to_job(
    resume: ExtractedResume,
    job: ExtractedJob,
    match_id: Optional[str] = None,
) -> MatchResult:
    """
    Runs full matching pipeline:
    1. Normalize skills
    2. Compute per-skill match_value
    3. Feed into deterministic scorer.py
    4. Return MatchResult with full evidence
    """
    import uuid
    mid = match_id or f"M-{resume.candidate_id}-{job.job_id}"

    candidate_skill_names = [s.name for s in resume.skills]

    # ── Match every required skill ──────────────────────────────────────────
    skill_matches: List[SkillMatch] = []

    def best_match_value(job_skill_name: str) -> tuple[float, Optional[str], Optional[int]]:
        best_val = 0.0
        best_span = None
        best_page = None
        for cs in resume.skills:
            val = _skill_match_value(cs.name, job_skill_name)
            if val > best_val:
                best_val = val
                best_span = cs.evidence_span
                best_page = cs.page_number
        return best_val, best_span, best_page

    for req in job.required_skills:
        mv, span, page = best_match_value(req.name)
        status = "matched" if mv >= 0.8 else ("partial" if mv >= 0.3 else "missing")
        skill_matches.append(SkillMatch(
            skill_name=req.name,
            importance="must",
            status=status,
            match_value=mv,
            evidence_span=span,
            page_number=page,
        ))

    for pref in job.preferred_skills:
        mv, span, page = best_match_value(pref.name)
        status = "matched" if mv >= 0.8 else ("partial" if mv >= 0.3 else "missing")
        skill_matches.append(SkillMatch(
            skill_name=pref.name,
            importance="preferred",
            status=status,
            match_value=mv,
            evidence_span=span,
            page_number=page,
        ))

    # ── Responsibility & domain similarity (n-gram heuristic) ──────────────
    candidate_text = " ".join(
        [r for e in resume.experience for r in e.responsibilities] +
        [e.role for e in resume.experience]
    )
    job_resp_text = " ".join(job.responsibilities)

    resp_sim = round(min(1.0, _cosine(
        _ngram_vector(candidate_text or "developer"),
        _ngram_vector(job_resp_text or "developer")
    ) * 2.5), 2) if candidate_text else 0.6  # Scale up n-gram sims which tend low

    domain_sim = round(min(1.0, _cosine(
        _ngram_vector(" ".join(e.role for e in resume.experience) or job.domain),
        _ngram_vector(job.domain)
    ) * 2.5), 2)

    edu_score = _education_score(resume, job)
    exp_months = _total_experience_months(resume)

    project_rel = 0.8 if resume.projects else 0.5
    cert_rel = min(1.0, 0.5 + len(resume.certifications) * 0.25)

    # ── Call deterministic scorer (no LLM) ─────────────────────────────────
    score_result = score_candidate(
        skill_matches=[sm.model_dump() for sm in skill_matches],
        candidate_exp_months=exp_months,
        required_exp_months=job.minimum_experience_months,
        responsibility_sim=max(0.3, resp_sim),
        domain_sim=max(0.3, domain_sim),
        education_score=edu_score,
        project_relevance=project_rel,
        certification_relevance=cert_rel,
    )

    breakdown = ScoreBreakdown(
        required_skill_score=score_result["score_breakdown"]["required_skill_score"],
        preferred_skill_score=score_result["score_breakdown"]["preferred_skill_score"],
        experience_score=score_result["score_breakdown"]["experience_score"],
        responsibility_similarity=score_result["score_breakdown"]["responsibility_similarity"],
        role_domain_similarity=score_result["score_breakdown"]["role_domain_similarity"],
        education_score=score_result["score_breakdown"]["education_score"],
        project_relevance=score_result["score_breakdown"]["project_relevance"],
        certification_relevance=score_result["score_breakdown"]["certification_relevance"],
        gap_penalty=score_result["score_breakdown"]["gap_penalty"],
    )

    return MatchResult(
        match_id=mid,
        candidate_id=resume.candidate_id,
        job_id=job.job_id,
        candidate_name=getattr(resume, "name", None),
        overall_score=score_result["overall_score"],
        score_breakdown=breakdown,
        contact_info=getattr(resume, "contact_info", None),
        skill_matches=skill_matches,
        skill_gaps=[],       # Filled by Skill Gap Agent
        evidence_list=[],    # Filled by Recruiter Agent
        recruiter_summary=None,
    )


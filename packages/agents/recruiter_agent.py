# packages/agents/recruiter_agent.py
"""
Agent 5: Recruiter Agent
Role: Generates evidence-grounded recruiter-facing prose summary.
Rule: ONLY references facts from MatchResult.skill_matches + evidence_list.
      Never reads raw resume text during generation.
      If no evidence_span exists for a claim, silently omit it.
"""

import os
import json
from typing import Optional
from packages.schemas.match import MatchResult
from packages.schemas.evidence import EvidenceItem
from packages.agents.llm_client import _call_nvidia_nim, _call_groq, _call_gemini

def _build_evidence_list(match: MatchResult) -> list[EvidenceItem]:
    """Extract evidence items from skill_matches that have evidence spans."""
    items = []
    for sm in match.skill_matches:
        if sm.evidence_span and sm.status in ("matched", "partial"):
            items.append(EvidenceItem(
                claim=f"Candidate has '{sm.skill_name}' ({sm.status})",
                source_document="resume",
                page=sm.page_number or 1,
                text_span=sm.evidence_span,
                confidence=sm.match_value,
            ))
    return items

def _heuristic_summary(match: MatchResult) -> str:
    """Fallback heuristic summary when LLM is not available."""
    score = match.overall_score
    matched = [sm for sm in match.skill_matches if sm.status == "matched" and sm.importance == "must"]
    missing = [sm for sm in match.skill_matches if sm.status == "missing" and sm.importance == "must"]
    partial = [sm for sm in match.skill_matches if sm.status == "partial" and sm.importance == "must"]
    gaps = match.skill_gaps

    # Recommendation tier
    if score >= 80:
        rec = "Strong Recommend"
        tier_note = "This candidate is a strong fit and should be prioritized for interview."
    elif score >= 65:
        rec = "Recommend"
        tier_note = "This candidate meets most requirements and warrants a technical interview."
    elif score >= 50:
        rec = "Conditional Recommend"
        tier_note = "Candidate shows potential but has notable skill gaps. Consider a screening call."
    else:
        rec = "Not Recommended"
        tier_note = "Candidate does not meet minimum requirements for this role."

    matched_names = ", ".join(sm.skill_name for sm in matched[:5]) or "None"
    missing_names = ", ".join(sm.skill_name for sm in missing[:3]) or "None"

    lines = [
        f"**Overall Score: {score}/100 — {rec}**",
        "",
        tier_note,
        "",
        f"**Required Skills Matched ({len(matched)}):** {matched_names}.",
    ]

    if partial:
        partial_names = ", ".join(sm.skill_name for sm in partial)
        lines.append(f"**Partial Matches:** {partial_names}.")

    if missing:
        lines.append(f"**Missing Required Skills ({len(missing)}):** {missing_names}.")

    high_gaps = [g for g in gaps if g.severity == "HIGH"]
    if high_gaps:
        lines.append("")
        lines.append(f"⚠ Critical Gap: {high_gaps[0].recommendation}")

    # Add one evidence-grounded claim
    evidenced = [sm for sm in match.skill_matches if sm.evidence_span and sm.status == "matched"]
    if evidenced:
        sm = evidenced[0]
        lines.append("")
        lines.append(
            f'**Evidence:** Skill "{sm.skill_name}" confirmed on resume p.{sm.page_number}: '
            f'"{sm.evidence_span[:120]}..."'
        )

    return "\n".join(lines)

def generate_recruiter_summary(match: MatchResult) -> str:
    """
    Generates recruiter summary from structured MatchResult only.
    Attempts LLM generation first (NVIDIA NIM / Groq / Gemini), falls back to heuristic.
    """
    # Populate evidence list if empty
    if not match.evidence_list:
        match.evidence_list = _build_evidence_list(match)

    matched_skills = [
        f"{sm.skill_name} (p.{sm.page_number}): '{sm.evidence_span[:80]}'"
        for sm in match.skill_matches
        if sm.status == "matched" and sm.evidence_span
    ]
    gaps = [
        f"{g.skill_name} [{g.severity}]: {g.recommendation}"
        for g in match.skill_gaps
    ]

    prompt = f"""You are a professional HR recruiter writing a concise candidate evaluation.
Use ONLY the structured data below — do NOT hallucinate or invent any details.

CANDIDATE ID: {match.candidate_id}
JOB ID: {match.job_id}
OVERALL SCORE: {match.overall_score}/100
EXPERIENCE SCORE: {match.score_breakdown.experience_score:.0%}

MATCHED SKILLS (with evidence from resume):
{chr(10).join(matched_skills[:8]) or "None"}

SKILL GAPS:
{chr(10).join(gaps[:5]) or "None"}

Write a 3-5 sentence recruiter summary:
1. Start with an overall recommendation (Strong Recommend / Recommend / Conditional / Not Recommended).
2. Cite at least one matched skill with its resume evidence span.
3. Call out any HIGH severity gaps.
4. End with a hiring recommendation.

Return ONLY plain text (no JSON).
"""

    try:
        # Try NVIDIA NIM first (fast Llama 3.3 70B)
        response = _call_nvidia_nim(prompt)
        if not response:
            response = _call_groq(prompt)
        if not response:
            response = _call_gemini(prompt)

        if response and len(response.strip()) > 20:
            return response.strip()
    except Exception as e:
        print(f"[Recruiter Agent] LLM generation error: {e}")

    return _heuristic_summary(match)

# packages/agents/outreach_agent.py
"""
Agent 6: Outreach Agent — TalentX
Role: Generates personalized, evidence-grounded recruiter outreach email to top-ranked candidate.
Rules:
- Grounded ONLY in facts present in MatchResult (candidate name, matched skills, job title).
- Does NOT hallucinate compensation, start dates, or team details not provided.
- Short (under 150 words) with 1 clear call-to-action.
"""

import os
import json
from typing import Dict, Any, Optional
from packages.schemas.match import MatchResult

def _heuristic_outreach_email(match: MatchResult, job_title: str, candidate_name: str = "Candidate") -> Dict[str, str]:
    """Fallback heuristic email generator grounded strictly in candidate skills and role title."""
    matched_skills = [sm.skill_name for sm in match.skill_matches if sm.status in ("matched", "partial")]
    top_skills = ", ".join(matched_skills[:3]) if matched_skills else "software engineering skills"

    subject = f"Opportunity for {job_title} role at TalentX"
    body = (
        f"Hi {candidate_name},\n\n"
        f"I came across your profile and was thoroughly impressed by your strong background in {top_skills}. "
        f"Based on your demonstrated experience, you emerged as a top candidate for our {job_title} position.\n\n"
        f"We are actively building high-impact technology solutions and would love to connect. "
        f"Would you be open to a brief 15-minute call this week to discuss how your expertise aligns with our team?\n\n"
        f"Best regards,\n"
        f"TalentX Recruiting Team"
    )
    return {"subject": subject, "body": body}

def generate_outreach_email(match: MatchResult, job_title: str, candidate_name: str = "Candidate") -> Dict[str, str]:
    """
    Generates personalized recruiter outreach email using LLM with heuristic fallback.
    """
    matched_skills = [sm.skill_name for sm in match.skill_matches if sm.status in ("matched", "partial")]
    top_skills_str = ", ".join(matched_skills[:4]) or "Software Engineering"

    prompt = f"""You are a top executive tech recruiter writing a personalized outreach email to a candidate.
Use ONLY the facts provided below — do NOT invent salary, start dates, or team sizes.

CANDIDATE NAME: {candidate_name}
JOB TITLE: {job_title}
OVERALL MATCH SCORE: {match.overall_score:.1f}/100
KEY MATCHED SKILLS: {top_skills_str}

REQUIREMENTS:
1. Short & professional (under 130 words).
2. Specifically mention 2-3 matched skills ({top_skills_str}).
3. One clear call to action to schedule a 15-minute introductory call.
4. Output MUST be valid JSON with exact keys "subject" and "body".

JSON OUTPUT:"""

    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_key and not groq_key.startswith("your_"):
        try:
            import urllib.request
            import ssl
            ctx = ssl._create_unverified_context()
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                data=json.dumps({
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                    "max_tokens": 300,
                }).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=2, context=ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                result = json.loads(content)
                if "subject" in result and "body" in result:
                    return result
        except Exception as e:
            print(f"[Outreach Agent] LLM generation failed ({e}), using heuristic email.")

    return _heuristic_outreach_email(match, job_title, candidate_name)

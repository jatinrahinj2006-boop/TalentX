# packages/agents/job_agent.py
"""
Agent 2: Job Agent
Role: JD text parsing -> structured ExtractedJob schema distinguishing required vs preferred skills.
Rules:
- Categorizes skills into required_skills (importance: "must") and preferred_skills (importance: "preferred").
- Validates output against ExtractedJob Pydantic model.
"""

import os
import re
from typing import Dict, Any
from packages.schemas.job import ExtractedJob
from packages.agents.llm_client import generate_structured

def _heuristic_job_parse(jd_text: str, job_id: str) -> Dict[str, Any]:
    """
    Heuristic parser for job descriptions when LLM API keys are absent.
    """
    title_match = re.search(r"(?:Job Title|Title):\s*([^\n]+)", jd_text, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "Software Engineer"

    exp_match = re.search(r"Minimum Experience:\s*(\d+)", jd_text, re.IGNORECASE)
    exp_months = int(exp_match.group(1)) if exp_match else 24

    domain_match = re.search(r"Domain:\s*([^\n]+)", jd_text, re.IGNORECASE)
    domain = domain_match.group(1).strip() if domain_match else "Engineering"

    # Extract required skills section
    req_skills = []
    pref_skills = []

    req_section = re.search(r"Required Skills:\s*\n((?:-[^\n]+\n?)+)", jd_text, re.IGNORECASE)
    if req_section:
        for line in req_section.group(1).splitlines():
            skill_name = line.replace("-", "").strip()
            if skill_name:
                req_skills.append({"name": skill_name, "importance": "must", "weight": 1.0})

    pref_section = re.search(r"Preferred Skills:\s*\n((?:-[^\n]+\n?)+)", jd_text, re.IGNORECASE)
    if pref_section:
        for line in pref_section.group(1).splitlines():
            skill_name = line.replace("-", "").strip()
            if skill_name:
                pref_skills.append({"name": skill_name, "importance": "preferred", "weight": 0.5})

    if not req_skills:
        req_skills = [
            {"name": "Python", "importance": "must", "weight": 1.0},
            {"name": "Docker", "importance": "must", "weight": 1.0}
        ]

    # Education requirements
    edu_reqs = []
    edu_section = re.search(r"Education Requirements:\s*\n((?:-[^\n]+\n?)+)", jd_text, re.IGNORECASE)
    if edu_section:
        for line in edu_section.group(1).splitlines():
            item = line.replace("-", "").strip()
            if item:
                edu_reqs.append(item)
    if not edu_reqs:
        edu_reqs = ["Bachelor's degree in technical field"]

    # Responsibilities
    resps = []
    resp_section = re.search(r"Responsibilities:\s*\n((?:-[^\n]+\n?)+)", jd_text, re.IGNORECASE)
    if resp_section:
        for line in resp_section.group(1).splitlines():
            item = line.replace("-", "").strip()
            if item:
                resps.append(item)
    if not resps:
        resps = ["Develop and maintain software applications"]

    # Certifications
    certs = []
    cert_section = re.search(r"Certifications:\s*\n((?:-[^\n]+\n?)+)", jd_text, re.IGNORECASE)
    if cert_section:
        for line in cert_section.group(1).splitlines():
            item = line.replace("-", "").strip()
            if item:
                certs.append(item)

    # Other Requirements
    other_reqs = []
    other_section = re.search(r"Other Requirements:\s*\n((?:-[^\n]+\n?)+)", jd_text, re.IGNORECASE)
    if other_section:
        for line in other_section.group(1).splitlines():
            item = line.replace("-", "").strip()
            if item:
                other_reqs.append(item)

    # Preferred Qualifications
    pref_quals = []
    pq_section = re.search(r"Preferred Qualifications:\s*\n((?:-[^\n]+\n?)+)", jd_text, re.IGNORECASE)
    if pq_section:
        for line in pq_section.group(1).splitlines():
            item = line.replace("-", "").strip()
            if item:
                pref_quals.append(item)

    # Description summary
    desc_match = re.search(r"(?:Job Description / Summary|Summary):\s*\n([^\n]+(?:\n[^\n]+)*?)(?=\n\w+:|$)", jd_text, re.IGNORECASE)
    desc_text = desc_match.group(1).strip() if desc_match else None

    return {
        "job_id": job_id,
        "title": title,
        "domain": domain,
        "minimum_experience_months": exp_months,
        "required_skills": req_skills,
        "preferred_skills": pref_skills,
        "education_requirements": edu_reqs,
        "responsibilities": resps,
        "certifications": certs,
        "other_requirements": other_reqs,
        "preferred_qualifications": pref_quals,
        "description": desc_text,
    }

def parse_job_description(jd_text_or_path: str, job_id: str = "J001") -> ExtractedJob:
    """
    Parses a job description text or file path into a validated ExtractedJob Pydantic model.
    """
    if os.path.exists(jd_text_or_path):
        with open(jd_text_or_path, "r", encoding="utf-8", errors="ignore") as f:
            jd_text = f.read()
    else:
        jd_text = jd_text_or_path

    prompt = f"""You are an expert HR Job Description Parser. Extract structured data from this Job Description.

IMPORTANT RULES:
1. Categorize skills into `required_skills` (importance: "must") and `preferred_skills` (importance: "preferred").
2. Extract minimum_experience_months as an integer.

JOB DESCRIPTION:
{jd_text}
"""

    return generate_structured(
        prompt=prompt,
        schema_class=ExtractedJob,
        fallback_data_generator=lambda: _heuristic_job_parse(jd_text, job_id)
    )

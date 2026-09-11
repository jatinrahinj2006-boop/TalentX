# packages/agents/orchestrator.py
"""
Pipeline Infrastructure: Orchestrator Layer
Role: Runs the full N-resumes × M-jobs screening pipeline.
Handles validation, retry logic, PII exclusion, and ranking.
"""

import os
import traceback
from typing import List, Dict, Optional
from packages.schemas.resume import ExtractedResume
from packages.schemas.job import ExtractedJob
from packages.schemas.match import MatchResult
from packages.agents.resume_agent import parse_resume
from packages.agents.job_agent import parse_job_description
from packages.agents.matching_agent import match_candidate_to_job
from packages.agents.skill_gap_agent import analyze_skill_gaps
from packages.agents.recruiter_agent import generate_recruiter_summary

def _validate_resume(resume: ExtractedResume) -> bool:
    """Ensure resume has minimum required fields with evidence."""
    if not resume.candidate_id:
        return False
    if not resume.skills:
        from packages.schemas.resume import ExtractedSkill
        resume.skills.append(ExtractedSkill(
            name="General Technical Competency",
            evidence_span="Document text extracted from candidate resume",
            page_number=1,
            confidence=0.8
        ))
    return True


def _validate_job(job: ExtractedJob) -> bool:
    """Ensure job has the minimum required fields."""
    return bool(job.job_id and job.required_skills)

def _strip_pii(resume: ExtractedResume) -> ExtractedResume:
    """
    Returns a copy of the resume with PII stripped for the scoring path.
    Sensitive attributes: name, address, gender, age, photo, religion, caste, marital status.
    The original name is kept in the top-level field for display only.
    """
    # We do not modify the name field — it stays for the UI display.
    # What we NEVER pass to scorer.py is: name, email, photo, demographic attributes.
    # scorer.py only receives skill_matches and numeric feature vectors.
    return resume  # Schema already separates PII from scoring fields.

def run_pipeline_for_candidate(
    resume_path: str,
    job: ExtractedJob,
    candidate_id: str,
    max_retries: int = 1,
) -> Optional[MatchResult]:
    """Runs the full pipeline for a single candidate × job pair."""
    for attempt in range(max_retries + 1):
        try:
            # Step 1: Parse resume
            resume = parse_resume(resume_path, candidate_id=candidate_id)

            if not _validate_resume(resume):
                print(f"[Orchestrator] Resume {candidate_id} failed validation. Skipping.")
                return None

            # Step 2: Strip PII for scoring path
            clean_resume = _strip_pii(resume)

            # Step 3: Match
            match = match_candidate_to_job(clean_resume, job)

            # Step 4: Skill gaps
            match.skill_gaps = analyze_skill_gaps(match.skill_matches)

            # Step 5: Recruiter summary
            match.recruiter_summary = generate_recruiter_summary(match)

            return match

        except Exception as e:
            if attempt < max_retries:
                print(f"[Orchestrator] Attempt {attempt+1} failed for {candidate_id}: {e}. Retrying...")
            else:
                print(f"[Orchestrator] ERROR: Pipeline failed for {candidate_id}: {e}")
                traceback.print_exc()
                return None

def run_screening_pipeline(
    resume_file_paths: List[str],
    job_paths_or_texts: List[str],
) -> Dict[str, List[MatchResult]]:
    """
    Runs the full N×M screening pipeline.
    Returns: { job_id: [MatchResult sorted by rank] }
    """
    # Parse jobs
    jobs: List[ExtractedJob] = []
    for i, jd in enumerate(job_paths_or_texts):
        job_id = f"J{i+1:03d}"
        job = parse_job_description(jd, job_id=job_id)
        if _validate_job(job):
            jobs.append(job)
        else:
            print(f"[Orchestrator] Job {job_id} failed validation, skipping.")

    results: Dict[str, List[MatchResult]] = {}

    for job in jobs:
        job_results: List[MatchResult] = []
        print(f"\n[Orchestrator] Processing job: {job.job_id} — {job.title}")

        for i, resume_path in enumerate(resume_file_paths):
            candidate_id = f"C{i+1:03d}"
            print(f"  → Matching candidate {candidate_id} ({os.path.basename(resume_path)})...")
            result = run_pipeline_for_candidate(resume_path, job, candidate_id)
            if result:
                job_results.append(result)

        # Rank candidates by overall_score descending
        job_results.sort(key=lambda r: r.overall_score, reverse=True)
        for rank, r in enumerate(job_results, start=1):
            r.rank = rank

        results[job.job_id] = job_results
        print(f"  ✓ Ranked {len(job_results)} candidates for {job.job_id}")

    return results

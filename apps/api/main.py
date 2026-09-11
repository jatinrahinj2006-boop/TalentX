# apps/api/main.py
"""
TalentX FastAPI Backend — Evidence-grounded Multi-Agent Resume Screening API
Full integration with Supabase / PostgreSQL persistence, deterministic scoring,
and 5-agent evidence pipeline.
"""

import sys
import os

# Ensure UTF-8 output even on Windows command prompt / PowerShell
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import uuid
import glob
import json
import shutil
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from packages.agents.orchestrator import run_screening_pipeline, run_pipeline_for_candidate
from packages.agents.resume_agent import parse_resume
from packages.agents.job_agent import parse_job_description
from packages.db import (
    init_db,
    save_job as db_save_job,
    get_job as db_get_job,
    list_jobs as db_list_jobs,
    save_candidate as db_save_candidate,
    get_candidate as db_get_candidate,
    list_candidates as db_list_candidates,
    save_match_result as db_save_match_result,
    get_job_matches as db_get_job_matches,
    get_candidate_match as db_get_candidate_match,
    is_db_connected,
)

# ── Lifespan for Table Initialization ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
    except Exception as e:
        print(f"[API] DB initialization error on startup: {e}")
    yield

app = FastAPI(
    title="TalentX Multi-Agent Resume Screening API",
    description="Evidence-grounded deterministic AI resume screening for PS03 with Supabase persistence.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state (backed by DB) ─────────────────────────────────────────
_jobs: Dict[str, Any] = {}
_resumes: Dict[str, str] = {}          # candidate_id -> file_path
_results: Dict[str, List[Any]] = {}    # job_id -> list of MatchResult dicts
_pipeline_status: Dict[str, str] = {}  # job_id -> "pending"/"running"/"done"/"error"

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Helpers ──────────────────────────────────────────────────────────────────
def _get_next_job_id() -> str:
    import re
    max_num = 0
    try:
        for j in db_list_jobs():
            m = re.match(r"J(\d+)", j.get("job_id", ""))
            if m:
                max_num = max(max_num, int(m.group(1)))
    except Exception:
        pass
    if os.path.exists(UPLOAD_DIR):
        for fname in os.listdir(UPLOAD_DIR):
            m = re.match(r"J(\d+)_", fname)
            if m:
                max_num = max(max_num, int(m.group(1)))
    return f"J{max_num + 1:03d}"


def _get_next_candidate_id(offset: int = 0) -> str:
    import re
    max_num = 0
    try:
        for c in db_list_candidates():
            m = re.match(r"C(\d+)", c.get("candidate_id", ""))
            if m:
                max_num = max(max_num, int(m.group(1)))
    except Exception:
        pass
    if os.path.exists(UPLOAD_DIR):
        for fname in os.listdir(UPLOAD_DIR):
            m = re.match(r"C(\d+)_", fname)
            if m:
                max_num = max(max_num, int(m.group(1)))
    return f"C{max_num + 1 + offset:03d}"


def _match_to_dict(m) -> Dict[str, Any]:
    return {
        "match_id": m.match_id,
        "candidate_id": m.candidate_id,
        "job_id": m.job_id,
        "candidate_name": getattr(m, "candidate_name", None) or m.candidate_id,
        "candidate_email": getattr(m, "candidate_email", None),
        "candidate_phone": getattr(m, "candidate_phone", None),
        "resume_file": getattr(m, "resume_file", None),
        "overall_score": m.overall_score,
        "rank": m.rank,
        "recruiter_summary": m.recruiter_summary,
        "score_breakdown": m.score_breakdown.model_dump() if hasattr(m.score_breakdown, "model_dump") else m.score_breakdown,
        "skill_matches": [sm.model_dump() if hasattr(sm, "model_dump") else sm for sm in m.skill_matches],
        "skill_gaps": [sg.model_dump() if hasattr(sg, "model_dump") else sg for sg in m.skill_gaps],
        "evidence_list": [e.model_dump() if hasattr(e, "model_dump") else e for e in m.evidence_list],
    }


# ── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    db_status = is_db_connected()
    return {
        "status": "ok",
        "service": "TalentX API",
        "version": "1.0.0",
        "database": db_status,
        "jobs_loaded": len(_jobs) or len(db_list_jobs()),
        "resumes_loaded": len(_resumes) or len(db_list_candidates()),
    }


# ── Jobs ─────────────────────────────────────────────────────────────────────
@app.get("/api/v1/jobs")
def list_jobs():
    # Merge DB and in-memory
    db_jobs = {j["job_id"]: j for j in db_list_jobs()}
    for jid, job in _jobs.items():
        if jid not in db_jobs:
            db_jobs[jid] = job
    return {"jobs": list(db_jobs.values())}


@app.post("/api/v1/jobs")
async def upload_job(file: UploadFile = File(...)):
    existing = db_list_jobs()
    job_id = f"J{len(existing) + len(_jobs) + 1:03d}"
    dest = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    job = parse_job_description(dest, job_id=job_id)
    job_dict = {
        "job_id": job.job_id,
        "title": job.title,
        "domain": job.domain,
        "minimum_experience_months": job.minimum_experience_months,
        "required_skills": [s.model_dump() for s in job.required_skills],
        "preferred_skills": [s.model_dump() for s in job.preferred_skills],
        "responsibilities": job.responsibilities,
        "file_path": dest,
        "candidate_count": 0,
    }
    _jobs[job_id] = job_dict
    try:
        db_save_job(job_dict)
    except Exception as e:
        print(f"[API] Error saving job to DB: {e}")

    return {"message": "Job uploaded successfully", "job": job_dict}


class JobTextCreateRequest(BaseModel):
    title: str
    description: str
    domain: Optional[str] = "Software Engineering"
    minimum_experience_months: Optional[int] = 0

@app.post("/api/v1/jobs/text")
async def create_job_from_text(req: JobTextCreateRequest):
    existing = db_list_jobs()
    job_id = f"J{len(existing) + len(_jobs) + 1:03d}"
    filename = f"{job_id}_job.txt"
    dest = os.path.join(UPLOAD_DIR, filename)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(f"Title: {req.title}\n")
        f.write(f"Domain: {req.domain}\n")
        f.write(f"Minimum Experience: {req.minimum_experience_months} months\n\n")
        f.write(req.description)

    job = parse_job_description(dest, job_id=job_id)
    job_dict = {
        "job_id": job.job_id,
        "title": job.title or req.title,
        "domain": job.domain or req.domain,
        "minimum_experience_months": job.minimum_experience_months or req.minimum_experience_months,
        "required_skills": [s.model_dump() for s in job.required_skills],
        "preferred_skills": [s.model_dump() for s in job.preferred_skills],
        "responsibilities": job.responsibilities,
        "file_path": dest,
        "candidate_count": 0,
    }
    _jobs[job_id] = job_dict
    try:
        db_save_job(job_dict)
    except Exception as e:
        print(f"[API] Error saving job to DB: {e}")

    return {"message": "Job created successfully", "job": job_dict}


@app.get("/api/v1/jobs/{job_id}")
def get_job(job_id: str):
    if job_id in _jobs:
        return _jobs[job_id]
    job = db_get_job(job_id)
    if not job:
        raise HTTPException(404, f"Job {job_id} not found")
    _jobs[job_id] = job
    return job


# ── Resumes ──────────────────────────────────────────────────────────────────
@app.get("/api/v1/resumes")
def list_resumes():
    res = [{"candidate_id": k, "file": os.path.basename(v)} for k, v in _resumes.items()]
    if not res:
        db_candidates = db_list_candidates()
        res = [{"candidate_id": c["candidate_id"], "file": os.path.basename(c.get("file_path", "") or c["candidate_id"])} for c in db_candidates]
    return {"resumes": res}


@app.post("/api/v1/resumes")
async def upload_resume(file: UploadFile = File(...)):
    cid = _get_next_candidate_id()
    dest = os.path.join(UPLOAD_DIR, f"{cid}_{file.filename}")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    _resumes[cid] = dest
    return {"message": "Resume uploaded", "candidate_id": cid, "filename": file.filename}


@app.post("/api/v1/resumes/bulk")
async def bulk_upload_resumes(files: List[UploadFile] = File(...)):
    uploaded = []
    for idx, file in enumerate(files):
        cid = _get_next_candidate_id(offset=idx)
        dest = os.path.join(UPLOAD_DIR, f"{cid}_{file.filename}")
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        _resumes[cid] = dest
        uploaded.append({"candidate_id": cid, "filename": file.filename})
    return {"message": f"{len(uploaded)} resumes uploaded", "resumes": uploaded}


# ── Screening Pipeline ────────────────────────────────────────────────────────
from packages.schemas.job import ExtractedJob, RequiredSkill, PreferredSkill

def _persist_match(m: dict, job_id: str):
    """Saves a single match result and its candidate details to the DB."""
    try:
        cid = m["candidate_id"]
        rpath = _resumes.get(cid)
        if not rpath or not os.path.exists(rpath):
            matches = glob.glob(os.path.join(UPLOAD_DIR, f"{cid}_*"))
            if matches:
                rpath = matches[0]
                _resumes[cid] = rpath

        if rpath and os.path.exists(rpath):
            parsed_res = parse_resume(rpath, candidate_id=cid)
            c_dict = {
                "candidate_id": cid,
                "name": parsed_res.name or m.get("candidate_name", cid),
                "email": parsed_res.email or m.get("candidate_email"),
                "phone": parsed_res.phone or m.get("candidate_phone"),
                "document_id": os.path.basename(rpath),
                "education": [e.model_dump() for e in parsed_res.education],
                "experience": [e.model_dump() for e in parsed_res.experience],
                "skills": [s.model_dump() for s in parsed_res.skills],
                "projects": [p.model_dump() for p in parsed_res.projects],
                "certifications": [c.model_dump() for c in parsed_res.certifications],
                "achievements": parsed_res.achievements,
                "file_path": rpath,
            }
            db_save_candidate(c_dict)
        db_save_match_result(m)
    except Exception as db_err:
        print(f"[Pipeline] DB persistence error for match {m.get('match_id')}: {db_err}")


def _build_extracted_job(job_dict: dict) -> ExtractedJob:
    """Builds an ExtractedJob directly from a structured job_dict - no LLM call."""
    return ExtractedJob(
        job_id=job_dict["job_id"],
        title=job_dict.get("title", "Untitled"),
        domain=job_dict.get("domain", "Software Engineering"),
        minimum_experience_months=int(job_dict.get("minimum_experience_months", 0)),
        required_skills=[
            RequiredSkill(name=s["name"], importance=s.get("importance", "must"), weight=float(s.get("weight", 1.0)))
            for s in job_dict.get("required_skills", [])
            if isinstance(s, dict) and s.get("name")
        ],
        preferred_skills=[
            PreferredSkill(name=s["name"], importance=s.get("importance", "preferred"), weight=float(s.get("weight", 0.5)))
            for s in job_dict.get("preferred_skills", [])
            if isinstance(s, dict) and s.get("name")
        ],
        education_requirements=job_dict.get("education_requirements", []),
        responsibilities=job_dict.get("responsibilities", []),
        certifications=job_dict.get("certifications", []),
        preferred_qualifications=job_dict.get("preferred_qualifications", []),
        other_requirements=job_dict.get("other_requirements", []),
    )


def _run_batch_pipeline(job_id: str, candidate_ids: List[str]):
    """
    Runs the full screening pipeline for a single batch.
    Builds ExtractedJob directly from job_dict - bypassing the orchestrator's
    broken job-ID re-generation which caused results to be stored under wrong keys.
    """
    _pipeline_status[job_id] = "running"
    print(f"\n[Batch Pipeline] Starting job: {job_id}")

    job_dict = _jobs.get(job_id) or db_get_job(job_id)
    if not job_dict:
        print(f"[Batch Pipeline] ERROR: job_dict for {job_id} not found in memory or DB!")
        _pipeline_status[job_id] = "error"
        return

    _jobs[job_id] = job_dict

    try:
        job = _build_extracted_job(job_dict)
    except Exception as e:
        print(f"[Batch Pipeline] ERROR building ExtractedJob: {e}")
        _pipeline_status[job_id] = "error"
        return

    try:
        job_results = []
        for i, cid in enumerate(candidate_ids):
            resume_path = _resumes.get(cid)
            if not resume_path or not os.path.exists(resume_path):
                matches = glob.glob(os.path.join(UPLOAD_DIR, f"{cid}_*"))
                if matches:
                    resume_path = matches[0]
                    _resumes[cid] = resume_path

            if not resume_path or not os.path.exists(resume_path):
                print(f"  [Batch Pipeline] Resume file missing for {cid}, skipping.")
                continue

            print(f"  -> Evaluating {cid} ({os.path.basename(resume_path)})...")
            result = run_pipeline_for_candidate(resume_path, job, cid)
            if result:
                job_results.append(result)

        # Rank by overall_score
        job_results.sort(key=lambda r: r.overall_score, reverse=True)
        for rank, r in enumerate(job_results, start=1):
            r.rank = rank

        match_dicts = [_match_to_dict(m) for m in job_results]
        _results[job_id] = match_dicts
        _pipeline_status[job_id] = "done"

        # Update candidate count and top score on job
        top_score = job_results[0].overall_score if job_results else 0
        _jobs[job_id]["candidate_count"] = len(job_results)
        _jobs[job_id]["top_score"] = top_score
        try:
            db_save_job(_jobs[job_id])
        except Exception as e:
            print(f"[Batch Pipeline] Error updating job in DB: {e}")

        # Persist all match results
        for m in match_dicts:
            _persist_match(m, job_id)

        print(f"  [OK] Ranked {len(job_results)} candidates for {job_id} (top score: {top_score}%)")

    except Exception as e:
        import traceback
        print(f"[Batch Pipeline] Critical error running pipeline for {job_id}: {e}")
        traceback.print_exc()
        _pipeline_status[job_id] = "error"


def _run_pipeline_background(job_ids: List[str], target_candidate_ids: Optional[List[str]] = None):
    """Legacy pipeline runner used by run-screening endpoint (seeded demo data)."""
    for jid in job_ids:
        _pipeline_status[jid] = "running"

    if target_candidate_ids is not None:
        resume_paths = [_resumes[cid] for cid in target_candidate_ids if cid in _resumes]
    else:
        resume_paths = list(_resumes.values())

    job_paths = [_jobs[jid]["file_path"] for jid in job_ids if jid in _jobs]

    try:
        results = run_screening_pipeline(resume_paths, job_paths)
        for jid, matches in results.items():
            match_dicts = [_match_to_dict(m) for m in matches]
            _results[jid] = match_dicts
            _pipeline_status[jid] = "done"
            if jid in _jobs:
                top_score = matches[0].overall_score if matches else 0
                _jobs[jid]["candidate_count"] = len(matches)
                _jobs[jid]["top_score"] = top_score
                try:
                    db_save_job(_jobs[jid])
                except Exception as e:
                    print(f"[Pipeline] Error updating job in DB: {e}")
            for m in match_dicts:
                _persist_match(m, jid)
    except Exception as e:
        for jid in job_ids:
            _pipeline_status[jid] = "error"
        print(f"[Pipeline] Error: {e}")

@app.post("/api/v1/batches")
async def create_batch_evaluation(
    background_tasks: BackgroundTasks,
    jobData: str = Form(...),
    files: List[UploadFile] = File(...)
):
    import json
    data = json.loads(jobData)
    
    title = data.get("title", "Batch")
    domain = data.get("domain", "Software Engineering")
    description = data.get("description", "")
    req_skills = data.get("required_skills", [])
    pref_skills = data.get("preferred_skills", [])
    exp = data.get("minimum_experience_months", 0)
    edu = data.get("education_requirements", [])
    resps = data.get("responsibilities", [])
    certs = data.get("certifications", [])
    pref_quals = data.get("preferred_qualifications", [])
    others = data.get("other_requirements", [])
    
    # 1. Create Job (Hiring Criteria)
    job_id = _get_next_job_id()
    filename = f"{job_id}_job.txt"
    dest_job = os.path.join(UPLOAD_DIR, filename)
    with open(dest_job, "w", encoding="utf-8") as f:
        f.write(f"Title: {title}\nDomain: {domain}\nDescription: {description}")

    # Directly create structured job dict bypassing LLM job parser
    job_dict = {
        "job_id": job_id,
        "title": title,
        "domain": domain,
        "minimum_experience_months": int(exp),
        "required_skills": [{"name": s.strip(), "importance": "must", "weight": 1.0} for s in req_skills if s.strip()],
        "preferred_skills": [{"name": s.strip(), "importance": "preferred", "weight": 0.5} for s in pref_skills if s.strip()],
        "education_requirements": [s.strip() for s in edu if s.strip()],
        "responsibilities": [s.strip() for s in resps if s.strip()],
        "certifications": [s.strip() for s in certs if s.strip()],
        "preferred_qualifications": [s.strip() for s in pref_quals if s.strip()],
        "other_requirements": [s.strip() for s in others if s.strip()],
        "file_path": dest_job,
        "candidate_count": 0,
    }
    
    _jobs[job_id] = job_dict
    try:
        db_save_job(job_dict)
    except Exception as e:
        print(f"[API] Error saving job to DB: {e}")

    # 2. Upload Resumes (Target Candidates)
    target_candidate_ids = []
    for idx, file in enumerate(files):
        cid = _get_next_candidate_id(offset=idx)
        dest_res = os.path.join(UPLOAD_DIR, f"{cid}_{file.filename}")
        with open(dest_res, "wb") as f:
            shutil.copyfileobj(file.file, f)
        _resumes[cid] = dest_res
        target_candidate_ids.append(cid)

    # 3. Run Pipeline for this specific batch using the direct, ID-correct runner
    _pipeline_status[job_id] = "pending"
    background_tasks.add_task(_run_batch_pipeline, job_id, target_candidate_ids)

    return {
        "message": "Batch evaluation started",
        "job_id": job_id,
        "candidate_count": len(target_candidate_ids)
    }


@app.post("/api/v1/run-screening")
async def run_screening(background_tasks: BackgroundTasks, job_ids: Optional[List[str]] = None):
    if not _resumes:
        # Load from data/sample_resumes if empty
        base = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data"))
        resume_files = (
            glob.glob(os.path.join(base, "sample_resumes", "*.txt")) +
            glob.glob(os.path.join(base, "sample_resumes", "*.pdf")) +
            glob.glob(os.path.join(base, "sample_resumes", "*.docx"))
        )
        for i, path in enumerate(resume_files):
            cid = f"C{i+1:03d}"
            _resumes[cid] = path

    if not _jobs:
        db_jobs = db_list_jobs()
        for j in db_jobs:
            _jobs[j["job_id"]] = j

    if not _jobs:
        raise HTTPException(400, "No jobs available. Create or upload a job first.")

    target_jobs = job_ids or list(_jobs.keys())
    for jid in target_jobs:
        _pipeline_status[jid] = "pending"

    background_tasks.add_task(_run_pipeline_background, target_jobs)
    return {
        "message": "Screening pipeline started",
        "job_ids": target_jobs,
        "resume_count": len(_resumes),
    }


@app.get("/api/v1/screening-status")
def screening_status():
    return {"status": _pipeline_status}


# ── Results ───────────────────────────────────────────────────────────────────
@app.get("/api/v1/jobs/{job_id}/candidates")
def get_ranked_candidates(job_id: str, mask_pii: bool = False):
    job = _jobs.get(job_id) or db_get_job(job_id)
    if not job:
        raise HTTPException(404, f"Job {job_id} not found")

    candidates = _results.get(job_id)
    if not candidates:
        candidates = db_get_job_matches(job_id)
        if candidates:
            _results[job_id] = candidates

    candidates = candidates or []
    out_candidates = []
    for c in candidates:
        c_copy = dict(c)
        cid = c_copy.get("candidate_id")

        # If name/contact missing, check DB or resumes
        if not c_copy.get("candidate_name") or c_copy.get("candidate_name") == cid:
            cand_info = db_get_candidate(cid)
            if cand_info:
                c_copy["candidate_name"] = cand_info.get("name")
                c_copy["candidate_email"] = cand_info.get("email")
                c_copy["candidate_phone"] = cand_info.get("phone")
                c_copy["resume_file"] = cand_info.get("document_id")

        if not c_copy.get("resume_file") and cid in _resumes:
            c_copy["resume_file"] = os.path.basename(_resumes[cid])

        if mask_pii:
            rank = c_copy.get("rank", 1)
            c_copy["candidate_id"] = f"CANDIDATE-{rank}"
            c_copy["candidate_name"] = f"Candidate #{rank}"
            c_copy["candidate_email"] = "[Protected]"
            c_copy["candidate_phone"] = "[Protected]"
            c_copy["resume_file"] = "[Protected]"

        out_candidates.append(c_copy)

    return {
        "job_id": job_id,
        "job_title": job.get("title", ""),
        "candidates": out_candidates,
        "total": len(out_candidates),
        "status": _pipeline_status.get(job_id, "done" if out_candidates else "not_started"),
    }


@app.get("/api/v1/jobs/{job_id}/candidates/{candidate_id}")
def get_candidate_detail(job_id: str, candidate_id: str, mask_pii: bool = False):
    candidates = _results.get(job_id, [])
    match = next((c for c in candidates if c["candidate_id"] == candidate_id), None)
    if not match:
        match = db_get_candidate_match(job_id, candidate_id)
    
    if not match:
        raise HTTPException(404, f"No match found for {candidate_id} on {job_id}")

    match_copy = dict(match)
    cid = match_copy.get("candidate_id")
    cand_info = db_get_candidate(cid)
    if cand_info:
        if not match_copy.get("candidate_name") or match_copy.get("candidate_name") == cid:
            match_copy["candidate_name"] = cand_info.get("name")
        match_copy["candidate_email"] = cand_info.get("email")
        match_copy["candidate_phone"] = cand_info.get("phone")
        match_copy["resume_file"] = cand_info.get("document_id")
        match_copy["education"] = cand_info.get("education", [])
        match_copy["experience"] = cand_info.get("experience", [])
        match_copy["skills"] = cand_info.get("skills", [])

    if not match_copy.get("resume_file") and cid in _resumes:
        match_copy["resume_file"] = os.path.basename(_resumes[cid])

    if mask_pii:
        rank = match_copy.get("rank", 1)
        match_copy["candidate_id"] = f"CANDIDATE-{rank}"
        match_copy["candidate_name"] = f"Candidate #{rank}"
        match_copy["candidate_email"] = "[Protected]"
        match_copy["candidate_phone"] = "[Protected]"
        match_copy["resume_file"] = "[Protected]"

    return match_copy


# ── Seed sample data endpoint (demo convenience) ──────────────────────────────
@app.post("/api/v1/seed-demo-data")
async def seed_demo_data(background_tasks: BackgroundTasks):
    """Loads sample resumes and jobs from data/, initializes DB, and runs pipeline."""
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data"))

    # Load sample resumes
    resume_files = (
        glob.glob(os.path.join(base, "sample_resumes", "*.txt")) +
        glob.glob(os.path.join(base, "sample_resumes", "*.pdf")) +
        glob.glob(os.path.join(base, "sample_resumes", "*.docx"))
    )
    _resumes.clear()
    for i, path in enumerate(resume_files):
        cid = f"C{i+1:03d}"
        _resumes[cid] = path

    # Load sample jobs
    job_files = (
        glob.glob(os.path.join(base, "sample_jobs", "*.txt")) +
        glob.glob(os.path.join(base, "sample_jobs", "*.pdf"))
    )
    _jobs.clear()
    for i, path in enumerate(job_files):
        jid = f"J{i+1:03d}"
        job = parse_job_description(path, job_id=jid)
        job_dict = {
            "job_id": job.job_id,
            "title": job.title,
            "domain": job.domain,
            "minimum_experience_months": job.minimum_experience_months,
            "required_skills": [s.model_dump() for s in job.required_skills],
            "preferred_skills": [s.model_dump() for s in job.preferred_skills],
            "responsibilities": job.responsibilities,
            "file_path": path,
            "candidate_count": 0,
        }
        _jobs[jid] = job_dict
        try:
            db_save_job(job_dict)
        except Exception as e:
            print(f"[Seed] DB save job error: {e}")

    target_jobs = list(_jobs.keys())
    for jid in target_jobs:
        _pipeline_status[jid] = "pending"

    background_tasks.add_task(_run_pipeline_background, target_jobs)
    return {
        "message": "Demo data seeded and pipeline started",
        "resumes": len(_resumes),
        "jobs": len(_jobs),
        "job_ids": target_jobs,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.api.main:app", host="0.0.0.0", port=8000, reload=True)

# apps/api/main.py
"""
TalentX FastAPI Backend — Phase 4
Complete REST API for the multi-agent resume screening pipeline.
"""

import sys
import os
import uuid
import glob

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import shutil

from packages.agents.orchestrator import run_screening_pipeline
from packages.agents.resume_agent import parse_resume
from packages.agents.job_agent import parse_job_description

app = FastAPI(
    title="TalentX Multi-Agent Resume Screening API",
    description="Evidence-grounded deterministic AI resume screening for PS03.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state (replace with DB in production) ─────────────────────────
_jobs: Dict[str, Any] = {}
_resumes: Dict[str, str] = {}          # candidate_id → file_path
_results: Dict[str, List[Any]] = {}    # job_id → list of MatchResult dicts
_pipeline_status: Dict[str, str] = {}  # job_id → "pending"/"running"/"done"/"error"

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Helpers ──────────────────────────────────────────────────────────────────
def _match_to_dict(m) -> Dict[str, Any]:
    return {
        "match_id": m.match_id,
        "candidate_id": m.candidate_id,
        "job_id": m.job_id,
        "overall_score": m.overall_score,
        "rank": m.rank,
        "recruiter_summary": m.recruiter_summary,
        "score_breakdown": m.score_breakdown.model_dump(),
        "skill_matches": [sm.model_dump() for sm in m.skill_matches],
        "skill_gaps": [sg.model_dump() for sg in m.skill_gaps],
        "evidence_list": [e.model_dump() for e in m.evidence_list],
    }


# ── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "TalentX API",
        "version": "1.0.0",
        "jobs_loaded": len(_jobs),
        "resumes_loaded": len(_resumes),
    }


# ── Jobs ─────────────────────────────────────────────────────────────────────
@app.get("/api/v1/jobs")
def list_jobs():
    return {"jobs": list(_jobs.values())}


@app.post("/api/v1/jobs")
async def upload_job(file: UploadFile = File(...)):
    job_id = f"J{len(_jobs)+1:03d}"
    dest = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    job = parse_job_description(dest, job_id=job_id)
    _jobs[job_id] = {
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
    return {"message": "Job uploaded successfully", "job": _jobs[job_id]}


class JobTextCreateRequest(BaseModel):
    title: str
    description: str
    domain: Optional[str] = "Software Engineering"
    minimum_experience_months: Optional[int] = 0

@app.post("/api/v1/jobs/text")
async def create_job_from_text(req: JobTextCreateRequest):
    job_id = f"J{len(_jobs)+1:03d}"
    filename = f"{job_id}_job.txt"
    dest = os.path.join(UPLOAD_DIR, filename)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(f"Title: {req.title}\n")
        f.write(f"Domain: {req.domain}\n")
        f.write(f"Minimum Experience: {req.minimum_experience_months} months\n\n")
        f.write(req.description)

    job = parse_job_description(dest, job_id=job_id)
    _jobs[job_id] = {
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
    return {"message": "Job created successfully", "job": _jobs[job_id]}



@app.get("/api/v1/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, f"Job {job_id} not found")
    return _jobs[job_id]


# ── Resumes ──────────────────────────────────────────────────────────────────
@app.get("/api/v1/resumes")
def list_resumes():
    return {"resumes": [{"candidate_id": k, "file": os.path.basename(v)} for k, v in _resumes.items()]}


@app.post("/api/v1/resumes")
async def upload_resume(file: UploadFile = File(...)):
    cid = f"C{len(_resumes)+1:03d}"
    dest = os.path.join(UPLOAD_DIR, f"{cid}_{file.filename}")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    _resumes[cid] = dest
    return {"message": "Resume uploaded", "candidate_id": cid, "filename": file.filename}


@app.post("/api/v1/resumes/bulk")
async def bulk_upload_resumes(files: List[UploadFile] = File(...)):
    uploaded = []
    for file in files:
        cid = f"C{len(_resumes)+1:03d}"
        dest = os.path.join(UPLOAD_DIR, f"{cid}_{file.filename}")
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        _resumes[cid] = dest
        uploaded.append({"candidate_id": cid, "filename": file.filename})
    return {"message": f"{len(uploaded)} resumes uploaded", "resumes": uploaded}


# ── Screening Pipeline ────────────────────────────────────────────────────────
def _run_pipeline_background(job_ids: List[str]):
    for jid in job_ids:
        _pipeline_status[jid] = "running"

    resume_paths = list(_resumes.values())
    job_paths = [_jobs[jid]["file_path"] for jid in job_ids if jid in _jobs]

    try:
        results = run_screening_pipeline(resume_paths, job_paths)
        for jid, matches in results.items():
            _results[jid] = [_match_to_dict(m) for m in matches]
            _pipeline_status[jid] = "done"
            if jid in _jobs:
                _jobs[jid]["candidate_count"] = len(matches)
    except Exception as e:
        for jid in job_ids:
            _pipeline_status[jid] = "error"
        print(f"[Pipeline] Error: {e}")


@app.post("/api/v1/run-screening")
async def run_screening(background_tasks: BackgroundTasks, job_ids: Optional[List[str]] = None):
    if not _resumes:
        raise HTTPException(400, "No resumes uploaded. Upload resumes first.")
    if not _jobs:
        raise HTTPException(400, "No jobs uploaded. Upload at least one job description.")

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
    if job_id not in _jobs:
        raise HTTPException(404, f"Job {job_id} not found")
    candidates = _results.get(job_id, [])
    if mask_pii:
        for c in candidates:
            c = dict(c)
            c["candidate_id"] = f"CANDIDATE-{c['rank']}"
    return {
        "job_id": job_id,
        "job_title": _jobs[job_id].get("title", ""),
        "candidates": candidates,
        "total": len(candidates),
        "status": _pipeline_status.get(job_id, "not_started"),
    }


@app.get("/api/v1/jobs/{job_id}/candidates/{candidate_id}")
def get_candidate_detail(job_id: str, candidate_id: str, mask_pii: bool = False):
    candidates = _results.get(job_id, [])
    match = next((c for c in candidates if c["candidate_id"] == candidate_id), None)
    if not match:
        raise HTTPException(404, f"No match found for {candidate_id} on {job_id}")
    if mask_pii:
        match = dict(match)
        match["candidate_id"] = "CANDIDATE (PII Masked)"
    return match


# ── Seed sample data endpoint (demo convenience) ──────────────────────────────
@app.post("/api/v1/seed-demo-data")
async def seed_demo_data(background_tasks: BackgroundTasks):
    """Loads sample resumes and jobs from data/ and runs pipeline. One-click demo."""
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
        _jobs[jid] = {
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

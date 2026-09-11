# apps/api/main.py
"""
TalentX FastAPI Backend — Phase 4
Complete REST API for the multi-agent resume screening pipeline.
"""

import sys
import os
import uuid
import glob
import json
import shutil
from typing import List, Optional, Dict, Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from packages.agents.orchestrator import run_screening_pipeline
from packages.agents.resume_agent import parse_resume
from packages.agents.job_agent import parse_job_description

from db.repository import repo

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

router = APIRouter()

# ── State Cache (backed by Supabase / PostgreSQL / SQLite) ─────────────────
_jobs: Dict[str, Any] = {}
_resumes: Dict[str, str] = {}          # candidate_id → file_path
_results: Dict[str, List[Any]] = {}    # job_id → list of MatchResult dicts
_pipeline_status: Dict[str, str] = {}  # job_id → "pending"/"running"/"done"/"error"

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Restore state from persistent database
def _restore_from_db():
    try:
        stored_jobs = repo.get_jobs()
        for j in stored_jobs:
            jid = j["job_id"]
            _jobs[jid] = j
            _results[jid] = repo.get_matches_for_job(jid)
        stored_resumes = repo.get_resumes()
        _resumes.update(stored_resumes)
        print(f"[Main API] Restored {len(_jobs)} jobs and {len(_resumes)} resumes from database.")
    except Exception as e:
        print(f"[Main API] Error restoring state from DB: {e}")

_restore_from_db()



# ── Helpers ──────────────────────────────────────────────────────────────────
def _match_to_dict(m) -> Dict[str, Any]:
    c_name = getattr(m, "candidate_name", None) or m.candidate_id
    c_info = m.contact_info.model_dump() if getattr(m, "contact_info", None) else None
    return {
        "match_id": m.match_id,
        "candidate_id": m.candidate_id,
        "candidate_name": c_name,
        "job_id": m.job_id,
        "overall_score": m.overall_score,
        "rank": m.rank,
        "recruiter_summary": m.recruiter_summary,
        "score_breakdown": m.score_breakdown.model_dump() if hasattr(m.score_breakdown, "model_dump") else m.score_breakdown,
        "contact_info": c_info,
        "skill_matches": [sm.model_dump() if hasattr(sm, "model_dump") else sm for sm in m.skill_matches],
        "skill_gaps": [sg.model_dump() if hasattr(sg, "model_dump") else sg for sg in m.skill_gaps],
        "evidence_list": [e.model_dump() if hasattr(e, "model_dump") else e for e in m.evidence_list],
    }


# ── Health ───────────────────────────────────────────────────────────────────
@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "TalentX API",
        "version": "1.0.0",
        "jobs_loaded": len(_jobs),
        "resumes_loaded": len(_resumes),
    }


# ── Jobs ─────────────────────────────────────────────────────────────────────
@router.get("/jobs")
def list_jobs():
    return {"jobs": list(_jobs.values())}


@router.post("/jobs")
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
    repo.save_job(_jobs[job_id])
    return {"message": "Job uploaded successfully", "job": _jobs[job_id]}


class JobTextCreateRequest(BaseModel):
    title: str
    description: str
    domain: Optional[str] = "Software Engineering"
    minimum_experience_months: Optional[int] = 0

@router.post("/jobs/text")
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
    repo.save_job(_jobs[job_id])
    return {"message": "Job created successfully", "job": _jobs[job_id]}


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, f"Job {job_id} not found")
    return _jobs[job_id]


# ── Candidate ID Generator ──────────────────────────────────────────────────
def _next_candidate_id() -> str:
    max_idx = 0
    for k in _resumes.keys():
        if k.startswith("C") and k[1:].isdigit():
            try:
                max_idx = max(max_idx, int(k[1:]))
            except ValueError:
                pass
    return f"C{max_idx + 1:03d}"


# ── Resumes ──────────────────────────────────────────────────────────────────
@router.get("/resumes")
def list_resumes():
    detailed = repo.get_resumes_detailed()
    detailed_map = {r["candidate_id"]: r for r in detailed}

    resumes_list = []
    # Combine DB items and in-memory cache
    all_cids = set(list(_resumes.keys()) + list(detailed_map.keys()))

    for cid in sorted(all_cids):
        file_path = _resumes.get(cid) or (detailed_map[cid]["file_path"] if cid in detailed_map else "")
        filename = detailed_map.get(cid, {}).get("filename") or (os.path.basename(file_path) if file_path else cid)
        created_at = detailed_map.get(cid, {}).get("created_at")
        cand_name = detailed_map.get(cid, {}).get("candidate_name") or detailed_map.get(cid, {}).get("name") or cid

        file_size_kb = 0.0
        if file_path and os.path.exists(file_path):
            try:
                file_size_kb = round(os.path.getsize(file_path) / 1024, 1)
            except Exception:
                pass

        # Calculate screened count & top score from in-memory results if available
        job_matches = []
        for jid, mlist in _results.items():
            for m in mlist:
                if m.get("candidate_id") == cid:
                    job_matches.append(m.get("overall_score", 0.0))
                    if m.get("candidate_name") and m.get("candidate_name") != cid:
                        cand_name = m.get("candidate_name")

        screened_count = len(job_matches) or detailed_map.get(cid, {}).get("screened_jobs_count", 0)
        top_score = max(job_matches) if job_matches else detailed_map.get(cid, {}).get("top_score", 0.0)

        resumes_list.append({
            "candidate_id": cid,
            "candidate_name": cand_name,
            "name": cand_name,
            "filename": filename,
            "file": filename,
            "file_path": file_path,
            "file_size_kb": file_size_kb,
            "created_at": created_at,
            "screened_jobs_count": screened_count,
            "top_score": round(top_score, 1),
        })

    return {"resumes": resumes_list, "total": len(resumes_list)}


@router.post("/resumes")
async def upload_resume(file: UploadFile = File(...)):
    cid = _next_candidate_id()
    dest = os.path.join(UPLOAD_DIR, f"{cid}_{file.filename}")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    _resumes[cid] = dest
    
    cand_name = None
    try:
        parsed = parse_resume(dest, candidate_id=cid)
        cand_name = parsed.name
    except Exception as e:
        print(f"[Main API] Note: Pre-extraction for {cid}: {e}")
        
    repo.save_resume(cid, dest, filename=file.filename, name=cand_name)
    return {"message": "Resume uploaded", "candidate_id": cid, "candidate_name": cand_name or cid, "filename": file.filename}


@router.post("/resumes/bulk")
async def bulk_upload_resumes(files: List[UploadFile] = File(...)):
    uploaded = []
    for file in files:
        cid = _next_candidate_id()
        dest = os.path.join(UPLOAD_DIR, f"{cid}_{file.filename}")
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        _resumes[cid] = dest
        cand_name = None
        try:
            parsed = parse_resume(dest, candidate_id=cid)
            cand_name = parsed.name
        except Exception as e:
            print(f"[Main API] Note: Pre-extraction for {cid}: {e}")
        repo.save_resume(cid, dest, filename=file.filename, name=cand_name)
        uploaded.append({"candidate_id": cid, "candidate_name": cand_name or cid, "filename": file.filename})
    return {"message": f"{len(uploaded)} resumes uploaded", "resumes": uploaded}


@router.delete("/resumes/{candidate_id}")
def delete_resume(candidate_id: str):
    found = candidate_id in _resumes
    
    # 1. Remove file on disk if stored in UPLOAD_DIR
    file_path = _resumes.get(candidate_id)
    if file_path and os.path.exists(file_path):
        try:
            # Only remove if inside UPLOAD_DIR (avoid deleting base sample files if referenced)
            if os.path.commonpath([UPLOAD_DIR, os.path.abspath(file_path)]) == UPLOAD_DIR:
                os.remove(file_path)
        except Exception as e:
            print(f"[Main API] Warning deleting file {file_path}: {e}")

    # 2. Remove from in-memory resume registry
    if candidate_id in _resumes:
        del _resumes[candidate_id]

    # 3. Remove matches for this candidate from memory
    for jid, mlist in list(_results.items()):
        _results[jid] = [m for m in mlist if m.get("candidate_id") != candidate_id]
        if jid in _jobs:
            _jobs[jid]["candidate_count"] = len(_results[jid])
            if _results[jid]:
                top_score = max(m.get("overall_score", 0.0) for m in _results[jid])
                _jobs[jid]["top_score"] = round(top_score, 1)
                _jobs[jid]["top_match_percent"] = round(top_score, 1)
            else:
                _jobs[jid]["top_score"] = 0.0
                _jobs[jid]["top_match_percent"] = 0.0
            repo.save_job(_jobs[jid])

    # 4. Remove from persistent database
    repo.delete_resume(candidate_id)

    return {"message": f"Resume {candidate_id} deleted successfully", "candidate_id": candidate_id}


@router.delete("/resumes")
def delete_all_resumes():
    # 1. Clean uploaded files in UPLOAD_DIR
    for cid, file_path in list(_resumes.items()):
        if file_path and os.path.exists(file_path):
            try:
                if os.path.commonpath([UPLOAD_DIR, os.path.abspath(file_path)]) == UPLOAD_DIR:
                    os.remove(file_path)
            except Exception as e:
                print(f"[Main API] Warning deleting file {file_path}: {e}")

    _resumes.clear()

    # 2. Clear results & reset job candidate counts
    for jid in list(_results.keys()):
        _results[jid] = []
        if jid in _jobs:
            _jobs[jid]["candidate_count"] = 0
            _jobs[jid]["top_score"] = 0.0
            _jobs[jid]["top_match_percent"] = 0.0
            repo.save_job(_jobs[jid])

    # 3. Purge DB
    repo.delete_all_resumes()

    return {"message": "All resumes and associated screening results deleted successfully"}


# ── Screening Pipeline ────────────────────────────────────────────────────────
def _run_pipeline_background(job_ids: List[str]):
    for jid in job_ids:
        _pipeline_status[jid] = "running"

    resume_paths = list(_resumes.values())
    job_paths = [_jobs[jid]["file_path"] for jid in job_ids if jid in _jobs]

    try:
        results = run_screening_pipeline(resume_paths, job_paths)
        for jid, matches in results.items():
            match_dicts = [_match_to_dict(m) for m in matches]
            _results[jid] = match_dicts
            for m, md in zip(matches, match_dicts):
                repo.save_match_result(md)
                c_name = getattr(m, "candidate_name", None)
                if c_name:
                    repo.save_resume(m.candidate_id, _resumes.get(m.candidate_id, ""), name=c_name)
            _pipeline_status[jid] = "done"
            if jid in _jobs:
                _jobs[jid]["candidate_count"] = len(matches)
                if matches:
                    top_score = max(m.overall_score for m in matches)
                    _jobs[jid]["top_score"] = round(top_score, 1)
                    _jobs[jid]["top_match_percent"] = round(top_score, 1)
                repo.save_job(_jobs[jid])

    except Exception as e:
        for jid in job_ids:
            _pipeline_status[jid] = "error"
        print(f"[Pipeline] Error: {e}")


@router.post("/run-screening")
async def run_screening(job_ids: Optional[List[str]] = None, sync: bool = True):
    if not _resumes:
        raise HTTPException(400, "No resumes uploaded. Upload resumes first.")
    
    # Auto-seed sample jobs if no job requisitions exist yet
    if not _jobs:
        base = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data"))
        job_files = glob.glob(os.path.join(base, "sample_jobs", "*.txt")) + glob.glob(os.path.join(base, "sample_jobs", "*.pdf"))
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

    target_jobs = job_ids or list(_jobs.keys())
    for jid in target_jobs:
        _pipeline_status[jid] = "pending"

    # Execute screening pipeline
    _run_pipeline_background(target_jobs)

    return {
        "message": "Screening pipeline completed successfully",
        "job_ids": target_jobs,
        "resume_count": len(_resumes),
        "results": {jid: _results.get(jid, []) for jid in target_jobs}
    }



@router.get("/screening-status")
def screening_status():
    return {"status": _pipeline_status}


# ── Results ───────────────────────────────────────────────────────────────────
@router.get("/jobs/{job_id}/candidates")
def get_ranked_candidates(job_id: str, mask_pii: bool = False):
    if job_id not in _jobs:
        raise HTTPException(404, f"Job {job_id} not found")
    candidates = _results.get(job_id, [])
    res = []
    for c in candidates:
        c_copy = dict(c)
        if mask_pii:
            c_copy["candidate_id"] = f"CANDIDATE-{c.get('rank', 1)}"
            c_copy["candidate_name"] = f"Candidate #{c.get('rank', 1)}"
            c_copy["contact_info"] = None
        else:
            c_copy["candidate_name"] = c.get("candidate_name") or c.get("candidate_id")
        res.append(c_copy)
    return {
        "job_id": job_id,
        "job_title": _jobs[job_id].get("title", ""),
        "candidates": res,
        "total": len(res),
        "status": _pipeline_status.get(job_id, "not_started"),
    }


@router.get("/jobs/{job_id}/candidates/{candidate_id}")
def get_candidate_detail(job_id: str, candidate_id: str, mask_pii: bool = False):
    candidates = _results.get(job_id, [])
    match = next((c for c in candidates if c["candidate_id"] == candidate_id), None)
    if not match:
        raise HTTPException(404, f"No match found for {candidate_id} on {job_id}")
    match_copy = dict(match)
    if mask_pii:
        match_copy["candidate_id"] = "CANDIDATE (PII Masked)"
        match_copy["candidate_name"] = "Candidate (PII Masked)"
        match_copy["contact_info"] = None
    else:
        match_copy["candidate_name"] = match.get("candidate_name") or match.get("candidate_id")
    return match_copy


@router.post("/jobs/{job_id}/candidates/{candidate_id}/outreach")
def generate_outreach_for_candidate(job_id: str, candidate_id: str):
    candidates = _results.get(job_id, [])
    match = next((c for c in candidates if c["candidate_id"] == candidate_id), None)
    if not match:
        raise HTTPException(404, f"No match found for {candidate_id} on {job_id}")

    job_title = _jobs.get(job_id, {}).get("title", "Technical Position")
    c_info = match.get("contact_info") or {}

    from packages.agents.outreach_agent import generate_outreach_email
    from packages.schemas.match import MatchResult
    match_obj = MatchResult.model_validate(match)

    candidate_name = match.get("candidate_name") or match.get("candidate_id", "Candidate")
    email_draft = generate_outreach_email(match_obj, job_title, candidate_name)

    dest_email = (c_info.get("email") or {}).get("value", "")
    import urllib.parse
    subject_enc = urllib.parse.quote(email_draft["subject"])
    body_enc = urllib.parse.quote(email_draft["body"])
    mailto_url = f"mailto:{dest_email}?subject={subject_enc}&body={body_enc}"

    return {
        "candidate_id": candidate_id,
        "candidate_name": candidate_name,
        "job_id": job_id,
        "job_title": job_title,
        "contact_info": c_info,
        "subject": email_draft["subject"],
        "body": email_draft["body"],
        "mailto_url": mailto_url
    }



# ── Seed sample data endpoint (demo convenience) ──────────────────────────────
@router.post("/seed-demo-data")
async def seed_demo_data():
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
        cand_name = None
        try:
            parsed = parse_resume(path, candidate_id=cid)
            cand_name = parsed.name
        except Exception:
            pass
        repo.save_resume(cid, path, filename=os.path.basename(path), name=cand_name)

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
        repo.save_job(_jobs[jid])

    target_jobs = list(_jobs.keys())
    for jid in target_jobs:
        _pipeline_status[jid] = "pending"

    _run_pipeline_background(target_jobs)
    return {
        "message": "Demo data seeded and pipeline completed",
        "resumes": len(_resumes),
        "jobs": len(_jobs),
        "job_ids": target_jobs,
    }



# Register routes for both root ("/") and "/api/v1"
app.include_router(router, prefix="/api/v1")
app.include_router(router, prefix="")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.api.main:app", host="0.0.0.0", port=8000, reload=True)

# packages/db/database.py
"""
TalentX Database Layer: Supabase / PostgreSQL persistence with local fallback.
Handles storage of:
- jobs
- candidates (extracted resumes with per-skill evidence)
- matches (deterministic scores, breakdown, rankings)
- evidence (exact source text spans and page numbers)
"""

import os
import json
import sqlite3
from typing import Dict, Any, List, Optional

# Load .env file
def _load_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip().strip("'\"")

_load_env()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "../../data/talentx.db")
os.makedirs(os.path.dirname(SQLITE_DB_PATH), exist_ok=True)

_is_postgres = False
_db_initialized = False

def _get_pg_connection():
    import psycopg2
    # Ensure SSL mode require for Supabase
    conn = psycopg2.connect(
        DATABASE_URL,
        sslmode="require",
        connect_timeout=5,
    )
    conn.autocommit = True
    return conn

def get_connection():
    global _is_postgres
    if DATABASE_URL and ("postgresql://" in DATABASE_URL or "postgres://" in DATABASE_URL):
        try:
            conn = _get_pg_connection()
            _is_postgres = True
            return conn, "postgres"
        except Exception as e:
            # Fallback to sqlite if postgres connection fails
            pass
    
    _is_postgres = False
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn, "sqlite"

def is_db_connected() -> Dict[str, Any]:
    conn, engine = get_connection()
    conn.close()
    return {
        "engine": engine,
        "is_postgres": engine == "postgres",
        "database_url_configured": bool(DATABASE_URL),
    }

def init_db():
    """Initializes the required database tables."""
    global _db_initialized
    conn, engine = get_connection()
    cur = conn.cursor()

    if engine == "postgres":
        print("[DB] Initializing PostgreSQL / Supabase tables...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                domain TEXT DEFAULT 'Software Engineering',
                minimum_experience_months INT DEFAULT 0,
                required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
                preferred_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
                responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
                education_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
                certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
                preferred_qualifications JSONB NOT NULL DEFAULT '[]'::jsonb,
                other_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
                file_path TEXT,
                candidate_count INT DEFAULT 0,
                top_score NUMERIC(5,2) DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)
        # Migrate existing Supabase tables by adding columns if they don't exist
        for col_ddl in [
            "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS education_requirements JSONB NOT NULL DEFAULT '[]'::jsonb;",
            "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS certifications JSONB NOT NULL DEFAULT '[]'::jsonb;",
            "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS preferred_qualifications JSONB NOT NULL DEFAULT '[]'::jsonb;",
            "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS other_requirements JSONB NOT NULL DEFAULT '[]'::jsonb;",
            "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS top_score NUMERIC(5,2) DEFAULT 0;",
            "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email TEXT;",
            "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone TEXT;",
        ]:
            try:
                cur.execute(col_ddl)
            except Exception:
                pass  # Column already exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS candidates (
                candidate_id TEXT PRIMARY KEY,
                name TEXT,
                email TEXT,
                phone TEXT,
                document_id TEXT,
                education JSONB NOT NULL DEFAULT '[]'::jsonb,
                experience JSONB NOT NULL DEFAULT '[]'::jsonb,
                skills JSONB NOT NULL DEFAULT '[]'::jsonb,
                projects JSONB NOT NULL DEFAULT '[]'::jsonb,
                certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
                achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
                file_path TEXT,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                match_id TEXT PRIMARY KEY,
                candidate_id TEXT NOT NULL,
                job_id TEXT NOT NULL,
                overall_score NUMERIC(5,2) NOT NULL,
                rank INT,
                score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
                skill_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
                skill_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
                recruiter_summary TEXT,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS evidence (
                evidence_id SERIAL PRIMARY KEY,
                match_id TEXT,
                candidate_id TEXT,
                claim TEXT NOT NULL,
                source_document TEXT NOT NULL,
                page INT DEFAULT 1,
                text_span TEXT NOT NULL,
                confidence NUMERIC(3,2) DEFAULT 1.0,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)
    else:
        print(f"[DB] Initializing SQLite tables at {SQLITE_DB_PATH}...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                domain TEXT DEFAULT 'Software Engineering',
                minimum_experience_months INT DEFAULT 0,
                required_skills TEXT DEFAULT '[]',
                preferred_skills TEXT DEFAULT '[]',
                responsibilities TEXT DEFAULT '[]',
                education_requirements TEXT DEFAULT '[]',
                certifications TEXT DEFAULT '[]',
                preferred_qualifications TEXT DEFAULT '[]',
                other_requirements TEXT DEFAULT '[]',
                file_path TEXT,
                candidate_count INT DEFAULT 0,
                top_score REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Migrate existing databases by adding columns if they don't exist yet
        for col, coltype in [
            ("education_requirements", "TEXT DEFAULT '[]'"),
            ("certifications", "TEXT DEFAULT '[]'"),
            ("preferred_qualifications", "TEXT DEFAULT '[]'"),
            ("other_requirements", "TEXT DEFAULT '[]'"),
            ("top_score", "REAL DEFAULT 0"),
        ]:
            try:
                cur.execute(f"ALTER TABLE jobs ADD COLUMN {col} {coltype};")
            except Exception:
                pass  # Column already exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS candidates (
                candidate_id TEXT PRIMARY KEY,
                name TEXT,
                email TEXT,
                phone TEXT,
                document_id TEXT,
                education TEXT DEFAULT '[]',
                experience TEXT DEFAULT '[]',
                skills TEXT DEFAULT '[]',
                projects TEXT DEFAULT '[]',
                certifications TEXT DEFAULT '[]',
                achievements TEXT DEFAULT '[]',
                file_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        for col, coltype in [
            ("email", "TEXT"),
            ("phone", "TEXT"),
        ]:
            try:
                cur.execute(f"ALTER TABLE candidates ADD COLUMN {col} {coltype};")
            except Exception:
                pass
        cur.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                match_id TEXT PRIMARY KEY,
                candidate_id TEXT NOT NULL,
                job_id TEXT NOT NULL,
                overall_score REAL NOT NULL,
                rank INT,
                score_breakdown TEXT DEFAULT '{}',
                skill_matches TEXT DEFAULT '[]',
                skill_gaps TEXT DEFAULT '[]',
                recruiter_summary TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS evidence (
                evidence_id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id TEXT,
                candidate_id TEXT,
                claim TEXT NOT NULL,
                source_document TEXT NOT NULL,
                page INT DEFAULT 1,
                text_span TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

    conn.close()
    _db_initialized = True
    print("[DB] Tables successfully initialized!")

# ── Job Helpers ─────────────────────────────────────────────────────────────

def save_job(job: Dict[str, Any]):
    conn, engine = get_connection()
    cur = conn.cursor()
    req_skills = json.dumps(job.get("required_skills", []))
    pref_skills = json.dumps(job.get("preferred_skills", []))
    resps = json.dumps(job.get("responsibilities", []))
    edu_reqs = json.dumps(job.get("education_requirements", []))
    certs = json.dumps(job.get("certifications", []))
    pref_quals = json.dumps(job.get("preferred_qualifications", []))
    other_reqs = json.dumps(job.get("other_requirements", []))
    top_score = float(job.get("top_score", 0))

    if engine == "postgres":
        query = """
            INSERT INTO jobs (job_id, title, domain, minimum_experience_months, required_skills, preferred_skills, responsibilities, education_requirements, certifications, preferred_qualifications, other_requirements, file_path, candidate_count, top_score)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (job_id) DO UPDATE SET
                title = EXCLUDED.title,
                domain = EXCLUDED.domain,
                minimum_experience_months = EXCLUDED.minimum_experience_months,
                required_skills = EXCLUDED.required_skills,
                preferred_skills = EXCLUDED.preferred_skills,
                responsibilities = EXCLUDED.responsibilities,
                education_requirements = EXCLUDED.education_requirements,
                certifications = EXCLUDED.certifications,
                preferred_qualifications = EXCLUDED.preferred_qualifications,
                other_requirements = EXCLUDED.other_requirements,
                file_path = EXCLUDED.file_path,
                candidate_count = EXCLUDED.candidate_count,
                top_score = EXCLUDED.top_score;
        """
        cur.execute(query, (
            job["job_id"],
            job.get("title", "Untitled Job"),
            job.get("domain", "Software Engineering"),
            job.get("minimum_experience_months", 0),
            req_skills, pref_skills, resps, edu_reqs, certs, pref_quals, other_reqs,
            job.get("file_path", ""),
            job.get("candidate_count", 0),
            top_score,
        ))
    else:
        query = """
            INSERT INTO jobs (job_id, title, domain, minimum_experience_months, required_skills, preferred_skills, responsibilities, education_requirements, certifications, preferred_qualifications, other_requirements, file_path, candidate_count, top_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (job_id) DO UPDATE SET
                title = excluded.title,
                domain = excluded.domain,
                minimum_experience_months = excluded.minimum_experience_months,
                required_skills = excluded.required_skills,
                preferred_skills = excluded.preferred_skills,
                responsibilities = excluded.responsibilities,
                education_requirements = excluded.education_requirements,
                certifications = excluded.certifications,
                preferred_qualifications = excluded.preferred_qualifications,
                other_requirements = excluded.other_requirements,
                file_path = excluded.file_path,
                candidate_count = excluded.candidate_count,
                top_score = excluded.top_score;
        """
        cur.execute(query, (
            job["job_id"],
            job.get("title", "Untitled Job"),
            job.get("domain", "Software Engineering"),
            job.get("minimum_experience_months", 0),
            req_skills, pref_skills, resps, edu_reqs, certs, pref_quals, other_reqs,
            job.get("file_path", ""),
            job.get("candidate_count", 0),
            top_score,
        ))
        conn.commit()

    conn.close()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn, engine = get_connection()
    cur = conn.cursor()
    if engine == "postgres":
        cur.execute("SELECT job_id, title, domain, minimum_experience_months, required_skills, preferred_skills, responsibilities, education_requirements, certifications, preferred_qualifications, other_requirements, file_path, candidate_count, top_score FROM jobs WHERE job_id = %s", (job_id,))
    else:
        cur.execute("SELECT job_id, title, domain, minimum_experience_months, required_skills, preferred_skills, responsibilities, education_requirements, certifications, preferred_qualifications, other_requirements, file_path, candidate_count, top_score FROM jobs WHERE job_id = ?", (job_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return _format_job_row(row, engine)

def list_jobs() -> List[Dict[str, Any]]:
    conn, engine = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT job_id, title, domain, minimum_experience_months, required_skills, preferred_skills, responsibilities, education_requirements, certifications, preferred_qualifications, other_requirements, file_path, candidate_count, top_score FROM jobs ORDER BY job_id ASC")
    rows = cur.fetchall()
    conn.close()
    return [_format_job_row(r, engine) for r in rows]

def _format_job_row(row, engine: str) -> Dict[str, Any]:
    if engine == "postgres":
        req = row[4] if isinstance(row[4], (list, dict)) else json.loads(row[4] or "[]")
        pref = row[5] if isinstance(row[5], (list, dict)) else json.loads(row[5] or "[]")
        resp = row[6] if isinstance(row[6], (list, dict)) else json.loads(row[6] or "[]")
        edu = row[7] if isinstance(row[7], (list, dict)) else json.loads(row[7] or "[]")
        certs = row[8] if isinstance(row[8], (list, dict)) else json.loads(row[8] or "[]")
        pref_quals = row[9] if isinstance(row[9], (list, dict)) else json.loads(row[9] or "[]")
        other = row[10] if isinstance(row[10], (list, dict)) else json.loads(row[10] or "[]")
        return {
            "job_id": row[0],
            "title": row[1],
            "domain": row[2],
            "minimum_experience_months": row[3],
            "required_skills": req,
            "preferred_skills": pref,
            "responsibilities": resp,
            "education_requirements": edu,
            "certifications": certs,
            "preferred_qualifications": pref_quals,
            "other_requirements": other,
            "file_path": row[11],
            "candidate_count": row[12],
            "top_score": float(row[13]) if row[13] is not None else 0,
        }
    else:
        return {
            "job_id": row["job_id"],
            "title": row["title"],
            "domain": row["domain"],
            "minimum_experience_months": row["minimum_experience_months"],
            "required_skills": json.loads(row["required_skills"] or "[]"),
            "preferred_skills": json.loads(row["preferred_skills"] or "[]"),
            "responsibilities": json.loads(row["responsibilities"] or "[]"),
            "education_requirements": json.loads(row["education_requirements"] or "[]") if "education_requirements" in row.keys() else [],
            "certifications": json.loads(row["certifications"] or "[]") if "certifications" in row.keys() else [],
            "preferred_qualifications": json.loads(row["preferred_qualifications"] or "[]") if "preferred_qualifications" in row.keys() else [],
            "other_requirements": json.loads(row["other_requirements"] or "[]") if "other_requirements" in row.keys() else [],
            "file_path": row["file_path"],
            "candidate_count": row["candidate_count"],
            "top_score": float(row["top_score"]) if "top_score" in row.keys() and row["top_score"] is not None else 0,
        }

# ── Candidate Helpers ─────────────────────────────────────────────────────────

def save_candidate(candidate: Dict[str, Any]):
    conn, engine = get_connection()
    cur = conn.cursor()
    edu = json.dumps(candidate.get("education", []))
    exp = json.dumps(candidate.get("experience", []))
    skills = json.dumps(candidate.get("skills", []))
    proj = json.dumps(candidate.get("projects", []))
    certs = json.dumps(candidate.get("certifications", []))
    ach = json.dumps(candidate.get("achievements", []))

    if engine == "postgres":
        query = """
            INSERT INTO candidates (candidate_id, name, email, phone, document_id, education, experience, skills, projects, certifications, achievements, file_path)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (candidate_id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                document_id = EXCLUDED.document_id,
                education = EXCLUDED.education,
                experience = EXCLUDED.experience,
                skills = EXCLUDED.skills,
                projects = EXCLUDED.projects,
                certifications = EXCLUDED.certifications,
                achievements = EXCLUDED.achievements,
                file_path = EXCLUDED.file_path;
        """
        cur.execute(query, (
            candidate["candidate_id"],
            candidate.get("name", "Candidate"),
            candidate.get("email"),
            candidate.get("phone"),
            candidate.get("document_id", ""),
            edu,
            exp,
            skills,
            proj,
            certs,
            ach,
            candidate.get("file_path", ""),
        ))
    else:
        query = """
            INSERT INTO candidates (candidate_id, name, email, phone, document_id, education, experience, skills, projects, certifications, achievements, file_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (candidate_id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                phone = excluded.phone,
                document_id = excluded.document_id,
                education = excluded.education,
                experience = excluded.experience,
                skills = excluded.skills,
                projects = excluded.projects,
                certifications = excluded.certifications,
                achievements = excluded.achievements,
                file_path = excluded.file_path;
        """
        cur.execute(query, (
            candidate["candidate_id"],
            candidate.get("name", "Candidate"),
            candidate.get("email"),
            candidate.get("phone"),
            candidate.get("document_id", ""),
            edu,
            exp,
            skills,
            proj,
            certs,
            ach,
            candidate.get("file_path", ""),
        ))
        conn.commit()

    conn.close()

def get_candidate(candidate_id: str) -> Optional[Dict[str, Any]]:
    conn, engine = get_connection()
    cur = conn.cursor()
    if engine == "postgres":
        cur.execute("SELECT candidate_id, name, email, phone, document_id, education, experience, skills, projects, certifications, achievements, file_path FROM candidates WHERE candidate_id = %s", (candidate_id,))
    else:
        cur.execute("SELECT candidate_id, name, email, phone, document_id, education, experience, skills, projects, certifications, achievements, file_path FROM candidates WHERE candidate_id = ?", (candidate_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return _format_candidate_row(row, engine)

def list_candidates() -> List[Dict[str, Any]]:
    conn, engine = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT candidate_id, name, email, phone, document_id, education, experience, skills, projects, certifications, achievements, file_path FROM candidates ORDER BY candidate_id ASC")
    rows = cur.fetchall()
    conn.close()
    return [_format_candidate_row(r, engine) for r in rows]

def _format_candidate_row(row, engine: str) -> Dict[str, Any]:
    if engine == "postgres":
        return {
            "candidate_id": row[0],
            "name": row[1],
            "email": row[2],
            "phone": row[3],
            "document_id": row[4],
            "education": row[5] if isinstance(row[5], list) else json.loads(row[5] or "[]"),
            "experience": row[6] if isinstance(row[6], list) else json.loads(row[6] or "[]"),
            "skills": row[7] if isinstance(row[7], list) else json.loads(row[7] or "[]"),
            "projects": row[8] if isinstance(row[8], list) else json.loads(row[8] or "[]"),
            "certifications": row[9] if isinstance(row[9], list) else json.loads(row[9] or "[]"),
            "achievements": row[10] if isinstance(row[10], list) else json.loads(row[10] or "[]"),
            "file_path": row[11],
        }
    else:
        return {
            "candidate_id": row["candidate_id"],
            "name": row["name"],
            "email": row["email"] if "email" in row.keys() else None,
            "phone": row["phone"] if "phone" in row.keys() else None,
            "document_id": row["document_id"],
            "education": json.loads(row["education"] or "[]"),
            "experience": json.loads(row["experience"] or "[]"),
            "skills": json.loads(row["skills"] or "[]"),
            "projects": json.loads(row["projects"] or "[]"),
            "certifications": json.loads(row["certifications"] or "[]"),
            "achievements": json.loads(row["achievements"] or "[]"),
            "file_path": row["file_path"],
        }

# ── Match Result & Evidence Helpers ──────────────────────────────────────────

def save_match_result(match: Dict[str, Any]):
    conn, engine = get_connection()
    cur = conn.cursor()

    breakdown = json.dumps(match.get("score_breakdown", {}))
    skill_matches = json.dumps(match.get("skill_matches", []))
    skill_gaps = json.dumps(match.get("skill_gaps", []))

    if engine == "postgres":
        query = """
            INSERT INTO matches (match_id, candidate_id, job_id, overall_score, rank, score_breakdown, skill_matches, skill_gaps, recruiter_summary)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (match_id) DO UPDATE SET
                overall_score = EXCLUDED.overall_score,
                rank = EXCLUDED.rank,
                score_breakdown = EXCLUDED.score_breakdown,
                skill_matches = EXCLUDED.skill_matches,
                skill_gaps = EXCLUDED.skill_gaps,
                recruiter_summary = EXCLUDED.recruiter_summary;
        """
        cur.execute(query, (
            match["match_id"],
            match["candidate_id"],
            match["job_id"],
            float(match["overall_score"]),
            match.get("rank", 1),
            breakdown,
            skill_matches,
            skill_gaps,
            match.get("recruiter_summary", ""),
        ))

        # Save evidence rows
        for ev in match.get("evidence_list", []):
            cur.execute("""
                INSERT INTO evidence (match_id, candidate_id, claim, source_document, page, text_span, confidence)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
            """, (
                match["match_id"],
                match["candidate_id"],
                ev.get("claim", ""),
                ev.get("source_document", "resume"),
                ev.get("page", 1),
                ev.get("text_span", ""),
                float(ev.get("confidence", 1.0)),
            ))
    else:
        query = """
            INSERT INTO matches (match_id, candidate_id, job_id, overall_score, rank, score_breakdown, skill_matches, skill_gaps, recruiter_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (match_id) DO UPDATE SET
                overall_score = excluded.overall_score,
                rank = excluded.rank,
                score_breakdown = excluded.score_breakdown,
                skill_matches = excluded.skill_matches,
                skill_gaps = excluded.skill_gaps,
                recruiter_summary = excluded.recruiter_summary;
        """
        cur.execute(query, (
            match["match_id"],
            match["candidate_id"],
            match["job_id"],
            float(match["overall_score"]),
            match.get("rank", 1),
            breakdown,
            skill_matches,
            skill_gaps,
            match.get("recruiter_summary", ""),
        ))

        for ev in match.get("evidence_list", []):
            cur.execute("""
                INSERT INTO evidence (match_id, candidate_id, claim, source_document, page, text_span, confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (
                match["match_id"],
                match["candidate_id"],
                ev.get("claim", ""),
                ev.get("source_document", "resume"),
                ev.get("page", 1),
                ev.get("text_span", ""),
                float(ev.get("confidence", 1.0)),
            ))
        conn.commit()

    conn.close()

def get_job_matches(job_id: str) -> List[Dict[str, Any]]:
    conn, engine = get_connection()
    cur = conn.cursor()
    if engine == "postgres":
        cur.execute("""
            SELECT m.match_id, m.candidate_id, m.job_id, m.overall_score, m.rank,
                   m.score_breakdown, m.skill_matches, m.skill_gaps, m.recruiter_summary,
                   c.name, c.email, c.phone, c.document_id
            FROM matches m
            LEFT JOIN candidates c ON m.candidate_id = c.candidate_id
            WHERE m.job_id = %s
            ORDER BY m.overall_score DESC
        """, (job_id,))
    else:
        cur.execute("""
            SELECT m.match_id, m.candidate_id, m.job_id, m.overall_score, m.rank,
                   m.score_breakdown, m.skill_matches, m.skill_gaps, m.recruiter_summary,
                   c.name, c.email, c.phone, c.document_id
            FROM matches m
            LEFT JOIN candidates c ON m.candidate_id = c.candidate_id
            WHERE m.job_id = ?
            ORDER BY m.overall_score DESC
        """, (job_id,))
    rows = cur.fetchall()
    
    results = []
    for r in rows:
        m = _format_match_row(r, engine)
        # Fetch evidence for match
        if engine == "postgres":
            cur.execute("SELECT claim, source_document, page, text_span, confidence FROM evidence WHERE match_id = %s", (m["match_id"],))
        else:
            cur.execute("SELECT claim, source_document, page, text_span, confidence FROM evidence WHERE match_id = ?", (m["match_id"],))
        ev_rows = cur.fetchall()
        m["evidence_list"] = [_format_evidence_row(ev, engine) for ev in ev_rows]
        results.append(m)

    conn.close()
    return results

def get_candidate_match(job_id: str, candidate_id: str) -> Optional[Dict[str, Any]]:
    conn, engine = get_connection()
    cur = conn.cursor()
    if engine == "postgres":
        cur.execute("""
            SELECT m.match_id, m.candidate_id, m.job_id, m.overall_score, m.rank,
                   m.score_breakdown, m.skill_matches, m.skill_gaps, m.recruiter_summary,
                   c.name, c.email, c.phone, c.document_id
            FROM matches m
            LEFT JOIN candidates c ON m.candidate_id = c.candidate_id
            WHERE m.job_id = %s AND m.candidate_id = %s
        """, (job_id, candidate_id))
    else:
        cur.execute("""
            SELECT m.match_id, m.candidate_id, m.job_id, m.overall_score, m.rank,
                   m.score_breakdown, m.skill_matches, m.skill_gaps, m.recruiter_summary,
                   c.name, c.email, c.phone, c.document_id
            FROM matches m
            LEFT JOIN candidates c ON m.candidate_id = c.candidate_id
            WHERE m.job_id = ? AND m.candidate_id = ?
        """, (job_id, candidate_id))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    m = _format_match_row(row, engine)
    if engine == "postgres":
        cur.execute("SELECT claim, source_document, page, text_span, confidence FROM evidence WHERE match_id = %s", (m["match_id"],))
    else:
        cur.execute("SELECT claim, source_document, page, text_span, confidence FROM evidence WHERE match_id = ?", (m["match_id"],))
    ev_rows = cur.fetchall()
    m["evidence_list"] = [_format_evidence_row(ev, engine) for ev in ev_rows]
    conn.close()
    return m

def _format_match_row(row, engine: str) -> Dict[str, Any]:
    if engine == "postgres":
        sb = row[5] if isinstance(row[5], dict) else json.loads(row[5] or "{}")
        sm = row[6] if isinstance(row[6], list) else json.loads(row[6] or "[]")
        sg = row[7] if isinstance(row[7], list) else json.loads(row[7] or "[]")
        return {
            "match_id": row[0],
            "candidate_id": row[1],
            "job_id": row[2],
            "overall_score": float(row[3]),
            "rank": row[4],
            "score_breakdown": sb,
            "skill_matches": sm,
            "skill_gaps": sg,
            "recruiter_summary": row[8],
            "candidate_name": row[9] if len(row) > 9 else None,
            "candidate_email": row[10] if len(row) > 10 else None,
            "candidate_phone": row[11] if len(row) > 11 else None,
            "resume_file": row[12] if len(row) > 12 else None,
        }
    else:
        return {
            "match_id": row["match_id"],
            "candidate_id": row["candidate_id"],
            "job_id": row["job_id"],
            "overall_score": float(row["overall_score"]),
            "rank": row["rank"],
            "score_breakdown": json.loads(row["score_breakdown"] or "{}"),
            "skill_matches": json.loads(row["skill_matches"] or "[]"),
            "skill_gaps": json.loads(row["skill_gaps"] or "[]"),
            "recruiter_summary": row["recruiter_summary"],
            "candidate_name": row["name"] if "name" in row.keys() else None,
            "candidate_email": row["email"] if "email" in row.keys() else None,
            "candidate_phone": row["phone"] if "phone" in row.keys() else None,
            "resume_file": row["document_id"] if "document_id" in row.keys() else None,
        }

def _format_evidence_row(row, engine: str) -> Dict[str, Any]:
    if engine == "postgres":
        return {
            "claim": row[0],
            "source_document": row[1],
            "page": row[2],
            "text_span": row[3],
            "confidence": float(row[4]),
        }
    else:
        return {
            "claim": row["claim"],
            "source_document": row["source_document"],
            "page": row["page"],
            "text_span": row["text_span"],
            "confidence": float(row["confidence"]),
        }

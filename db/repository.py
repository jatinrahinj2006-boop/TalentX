# db/repository.py
"""
TalentX Database Repository — Supabase & PostgreSQL Persistent Storage.
Supports Supabase PostgreSQL (SUPABASE_DATABASE_URL / DATABASE_URL),
local PostgreSQL, and SQLite persistent fallback (db/talentx.db).
Ensures zero data loss across server restarts.
"""

import os
import json
import sqlite3
import time
from typing import List, Dict, Any, Optional

# Load .env file
def _load_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip().strip("'\"")

_load_env()

DB_URL = os.environ.get("SUPABASE_DATABASE_URL") or os.environ.get("DATABASE_URL") or "postgresql://localhost:5432/talentx"
SQLITE_PATH = os.path.join(os.path.dirname(__file__), "talentx.db")


class TalentXRepository:
    def __init__(self):
        self.use_pg = False
        self.pg_conn_str = DB_URL
        self._init_db()

    def _get_pg_conn(self):
        import psycopg2
        return psycopg2.connect(self.pg_conn_str)

    def _get_sqlite_conn(self):
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        # Attempt PostgreSQL / Supabase connection first
        try:
            import psycopg2
            conn = self._get_pg_conn()
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
            conn.close()
            self.use_pg = True
            print(f"[DB Repository] Successfully connected to PostgreSQL / Supabase database.")
            self._init_pg_schema()
            return
        except Exception as e:
            print(f"[DB Repository] PostgreSQL / Supabase not reachable ({e}). Using SQLite persistent storage at {SQLITE_PATH}.")
            self.use_pg = False
            self._init_sqlite_schema()

    def _init_pg_schema(self):
        try:
            schema_path = os.path.join(os.path.dirname(__file__), "migrations", "001_initial_schema.sql")
            if os.path.exists(schema_path):
                conn = self._get_pg_conn()
                with conn.cursor() as cur:
                    with open(schema_path, "r") as f:
                        cur.execute(f.read())
                conn.commit()
                conn.close()
        except Exception as e:
            print(f"[DB Repository] Error running PG migration: {e}")

    def _init_sqlite_schema(self):
        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS candidates (
                candidate_id TEXT PRIMARY KEY,
                name TEXT,
                document_id TEXT,
                file_path TEXT,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                data TEXT NOT NULL,
                file_path TEXT,
                candidate_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS matches (
                match_id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                candidate_id TEXT NOT NULL,
                data TEXT NOT NULL,
                overall_score REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Ensure name column exists if table already existed
        try:
            cur.execute("ALTER TABLE candidates ADD COLUMN name TEXT;")
        except Exception:
            pass
        conn.commit()
        conn.close()

    # ── Job Persistence ────────────────────────────────────────────────────────
    def save_job(self, job_dict: Dict[str, Any]):
        job_id = job_dict["job_id"]
        data_json = json.dumps(job_dict)

        if self.use_pg:
            try:
                conn = self._get_pg_conn()
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO jobs (job_id, title, required_skills, preferred_skills, minimum_experience_months, domain, responsibilities)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (job_id) DO UPDATE SET
                            title = EXCLUDED.title,
                            required_skills = EXCLUDED.required_skills,
                            preferred_skills = EXCLUDED.preferred_skills,
                            minimum_experience_months = EXCLUDED.minimum_experience_months,
                            domain = EXCLUDED.domain,
                            responsibilities = EXCLUDED.responsibilities;
                    """, (
                        job_id,
                        job_dict.get("title", ""),
                        json.dumps(job_dict.get("required_skills", [])),
                        json.dumps(job_dict.get("preferred_skills", [])),
                        job_dict.get("minimum_experience_months", 0),
                        job_dict.get("domain", "General"),
                        json.dumps(job_dict.get("responsibilities", []))
                    ))
                conn.commit()
                conn.close()
                return
            except Exception as e:
                print(f"[DB Repository] PG save_job error ({e}), falling back to SQLite.")

        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO jobs (job_id, title, data, file_path, candidate_count)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                title = excluded.title,
                data = excluded.data,
                file_path = excluded.file_path,
                candidate_count = excluded.candidate_count;
        """, (job_id, job_dict.get("title", ""), data_json, job_dict.get("file_path", ""), job_dict.get("candidate_count", 0)))
        conn.commit()
        conn.close()

    def get_jobs(self) -> List[Dict[str, Any]]:
        if self.use_pg:
            try:
                conn = self._get_pg_conn()
                with conn.cursor() as cur:
                    cur.execute("SELECT job_id, title, domain, minimum_experience_months, required_skills, preferred_skills, responsibilities FROM jobs ORDER BY created_at DESC;")
                    rows = cur.fetchall()
                conn.close()
                results = []
                for r in rows:
                    results.append({
                        "job_id": r[0],
                        "title": r[1],
                        "domain": r[2],
                        "minimum_experience_months": r[3],
                        "required_skills": r[4] if isinstance(r[4], list) else json.loads(r[4] or "[]"),
                        "preferred_skills": r[5] if isinstance(r[5], list) else json.loads(r[5] or "[]"),
                        "responsibilities": r[6] if isinstance(r[6], list) else json.loads(r[6] or "[]"),
                    })
                return results
            except Exception as e:
                print(f"[DB Repository] PG get_jobs error ({e}), using SQLite.")

        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("SELECT data FROM jobs ORDER BY created_at DESC;")
        rows = cur.fetchall()
        conn.close()
        return [json.loads(r["data"]) for r in rows]

    # ── Candidate/Resume Persistence ──────────────────────────────────────────
    def save_resume(self, candidate_id: str, file_path: str, filename: Optional[str] = None, name: Optional[str] = None):
        doc_name = filename or os.path.basename(file_path)
        if self.use_pg:
            try:
                conn = self._get_pg_conn()
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO candidates (candidate_id, document_id, name)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (candidate_id) DO UPDATE SET
                            document_id = EXCLUDED.document_id,
                            name = COALESCE(EXCLUDED.name, candidates.name);
                    """, (candidate_id, file_path, name))
                conn.commit()
                conn.close()
                return
            except Exception as e:
                print(f"[DB Repository] PG save_resume error ({e}), using SQLite.")

        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO candidates (candidate_id, document_id, file_path, name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(candidate_id) DO UPDATE SET
                document_id = excluded.document_id,
                file_path = excluded.file_path,
                name = COALESCE(excluded.name, candidates.name);
        """, (candidate_id, doc_name, file_path, name))
        conn.commit()
        conn.close()

    def delete_resume(self, candidate_id: str):
        if self.use_pg:
            try:
                conn = self._get_pg_conn()
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM evidence WHERE candidate_id = %s;", (candidate_id,))
                    cur.execute("DELETE FROM matches WHERE candidate_id = %s;", (candidate_id,))
                    cur.execute("DELETE FROM candidates WHERE candidate_id = %s;", (candidate_id,))
                conn.commit()
                conn.close()
                return
            except Exception as e:
                print(f"[DB Repository] PG delete_resume error ({e}), using SQLite.")

        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM matches WHERE candidate_id = ?;", (candidate_id,))
        cur.execute("DELETE FROM candidates WHERE candidate_id = ?;", (candidate_id,))
        conn.commit()
        conn.close()

    def delete_all_resumes(self):
        if self.use_pg:
            try:
                conn = self._get_pg_conn()
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM evidence;")
                    cur.execute("DELETE FROM matches;")
                    cur.execute("DELETE FROM candidates;")
                conn.commit()
                conn.close()
                return
            except Exception as e:
                print(f"[DB Repository] PG delete_all_resumes error ({e}), using SQLite.")

        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM matches;")
        cur.execute("DELETE FROM candidates;")
        conn.commit()
        conn.close()

    def get_resumes(self) -> Dict[str, str]:
        if self.use_pg:
            try:
                conn = self._get_pg_conn()
                with conn.cursor() as cur:
                    cur.execute("SELECT candidate_id, document_id FROM candidates;")
                    rows = cur.fetchall()
                conn.close()
                return {r[0]: r[1] for r in rows}
            except Exception as e:
                print(f"[DB Repository] PG get_resumes error ({e}), using SQLite.")

        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("SELECT candidate_id, file_path FROM candidates;")
        rows = cur.fetchall()
        conn.close()
        return {r["candidate_id"]: r["file_path"] for r in rows}

    def get_resumes_detailed(self) -> List[Dict[str, Any]]:
        if self.use_pg:
            try:
                conn = self._get_pg_conn()
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT c.candidate_id, c.name, c.document_id, c.created_at,
                               COUNT(m.match_id) as match_count,
                               COALESCE(MAX(m.overall_score), 0) as top_score
                        FROM candidates c
                        LEFT JOIN matches m ON c.candidate_id = m.candidate_id
                        GROUP BY c.candidate_id, c.name, c.document_id, c.created_at
                        ORDER BY c.created_at DESC;
                    """)
                    rows = cur.fetchall()
                conn.close()
                return [{
                    "candidate_id": r[0],
                    "candidate_name": r[1] or r[0],
                    "name": r[1] or r[0],
                    "document_id": r[2],
                    "file_path": r[2],
                    "filename": os.path.basename(r[2]) if r[2] else r[0],
                    "created_at": r[3].isoformat() if r[3] else None,
                    "screened_jobs_count": int(r[4]),
                    "top_score": float(r[5])
                } for r in rows]
            except Exception as e:
                print(f"[DB Repository] PG get_resumes_detailed error ({e}), using SQLite.")

        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT c.candidate_id, c.name, c.document_id, c.file_path, c.created_at,
                   COUNT(m.match_id) as match_count,
                   COALESCE(MAX(m.overall_score), 0) as top_score
            FROM candidates c
            LEFT JOIN matches m ON c.candidate_id = m.candidate_id
            GROUP BY c.candidate_id, c.name, c.document_id, c.file_path, c.created_at
            ORDER BY c.created_at DESC;
        """)
        rows = cur.fetchall()
        conn.close()
        return [{
            "candidate_id": r["candidate_id"],
            "candidate_name": r["name"] or r["candidate_id"],
            "name": r["name"] or r["candidate_id"],
            "document_id": r["document_id"],
            "file_path": r["file_path"],
            "filename": os.path.basename(r["file_path"]) if r["file_path"] else r["document_id"],
            "created_at": str(r["created_at"]) if r["created_at"] else None,
            "screened_jobs_count": int(r["match_count"]),
            "top_score": float(r["top_score"])
        } for r in rows]

    # ── Matches & Evidence Persistence ────────────────────────────────────────
    def save_match_result(self, match_dict: Dict[str, Any]):
        match_id = match_dict["match_id"]
        job_id = match_dict["job_id"]
        candidate_id = match_dict["candidate_id"]
        score = match_dict.get("overall_score", 0.0)
        data_json = json.dumps(match_dict)

        if self.use_pg:
            try:
                sb = match_dict.get("score_breakdown", {})
                conn = self._get_pg_conn()
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO matches (match_id, candidate_id, job_id, overall_score, skill_score, experience_score, education_score, role_score, rank)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (match_id) DO UPDATE SET
                            overall_score = EXCLUDED.overall_score,
                            rank = EXCLUDED.rank;
                    """, (
                        match_id, candidate_id, job_id, score,
                        sb.get("skill_score", 0), sb.get("experience_score", 0),
                        sb.get("education_score", 0), sb.get("role_fit_score", 0),
                        match_dict.get("rank", 1)
                    ))

                    # Save evidence spans
                    for ev in match_dict.get("evidence_list", []):
                        cur.execute("""
                            INSERT INTO evidence (match_id, candidate_id, claim, source_document, page, text_span, confidence)
                            VALUES (%s, %s, %s, %s, %s, %s, %s);
                        """, (
                            match_id, candidate_id, ev.get("claim", ""),
                            ev.get("source_document", "resume"), ev.get("page", 1),
                            ev.get("text_span", ""), ev.get("confidence", 1.0)
                        ))

                conn.commit()
                conn.close()
                return
            except Exception as e:
                print(f"[DB Repository] PG save_match_result error ({e}), using SQLite.")

        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO matches (match_id, job_id, candidate_id, data, overall_score)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(match_id) DO UPDATE SET data = excluded.data, overall_score = excluded.overall_score;
        """, (match_id, job_id, candidate_id, data_json, score))
        conn.commit()
        conn.close()

    def get_matches_for_job(self, job_id: str) -> List[Dict[str, Any]]:
        conn = self._get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("SELECT data FROM matches WHERE job_id = ? ORDER BY overall_score DESC;", (job_id,))
        rows = cur.fetchall()
        conn.close()
        return [json.loads(r["data"]) for r in rows]

# Global instance
repo = TalentXRepository()

-- 001_initial_schema.sql
-- TalentX Database Schema with pgvector support

CREATE EXTENSION IF NOT EXISTS vector;

-- Table: candidates (parsed & structured candidate data)
CREATE TABLE IF NOT EXISTS candidates (
  candidate_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  name TEXT,                      -- kept separate from scoring path
  education JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: jobs (parsed job descriptions)
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  minimum_experience_months INT DEFAULT 0,
  education_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  domain TEXT DEFAULT 'General',
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: matches (screening evaluation results)
CREATE TABLE IF NOT EXISTS matches (
  match_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  overall_score NUMERIC(5,2) NOT NULL,
  skill_score NUMERIC(5,2) NOT NULL,
  experience_score NUMERIC(5,2) NOT NULL,
  education_score NUMERIC(5,2) NOT NULL,
  role_score NUMERIC(5,2) NOT NULL,
  gap_penalty NUMERIC(5,2) DEFAULT 0.0,
  confidence TEXT DEFAULT 'HIGH',
  rank INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: evidence (traceable source spans for claims)
CREATE TABLE IF NOT EXISTS evidence (
  evidence_id SERIAL PRIMARY KEY,
  match_id TEXT REFERENCES matches(match_id) ON DELETE CASCADE,
  candidate_id TEXT REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  source_document TEXT NOT NULL,
  page INT DEFAULT 1,
  text_span TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: skills_taxonomy (ESCO offline skills subset)
CREATE TABLE IF NOT EXISTS skills_taxonomy (
  skill_id SERIAL PRIMARY KEY,
  concept_uri TEXT UNIQUE,
  preferred_label TEXT NOT NULL,
  alt_labels JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  embedding vector(384)
);

CREATE INDEX IF NOT EXISTS idx_candidates_document ON candidates(document_id);
CREATE INDEX IF NOT EXISTS idx_matches_candidate_job ON matches(candidate_id, job_id);
CREATE INDEX IF NOT EXISTS idx_evidence_match ON evidence(match_id);

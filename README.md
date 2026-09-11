<div align="center">
  <img src="logo.png" alt="TalentX Logo" width="180"/>
  <h1>TalentX</h1>
  <p><strong>Multi-Agent AI Resume Screening Platform</strong></p>
  <p>Evidence-grounded · Deterministic scoring · Fairness-first · PII-safe</p>

  <p>
    <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white" alt="Python"/>
    <img src="https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi&logoColor=white" alt="FastAPI"/>
    <img src="https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white" alt="Next.js"/>
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
    <img src="https://img.shields.io/badge/SQLite%20%7C%20PostgreSQL-supported-336791?logo=postgresql&logoColor=white" alt="Database"/>
    <img src="https://img.shields.io/badge/LLM-NVIDIA%20NIM%20%7C%20Groq%20%7C%20Gemini-76B900?logo=nvidia&logoColor=white" alt="LLM"/>
  </p>
</div>

---

## Overview

**TalentX** is a full-stack, multi-agent AI platform that automates resume screening with transparency and fairness at its core. Upload resumes and job descriptions — the pipeline extracts structured data, matches candidates against requirements, computes a deterministic score, identifies skill gaps, and generates recruiter-ready prose summaries. Everything is evidence-grounded: every extracted skill, experience, and qualification is backed by a verbatim snippet from the source document.

### Key Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Evidence-grounded** | Every extracted skill carries an `evidence_span` (verbatim source text) and `page_number` |
| **Deterministic scoring** | `scorer.py` is pure Python math — zero LLM calls, zero network calls |
| **Fairness-first** | Name, gender, age, photo, religion, caste are never passed to the scoring function |
| **No hallucination** | Agents never fabricate data; heuristic fallback only states what it finds in the text |
| **Offline resilience** | Works without any LLM API key via a heuristic regex fallback |

---

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Jobs Board
![Jobs](docs/screenshots/jobs.png)

### Resume Upload
![Upload](docs/screenshots/upload.png)

### Job Detail & Candidate Rankings
![Job Detail](docs/screenshots/job_detail.png)

### Create New Job
![New Job](docs/screenshots/new_job.png)

---

## Architecture

```
Resume PDF/DOCX  ──►  Resume Agent  ──►  ExtractedResume (with Evidence)
                                               │
Job Text/PDF      ──►  Job Agent     ──►  ExtractedJob
                                               │
                                               ▼
                                        Matching Agent  ──►  scorer.py (Deterministic)
                                               │
                                               ▼
                                        Skill Gap Agent ──►  Severity Breakdown
                                               │
                                               ▼
                                        Recruiter Agent ──►  Prose Summary
                                               │
                                               ▼
                                        FastAPI REST API ──► Next.js Dashboard
```

### Agent Responsibilities

| Agent | File | Role |
|-------|------|------|
| **Resume Agent** | `packages/agents/resume_agent.py` | Parse PDF/DOCX/TXT → `ExtractedResume` with evidence |
| **Job Agent** | `packages/agents/job_agent.py` | Parse job descriptions → `ExtractedJob` |
| **Matching Agent** | `packages/agents/matching_agent.py` | Align candidate skills vs job requirements |
| **Scorer** | `packages/scoring/scorer.py` | Deterministic weighted formula (no LLM) |
| **Skill Gap Agent** | `packages/agents/skill_gap_agent.py` | Classify missing skills by severity |
| **Recruiter Agent** | `packages/agents/recruiter_agent.py` | Generate structured prose summary |
| **Outreach Agent** | `packages/agents/outreach_agent.py` | Draft personalised outreach emails |
| **Orchestrator** | `packages/agents/orchestrator.py` | Run full N×M pipeline with retry & PII strip |

### Scoring Formula

```
final_score = (
  0.35 × required_skill_score   +
  0.10 × preferred_skill_score  +
  0.20 × experience_score       +
  0.10 × responsibility_similarity +
  0.10 × role_domain_similarity +
  0.05 × education_score        +
  0.05 × project_relevance      +
  0.05 × certification_relevance
) − gap_penalty          ← −8 pts per missing required skill beyond the first
```

Scores are normalised to **0–100**.

---

## Tech Stack

### Backend (`apps/api`)
- **FastAPI** — REST API, async, OpenAPI docs at `/docs`
- **Python 3.10+** — agents, scoring, schema validation
- **Pydantic v2** — strict schema validation for all agent I/O
- **pdfplumber / pypdf** — PDF text extraction
- **SQLite** (default) · **PostgreSQL / Supabase** (production) — persistent storage

### Frontend (`apps/web`)
- **Next.js 14** (App Router) — SSR + client components
- **TypeScript** — full type safety
- **Vanilla CSS** — glassmorphism dark-mode design system

### LLM Providers (all optional — heuristic fallback built-in)
- **NVIDIA NIM** — `meta/llama-3.3-70b-instruct` (primary, 3-key round-robin)
- **Groq** — `llama-3.3-70b-versatile` (secondary, 2-key round-robin)
- **Google Gemini** — fallback

---

## Project Structure

```
TalentX/
├── apps/
│   ├── api/                   # FastAPI backend
│   │   ├── main.py            # All REST endpoints + in-memory state
│   │   └── requirements.txt
│   └── web/                   # Next.js frontend
│       └── src/
│           ├── app/
│           │   ├── page.tsx           # Dashboard
│           │   ├── jobs/              # Jobs list & detail
│           │   └── resumes/upload/    # Resume upload
│           ├── components/
│           │   ├── Sidebar.tsx
│           │   └── OutreachModal.tsx
│           └── lib/api.ts             # API client
├── packages/
│   ├── agents/                # Multi-agent pipeline
│   │   ├── orchestrator.py
│   │   ├── resume_agent.py
│   │   ├── job_agent.py
│   │   ├── matching_agent.py
│   │   ├── skill_gap_agent.py
│   │   ├── recruiter_agent.py
│   │   ├── outreach_agent.py
│   │   └── llm_client.py      # Multi-provider LLM client w/ fallback
│   ├── schemas/               # Pydantic models
│   │   ├── resume.py
│   │   ├── job.py
│   │   ├── match.py
│   │   └── evidence.py
│   └── scoring/
│       └── scorer.py          # Deterministic scoring (zero LLM)
├── db/
│   ├── repository.py          # SQLite / PostgreSQL abstraction
│   ├── setup_db.py
│   └── migrations/
├── data/
│   ├── sample_resumes/        # Demo resume files
│   ├── sample_jobs/           # Demo job descriptions
│   └── uploads/               # Runtime upload directory
├── docs/screenshots/          # README screenshots
├── .env.example
└── AGENTS.md                  # Architectural contracts for AI agents
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) PostgreSQL / Supabase for production persistence
- (Optional) API key for NVIDIA NIM, Groq, or Google Gemini

### 1. Clone the repository

```bash
git clone https://github.com/jatinrahinj2006-boop/TalentX.git
cd TalentX
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
# LLM — at least one provider recommended (all optional, heuristic fallback built-in)
NVIDIA_NIM_API_KEY_1=your_key_here
GROQ_API_KEY_1=your_key_here
GEMINI_API_KEY=your_key_here

# Database — leave blank to use SQLite (default)
DATABASE_URL=postgresql://user:pass@localhost:5432/talentx
```

### 3. Set up the Python backend

```bash
# Install Python dependencies
pip install -r apps/api/requirements.txt

# Optional: install pdfplumber for better PDF extraction
pip install pdfplumber

# Start the API server
cd apps/api
uvicorn main:app --reload --port 8000
```

The API will be available at **http://localhost:8000**. Interactive docs at **http://localhost:8000/docs**.

### 4. Set up the frontend

```bash
cd apps/web
npm install
npm run dev
```

The dashboard will be available at **http://localhost:3000**.

---

## Usage

### Quick Demo (One-Click Seed)

Hit the **"Seed Demo Data"** button on the dashboard, or call the API:

```bash
curl -X POST http://localhost:8000/api/v1/seed-demo-data
```

This loads the sample resumes and job descriptions from `data/` and runs the full pipeline automatically.

### Manual Flow

#### 1. Upload Resumes
Navigate to **Resume Upload** (`/resumes/upload`) and drag-drop PDF, DOCX, or TXT files. Supports bulk upload.

```bash
# Via API
curl -X POST http://localhost:8000/api/v1/resumes \
  -F "file=@path/to/resume.pdf"
```

#### 2. Create a Job
Use **New Job** (`/jobs/new`) to paste a job description, or upload a JD file:

```bash
curl -X POST http://localhost:8000/api/v1/jobs/text \
  -H "Content-Type: application/json" \
  -d '{"title": "Senior Backend Engineer", "description": "...", "domain": "Software Engineering"}'
```

#### 3. Run Screening
Click **"Screen All"** on the dashboard or call:

```bash
curl -X POST http://localhost:8000/api/v1/run-screening
```

The pipeline runs N resumes × M jobs and produces ranked candidate lists with scores, evidence, and prose summaries.

#### 4. Review Results
Navigate to any job to see ranked candidates, score breakdowns, skill gaps, and evidence spans.

#### 5. Generate Outreach Email
Click **"Generate Outreach"** on any candidate card to get a personalised email draft with a `mailto:` link.

#### 6. Delete Resumes
Remove individual resumes using the delete button on the dashboard, or clear all:

```bash
# Delete single resume
curl -X DELETE http://localhost:8000/api/v1/resumes/C001

# Delete all resumes
curl -X DELETE http://localhost:8000/api/v1/resumes
```

---

## API Reference

Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/resumes` | List all uploaded resumes |
| `POST` | `/resumes` | Upload a single resume |
| `POST` | `/resumes/bulk` | Bulk upload resumes |
| `DELETE` | `/resumes/{id}` | Delete a resume |
| `DELETE` | `/resumes` | Delete all resumes |
| `GET` | `/jobs` | List all jobs |
| `POST` | `/jobs` | Upload a job description file |
| `POST` | `/jobs/text` | Create job from text input |
| `GET` | `/jobs/{id}` | Get job details |
| `POST` | `/run-screening` | Run the full screening pipeline |
| `GET` | `/screening-status` | Get pipeline status |
| `GET` | `/jobs/{id}/candidates` | Get ranked candidates for a job |
| `GET` | `/jobs/{id}/candidates/{cid}` | Get detailed candidate match |
| `POST` | `/jobs/{id}/candidates/{cid}/outreach` | Generate outreach email |
| `POST` | `/seed-demo-data` | Load sample data and run pipeline |

Full interactive docs: **http://localhost:8000/docs**

---

## Features

- **📄 Resume Parsing** — PDF, DOCX, TXT with multi-strategy name extraction and contact info parsing
- **💼 Job Parsing** — Upload JD files or paste text; structured extraction of skills, experience requirements, responsibilities
- **🤖 Multi-Agent Pipeline** — 5-stage pipeline: Parse → Match → Score → Gap-Analyse → Summarise
- **📊 Deterministic Scoring** — Weighted formula, no LLM in the scoring path, fully auditable
- **🎯 Skill Gap Analysis** — Missing skills classified by severity with evidence grounding
- **📝 Recruiter Summaries** — Auto-generated prose summaries for each candidate-job pair
- **✉️ Outreach Emails** — Personalised email drafts with one-click `mailto:` links
- **🔒 PII Protection** — Demographic attributes excluded from all scoring paths
- **🗄️ Persistent Storage** — SQLite (default) or PostgreSQL / Supabase
- **🗑️ Resume Management** — Upload, view, and delete resumes from the dashboard
- **⚡ Offline Resilience** — Full heuristic fallback when no LLM API key is configured
- **🔑 Multi-LLM** — Round-robin key rotation across NVIDIA NIM, Groq, and Gemini

---

## Development

### Architectural Contracts

The `AGENTS.md` file at the root defines strict rules for AI agents and developers:

1. **Scoring Isolation** — `packages/scoring/scorer.py` must never make LLM or network calls
2. **Schema Enforcement** — All agent outputs must validate against Pydantic models in `packages/schemas/`
3. **Evidence Grounding** — Every extracted claim must carry an `evidence_span` and `page_number`
4. **Recruiter Constraint** — The Recruiter Agent may only reference facts in the structured match object
5. **Fairness** — Sensitive attributes (name, gender, age, photo, etc.) never reach `scorer.py`

### Directory Ownership

| Tool | Owns |
|------|------|
| Backend dev | `packages/agents/`, `packages/scoring/`, `packages/knowledge/` |
| Full-stack dev | `apps/api/`, `apps/web/`, `db/migrations/` |

### Running Tests

```bash
# From the project root
pytest packages/ -v
```

---

## Database

TalentX automatically chooses its storage backend:

| Condition | Backend |
|-----------|---------|
| `DATABASE_URL` set and reachable | **PostgreSQL / Supabase** |
| Otherwise | **SQLite** at `db/talentx.db` |

The SQLite database is committed to the repository for convenience during development. For production, configure a PostgreSQL connection string.

---

## License

MIT — see `LICENSE` for details.

---

<div align="center">
  <p>Built with ❤️ · Evidence-grounded · Fairness-first</p>
</div>

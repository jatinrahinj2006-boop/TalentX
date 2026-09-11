# TalentX — Implementation Plan for PS03 (Multi-Agent Resume Screening & Job Matching)

This plan takes your uploaded research plan and the official PS03 statement and turns them
into something buildable in a hackathon timeframe with **Antigravity** (Google's agent-first
IDE, Gemini 3 Pro) and **OpenCode** (terminal-native, provider-agnostic coding agent). It
keeps the good architecture from the research plan and fixes the parts that don't survive
contact with a real clock.

---

## 0. What changes from the research plan, and why

The research plan is directionally right (hybrid deterministic scoring, not "LLM guesses a
number") but it is scoped like a thesis, not a hackathon deliverable. Concrete fixes:

| Research plan said | Problem | Fix |
|---|---|---|
| 12 build phases | Too granular to track with two tools and a small team; phase boundaries overlap in practice | Collapse to **6 phases** (below), each a checkpoint you can demo |
| 6-agent architecture (Orchestrator + 5 + Fairness/Evidence Validator = 7 boxes) | PS03 names exactly 5 agents. Judges will look for those names. Extra boxes on the diagram invite "why do you have 7 agents when the brief says 5?" | Keep the same *code*, but present it as **the 5 required agents**, with Orchestrator and Fairness/Evidence Validator reframed as **infrastructure inside the pipeline**, not agents. Name them "Orchestration layer" and "Validation layer" on the architecture slide. |
| Full ESCO integration + NCO mapping via live API | ESCO's API has real latency and occasional downtime; you don't want a network dependency in your demo path | **Download the ESCO skills CSV once, offline, at project start.** Load a filtered subset (tech/data/engineering occupations only, ~2–3k skills) into Postgres. No live ESCO calls during the demo. NCO mapping becomes a *stretch item*, not a dependency — cut it first if time is short. |
| ColBERT-style reranking | Correct research citation, unnecessary complexity | A single cross-encoder call (or even a second, more detailed LLM-based comparison prompt) on just the top-K candidates is enough. Don't implement late-interaction retrieval. |
| Local-first model strategy (local embeddings + optional cloud LLM + local LLM fallback) | Three code paths to maintain and debug under time pressure | **One embedding model** (sentence-transformers, local, `all-MiniLM-L6-v2` or `bge-small-en`, no API at all) + **one no-card-required cloud LLM provider** for extraction/explanation — see section 5b for the shortlist. Add a fallback provider only if you have spare time in Phase 6. |
| Data model with 4 separate entities incl. a generic `embedding` column type | Under-specified for Postgres | Use `pgvector` explicitly, specify vector dimension (384 for MiniLM), and add this schema in section 3 below — copy-paste ready. |
| "Fairness evaluation" as a full paired-resume audit suite | Good idea, too much for the time you have | Ship the **PII-masking + sensitive-attribute exclusion** (cheap, high demo value) in Phase 6. Treat the full bias-audit methodology (NDCG-based fairness metrics, paired resumes) as a **documented stretch goal you can describe verbally** to judges, not a shipped feature, unless Phase 1–5 finish early. |
| "TalentX" branding, 5-min demo script | Good | Kept as-is — see section 9. |

Everything else in the research plan (the scoring formula, the JSON schemas, the evidence-grounding
principle, "agents reason, algorithms decide, evidence proves") is sound and is carried forward below.

---

## 1. Non-negotiable scope for the demo

The PS03 demonstration requirement is exact: **10 resumes + 3 job descriptions → ranked
candidate list**. Everything in this plan is sized against that, not against a production
recruiting platform. If a feature doesn't make that demo better or make the code more
defensible under questioning, it's cut.

**Must ship:**
1. Resume Agent (PDF/DOCX → structured JSON, with evidence spans)
2. Job Agent (JD text → structured JSON, required vs preferred skills)
3. Matching Agent (deterministic scoring formula + embeddings, not "LLM says 87%")
4. Skill Gap Agent (matched / partial / missing, severity)
5. Recruiter Agent (LLM-generated summary, grounded in structured evidence only)
6. Orchestration layer that runs the above as a pipeline for N resumes × M jobs
7. A dashboard: job list → ranked candidates → candidate detail with evidence → compare 2 candidates
8. PII masking (name/photo/gender/age excluded from scoring, shown as a toggle in the UI)

**Cut list if time runs short (in this order):**
1. NCO mapping
2. Cross-encoder reranking (fall back to embedding similarity + rule score only)
3. Full fairness/bias audit suite (keep only PII masking)
4. "Compare candidates" screen (nice-to-have, not required by PS03)
5. Confidence scores on extraction

---

## 2. Repository structure

```
hiremind/
├── apps/
│   ├── web/                     # Next.js frontend
│   └── api/                     # FastAPI backend
├── packages/
│   ├── agents/                  # Python — one module per agent
│   │   ├── resume_agent.py
│   │   ├── job_agent.py
│   │   ├── matching_agent.py
│   │   ├── skill_gap_agent.py
│   │   ├── recruiter_agent.py
│   │   └── orchestrator.py
│   ├── knowledge/                # ESCO subset loader, skill normalization, synonym dict
│   │   ├── esco_subset.csv
│   │   └── skill_normalizer.py
│   ├── scoring/                  # pure functions, unit-testable, no LLM calls
│   │   └── scorer.py
│   └── schemas/                  # pydantic models shared by agents + API
│       ├── resume.py
│       ├── job.py
│       ├── match.py
│       └── evidence.py
├── data/
│   ├── sample_resumes/           # 10+ PDFs for the demo
│   └── sample_jobs/               # 3 JDs for the demo
├── db/
│   └── migrations/
├── AGENTS.md                     # instructions for OpenCode / any CLI agent working in this repo
└── docs/
    └── architecture.md
```

`AGENTS.md` at the repo root is read automatically by most terminal coding agents (OpenCode
included) — put your scoring formula, schema contracts, and "LLM never sets the final score"
rule in there so every agent session respects it without you repeating yourself.

---

## 3. Data contracts (freeze these before writing agent code)

### Candidate (Postgres + pgvector)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE candidates (
  candidate_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  name TEXT,                      -- kept separate from scoring path
  education JSONB,
  experience JSONB,
  skills JSONB,
  projects JSONB,
  certifications JSONB,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE jobs (
  job_id TEXT PRIMARY KEY,
  title TEXT,
  required_skills JSONB,
  preferred_skills JSONB,
  minimum_experience_months INT,
  education_requirements JSONB,
  responsibilities JSONB,
  domain TEXT,
  embedding vector(384)
);

CREATE TABLE matches (
  match_id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES candidates(candidate_id),
  job_id TEXT REFERENCES jobs(job_id),
  overall_score NUMERIC,
  skill_score NUMERIC,
  experience_score NUMERIC,
  education_score NUMERIC,
  role_score NUMERIC,
  gap_penalty NUMERIC,
  confidence TEXT,
  rank INT
);

CREATE TABLE evidence (
  evidence_id SERIAL PRIMARY KEY,
  match_id TEXT REFERENCES matches(match_id),
  claim TEXT,
  source_document TEXT,
  page INT,
  text_span TEXT,
  confidence NUMERIC
);
```

### Resume Agent output (pydantic / JSON Schema)
Use the JSON shape from the research plan as-is — it's correct — with one addition: every
`skills[i]` entry must carry `evidence_span` and `page_number`, not just top-level fields,
because the Skill Gap and Recruiter agents both need per-skill evidence, not per-resume evidence.

```json
{
  "candidate_id": "C001",
  "name": "Candidate A",
  "education": [{"degree": "B.Tech", "field": "Computer Science", "institution": "...", "year": 2024}],
  "experience": [{"role": "ML Engineer", "company": "...", "duration_months": 24, "responsibilities": []}],
  "skills": [
    {"name": "Python", "evidence_span": "Built ML pipelines using Python...", "page_number": 1, "confidence": 0.95}
  ],
  "projects": [], "certifications": [], "achievements": []
}
```

### Job Agent output — same as research plan, unchanged (it's already correct):
required_skills / preferred_skills with `importance` and `weight`, `minimum_experience_months`,
`domain`.

---

## 4. Architecture (what you show on the slide)

```
                        ┌─────────────────────┐
                        │   Recruiter UI       │
                        └──────────┬───────────┘
                                   │ upload resumes + JDs
                                   ▼
                    ┌───────────────────────────────┐
                    │   Orchestration layer          │   ← infra, not "agent #6"
                    │   (routes work, retries,        │
                    │    aggregates results)          │
                    └───────────────┬─────────────────┘
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                   ▼
         ┌───────────────┐ ┌───────────────┐   ┌──────────────────┐
         │ Resume Agent   │ │ Job Agent      │   │ Knowledge layer   │
         │                │ │                │   │ (ESCO subset,      │
         └───────┬────────┘ └───────┬────────┘   │  synonyms)         │
                 │                  │             └──────────┬─────────┘
                 ▼                  ▼                        │
          Resume Schema       Job Schema  ◄────────────────────┘
                 │                  │
                 └────────┬─────────┘
                          ▼
                 ┌──────────────────┐
                 │  Matching Agent   │   embeddings (retrieval) + rule-based score (ranking)
                 └────────┬──────────┘
                          ▼
                 ┌──────────────────┐
                 │ Skill Gap Agent   │
                 └────────┬──────────┘
                          ▼
                 ┌──────────────────────┐
                 │ Validation layer      │   ← infra, not "agent #7"
                 │ (evidence check,      │
                 │  PII exclusion)       │
                 └────────┬───────────────┘
                          ▼
                 ┌──────────────────┐
                 │ Recruiter Agent   │   generates prose FROM structured evidence only
                 └────────┬──────────┘
                          ▼
                   Ranked Candidates
```

Central rule to repeat to judges and to bake into every prompt: **agents reason, algorithms
decide, evidence proves.** The LLM extracts and explains; the scoring engine computes the
number; nothing reaches the UI without a traceable `evidence_span`.

---

## 5. Scoring formula (final, implementable)

```
final_score =
    0.35 * required_skill_score +
    0.10 * preferred_skill_score +
    0.20 * experience_score +
    0.10 * responsibility_similarity +
    0.10 * role_domain_similarity +
    0.05 * education_score +
    0.05 * project_relevance +
    0.05 * certification_relevance
  - gap_penalty
```

- `required_skill_score`: average of per-skill match scores (1.0 exact/synonym, ~0.7 semantic
  ≥0.8 cosine sim, ~0.4 related/partial, 0 missing) restricted to skills marked `must`.
- `gap_penalty`: fixed deduction (e.g. 8 points) per **missing required** skill beyond one; do
  not zero out the candidate — show the score with a visible penalty note instead.
- Do not let embedding cosine similarity alone stand in for the final score (this is the
  research plan's own point in "why not just use cosine similarity" — keep that reasoning,
  it's correct and worth repeating to judges).

```python
# packages/scoring/scorer.py — pure function, unit-testable, no LLM/network calls
def score_candidate(resume: dict, job: dict, skill_matches: list[dict]) -> dict:
    required = [s for s in skill_matches if s["importance"] == "must"]
    preferred = [s for s in skill_matches if s["importance"] == "preferred"]
    skill_score = _avg(s["match_value"] for s in required) if required else 1.0
    preferred_score = _avg(s["match_value"] for s in preferred) if preferred else 1.0
    experience_score = _experience_score(resume["experience"], job["minimum_experience_months"])
    ...
    missing_required = sum(1 for s in required if s["match_value"] == 0)
    gap_penalty = max(0, missing_required - 1) * 8
    overall = (0.35*skill_score + 0.10*preferred_score + 0.20*experience_score + ...) - gap_penalty
    return {"overall_score": round(overall, 1), "skill_score": skill_score, ...}
```

Keep this file free of any LLM or network calls — it should be unit-testable with a handful of
fixture JSON files. That separation is itself a good answer to "how do we know your score
isn't the LLM making it up."

---

## 5b. LLM API providers — no billing/top-up required

You only need the LLM for extraction help (Resume/Job Agent, when regex/NER isn't enough) and
prose generation (Recruiter Agent, Skill Gap explanations) — the scoring engine itself never
calls an LLM. Pick from providers that give you a working key with **no card on file**:

| Provider | Why it fits | Notes |
|---|---|---|
| **Groq** | Fast (LPU hardware), OpenAI-compatible API, no card required to get a key. Good default for both extraction and the Recruiter Agent's prose generation, since low latency matters when you're running it across 10 resumes × 3 jobs live in a demo. | Free tier is rate-limited (requests/min and requests/day) — fine for hackathon volume, watch the limit if you re-run the full pipeline repeatedly while debugging. |
| **Google AI Studio (Gemini API)** | No card required, generous free quota, strong at structured extraction (JSON mode) which is most of what Resume/Job Agent need. | Good second choice or primary if you want longer context for parsing dense resumes. |
| **Mistral AI ("Experiment" free tier)** | No card required, explicitly states no credit card needed, large monthly token allowance. | Lower requests-per-minute than Groq — better for batch extraction jobs than live demo interaction. |
| **OpenRouter (free `:free` models)** | No card for the free tier, gives you access to several open models through one API, useful as a single fallback if your primary provider rate-limits mid-demo. | Free tier caps around 50 requests/day unless you add credit — treat as backup, not primary. |
| **Cloudflare Workers AI / NVIDIA NIM** | Also no-card free tiers, useful if you want an alternate embedding or small-model endpoint. | Lower priority — only reach for these if Groq/Gemini/Mistral are all rate-limited during testing. |

**Recommended setup:** Groq as primary (speed matters for a live demo), Google AI Studio as
secondary/fallback (better at strict JSON extraction if Groq's output gets sloppy on messy
resumes), Mistral as a third option if you're doing a big batch re-run and don't want to worry
about rate limits. Explicitly avoid Anthropic's Claude API and OpenAI's API for this project —
both require adding a payment method and topping up credit before the key works, which is the
exact friction you're trying to avoid. (Anthropic's consumer chat app, Claude.ai, is free to use
in a browser, but that's a different thing from the API key you'd call from `apps/api` — the
API itself is billed.)

Wire this into `packages/agents/` as a single `LLMProvider` interface (one function:
`generate(prompt) -> str`) so swapping Groq for Gemini mid-hackathon is a one-line change, not a
rewrite — see the interface pattern in your original research doc, it's worth keeping even
though the three-tier fallback strategy around it isn't.

---

## 6. Six-phase build plan

Each phase ends with something you can run end-to-end, not just a component in isolation.

| Phase | Deliverable | Owner tool | Rough time |
|---|---|---|---|
| **1. Spec freeze** | Repo scaffolding, schemas (section 3), scoring formula frozen, sample data loaded | Antigravity (Manager surface — let it scaffold the monorepo, DB migrations, empty agent stubs) | 0.5 day |
| **2. Extraction** | Resume Agent + Job Agent working on the 10 sample resumes + 3 JDs, producing valid JSON with evidence spans | OpenCode (tight loop: write extraction prompt → run on one PDF → inspect JSON → fix → repeat) | 1 day |
| **3. Knowledge + Matching** | ESCO subset loaded, skill normalizer, embeddings computed and stored in pgvector, `scorer.py` unit-tested against 3–4 hand-scored pairs | OpenCode for `scorer.py` (needs tight edit/test loops); Antigravity for the ESCO ingestion script + DB migration | 1 day |
| **4. Skill Gap + Recruiter Agent** | Gap detection (missing/partial/matched + severity), Recruiter Agent prose generation grounded only in structured evidence | OpenCode | 1 day |
| **5. Orchestration + API** | FastAPI endpoints that run the full pipeline for N resumes × M jobs and return ranked matches; retry/validation logic | Antigravity (multi-file, cross-cutting — good fit for its whole-task planning) | 0.5–1 day |
| **6. UI + polish** | Next.js dashboard (job list → ranked candidates → candidate detail with clickable evidence), PII masking toggle, demo run-through | Antigravity (it can drive the browser to verify the UI actually renders and click through it itself) | 1–1.5 days |

Total: roughly 5–6 focused days. Compress by running Phase 2 and the ESCO half of Phase 3 in
parallel if you have two people.

---

## 7. Splitting the work between Antigravity and OpenCode

They're not redundant — use each for what it's actually better at:

- **OpenCode** — terminal-native, fast edit/test/run loops, good for the parts where you need
  to iterate quickly on one file at a time and watch the output (extraction prompts, the scoring
  function, unit tests). Use `opencode run "..."` for scripted, repeatable extraction runs across
  all 10 sample resumes instead of doing it one-by-one in the TUI.
- **Antigravity** — agent-first, can plan and execute a whole task across editor + terminal +
  browser autonomously, and its "Artifacts" give you a reviewable trail (task plan, screenshots,
  browser verification) that's genuinely useful for a judge-facing writeup. Use it for
  cross-cutting work (repo scaffolding, the orchestration/API layer that touches every schema,
  and the frontend — where it can literally open the browser and click through the dashboard to
  confirm it works before handing control back to you).

Practical rule to avoid the two tools fighting each other: **one tool owns one directory at a
time.** Don't run both agents against `packages/agents/` simultaneously. A clean split:
OpenCode owns `packages/agents/`, `packages/scoring/`, `packages/knowledge/`; Antigravity owns
`apps/api/`, `apps/web/`, `db/migrations/`, and repo-level scaffolding. Commit after each phase
so the other tool always starts from a clean, working state.

Put the shared contract in `AGENTS.md` at the repo root (both tools respect this convention),
e.g.:

```markdown
# AGENTS.md

- Scoring formula lives ONLY in packages/scoring/scorer.py. No LLM calls in that file.
- All agent outputs must validate against packages/schemas/*.py (pydantic).
- Every skill claim needs an evidence_span + page_number. Reject/flag any agent output missing one.
- Recruiter Agent must only reference facts present in the structured match + evidence objects
  passed to it — no browsing the raw resume text at generation time.
- Sensitive attributes (name, gender, age, photo, religion, caste, marital status, address)
  must never be passed into the scoring functions in packages/scoring/.
```

---

## 8. Ready-to-paste task prompts

**Phase 1 — give to Antigravity (Manager surface):**
> Scaffold a monorepo called `hiremind` with `apps/web` (Next.js + TypeScript + Tailwind),
> `apps/api` (FastAPI), `packages/agents`, `packages/scoring`, `packages/schemas`,
> `packages/knowledge`, and `db/migrations`. Create the Postgres schema in
> [paste section 3 SQL]. Add empty stub files for resume_agent.py, job_agent.py,
> matching_agent.py, skill_gap_agent.py, recruiter_agent.py, orchestrator.py with docstrings
> describing their input/output contracts from [paste section 3 JSON schemas]. Create an
> AGENTS.md at the repo root with [paste section 7 block]. Verify the API boots and the DB
> migration applies cleanly before finishing.

**Phase 2 — give to OpenCode:**
> In packages/agents/resume_agent.py, implement extraction of PDF/DOCX resumes into the JSON
> schema in packages/schemas/resume.py. Use pdfplumber for text extraction. For each detected
> skill, education entry, and experience entry, capture the exact source text span and page
> number as evidence_span/page_number. Validate output against the pydantic schema before
> returning. Test against the 10 files in data/sample_resumes/ and print any that fail
> validation.

**Phase 3 — give to OpenCode (scorer) and Antigravity (ESCO ingestion) separately:**
> (OpenCode) Implement packages/scoring/scorer.py per the formula in docs/architecture.md
> section 5. No network or LLM calls in this file. Write pytest tests using 4 fixture
> candidate/job pairs with hand-computed expected scores.
> (Antigravity) Write a one-time ingestion script that loads a filtered ESCO skills CSV
> (tech/data/engineering occupations only) into a `skills_taxonomy` table, and a
> skill_normalizer.py that maps raw extracted skill strings to ESCO concepts via exact match
> then embedding similarity fallback.

**Phase 4 — give to OpenCode:**
> Implement skill_gap_agent.py: given a candidate's matched skills and a job's required/preferred
> skills, classify each required/preferred skill as matched, partial, or missing, and assign
> severity (HIGH for missing required, MEDIUM for missing preferred or partial required, LOW for
> missing preferred that's non-critical). Implement recruiter_agent.py: given the match object,
> skill gap object, and evidence list ONLY (not raw resume text), generate a short recruiter
> summary with a recommendation line. Refuse silently (log a warning, omit the claim) if asked
> to reference something with no evidence_span.

**Phase 5 — give to Antigravity:**
> Build FastAPI endpoints: POST /jobs, POST /resumes (bulk upload), POST /run-screening
> (orchestrates resume agent → job agent → matching agent → skill gap agent → recruiter agent
> for all candidate×job pairs), GET /jobs/{id}/candidates (ranked). Implement orchestrator.py to
> call each agent, validate each agent's output against its schema, and retry once on validation
> failure before surfacing an error. Confirm the full pipeline runs against the 10 sample resumes
> and 3 sample jobs without manual intervention.

**Phase 6 — give to Antigravity:**
> Build the Next.js dashboard: job list with candidate counts and top match %, job detail page
> showing ranked candidates, candidate detail page showing score breakdown and a "Why?" panel
> that highlights the evidence_span backing each skill claim, and a PII-mask toggle that hides
> name/photo and confirms scoring is unaffected. Use the browser tool to click through the full
> demo flow (upload → run screening → view ranking → open a candidate → toggle masking) and
> confirm it works before finishing.

---

## 9. Demo script (kept from the research plan, unchanged — it's good)

1. Upload 10 resumes.
2. Upload 3 job descriptions.
3. Click "Run AI Screening" — show the agent checklist animating (Resume Agent ✓, Job Agent ✓,
   Matching Agent ✓, Skill Gap Agent ✓, Recruiter Agent ✓).
4. Open one job — show the ranked list (e.g. Candidate A 92%, F 88%, C 84%...).
5. Open Candidate A — show the score, required-skills checklist, and one flagged gap
   (e.g. "⚠ Kubernetes — missing").
6. Click "Why?" on a matched skill — show the exact resume text span the claim is grounded in.
   This is the single most important moment in the demo: it's the evidence-grounding story.
7. (If time) Compare Candidate A vs B on the same job, with a one-line "why A ranks higher."

---

## 10. Open items to verify before you build

- Get a Groq API key (and a Google AI Studio key as backup) set up in both Antigravity and
  OpenCode's provider config before Phase 2 starts — don't let this block extraction work. No
  card needed for either.
- Decide now whether NCO mapping and the cross-encoder reranker are in scope; if you're not
  sure you have 6 full days, cut them at the start rather than mid-build.
- Confirm your sample resume/JD dataset (Kaggle Resume Entities 2019, or the Djinni dataset
  subset) is downloaded and license-checked before Phase 1 finishes, since Phase 2 depends on it.

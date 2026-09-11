# TalentX Architecture & Data Flow

## Pipeline Overview
The TalentX multi-agent pipeline processes resumes against job descriptions through a deterministic, evidence-grounded sequence:

1. **Resume Agent**: Extracts structured resume details with explicit `evidence_span` text snippets and page numbers.
2. **Job Agent**: Extracts structured job requirements, categorizing skills into required vs. preferred.
3. **Knowledge Layer**: Normalizes extracted skills to ESCO canonical taxonomy concepts.
4. **Matching Agent & Scorer**: Computes vector similarity and deterministic score using `packages/scoring/scorer.py`.
5. **Skill Gap Agent**: Classifies missing and partial skills with severity levels (HIGH / MEDIUM / LOW).
6. **Validation Layer**: Filters out PII / sensitive attributes and verifies evidence backing.
7. **Recruiter Agent**: Generates prose summary restricted to structured match results.

## Scoring Formula
```
final_score = (
    0.35 * required_skill_score +
    0.10 * preferred_skill_score +
    0.20 * experience_score +
    0.10 * responsibility_similarity +
    0.10 * role_domain_similarity +
    0.05 * education_score +
    0.05 * project_relevance +
    0.05 * certification_relevance
) - gap_penalty
```

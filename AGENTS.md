# AGENTS.md — Global AI Agent Rules & Architectural Contracts

This file is automatically loaded by Antigravity, OpenCode, and any terminal-native AI agents operating in this repository. All rules herein must be strictly respected across all agent interactions.

---

## 1. Core Architectural Mandate

> **"Agents reason, algorithms decide, evidence proves."**

1. **Scoring Isolation**: The scoring formula lives **ONLY** in `packages/scoring/scorer.py`. No LLM calls are permitted in `packages/scoring/scorer.py` or inside any scoring path.
2. **Schema Enforcement**: All agent outputs MUST strictly validate against Pydantic models in `packages/schemas/*.py`. Any agent output failing validation must be rejected or retried.
3. **Evidence Grounding**: Every extracted skill, education item, and experience claim MUST carry an exact `evidence_span` (source text snippet) and `page_number`. Unbacked claims must be flagged or discarded.
4. **Recruiter Agent Constraint**: The Recruiter Agent must ONLY reference facts present in the structured match and evidence objects passed to it. It is strictly forbidden from halluncinating qualifications or browsing raw resume text dynamically during prose generation.
5. **Fairness & Sensitive Attribute Exclusion**: Sensitive demographic attributes (`name`, `gender`, `age`, `photo`, `religion`, `caste`, `marital_status`, `address`) MUST NEVER be passed into scoring functions in `packages/scoring/`. All candidate scoring operates strictly on anonymized feature vectors.

---

## 2. Directory Ownership Boundaries

To avoid conflicting changes between concurrent development tools:
- **OpenCode**: Primary owner of `packages/agents/`, `packages/scoring/`, `packages/knowledge/`. Focuses on fast edit-test loops for prompt engineering and scoring unit tests.
- **Antigravity**: Primary owner of `apps/api/`, `apps/web/`, `db/migrations/`, and overall monorepo structure & E2E browser verification.

---

## 3. Data Flow Pipeline

```
Resume PDF/DOCX  ──►  Resume Agent  ──►  ExtractedResume (with Evidence)
                                              │
Job Text          ──►  Job Agent     ──►  ExtractedJob
                                              │
                                              ▼
                                       Matching Agent  ──►  scorer.py (Deterministic)
                                              │
                                              ▼
                                       Skill Gap Agent ──►  Severity Breakdown
                                              │
                                              ▼
                                       Validation Layer ──► Evidence & PII Check
                                              │
                                              ▼
                                       Recruiter Agent ──►  Prose Summary
```

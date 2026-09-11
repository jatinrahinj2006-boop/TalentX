# Candidate Comparison Tab — Top-Tier Implementation Plan

## Background

The current [`compare/page.tsx`](file:///Users/jatin/Projects/TalentX/apps/web/src/app/jobs/%5BjobId%5D/compare/page.tsx) is a minimal skeleton (~175 lines): it fetches two `MatchResult` objects and renders a single flat table with 6 rows plus a one-line rationale banner. It has no visual depth, no evidence integration, no skill-by-skill diff, no decision tooling, and no export capability.

This plan turns it into a **fully-featured, evidence-grounded, decision-ready comparison view** that surfaces everything already in the `MatchResult` schema — properly differentiated, clearly winner-marked, and citation-backed — while staying within the architectural contracts in `AGENTS.md`.

---

## Proposed Changes

### Architectural Principles (Non-Negotiable per AGENTS.md)
- ✅ No LLM calls on the frontend — all comparison logic is **pure deterministic derivation** from the two `MatchResult` objects.
- ✅ Evidence spans come from `SkillMatch.evidence_span` already in the schema — no new backend work required.
- ✅ PII masking (`mask_pii` query param) is already threaded through `api.candidate()`; comparison page inherits it correctly.
- ✅ Scoring is read-only from `ScoreBreakdown` — no re-scoring, no mutation.

---

### Component Architecture

The page will be decomposed into focused sub-components, all in the same file unless complexity warrants extraction:

```
compare/page.tsx
├── <CompareHeader />        — breadcrumb, title, action buttons
├── <VerdictBanner />        — top winner callout with delta, tier badges, decision CTA
├── <ScoreRadarPanel />      — visual radar/spider chart of all 6 scoring dimensions
├── <ScoreBreakdownTable />  — the existing 6-row table, upgraded
├── <SkillDiffPanel />       — side-by-side skill match/gap diff (the core new section)
│   ├── SkillDiffRow × N    — one row per unique skill across both candidates
├── <ExperiencePanel />      — side-by-side experience timeline (total months, roles)
├── <EvidencePanel />        — cross-candidate citation viewer, filterable by skill
└── <CompareActions />       — export, outreach, schedule buttons
```

---

### Section 1 — `<VerdictBanner />` (New)

Replaces the current flat blue rationale box with a structured verdict card:

- **Winner chip** — large score display for the winning candidate, green highlighted column header
- **Delta indicator** — `+Δ pts` in a prominent badge, colour-coded by magnitude (`<5 pts` → amber "razor-thin margin", `5–15` → blue, `>15` → green decisive)
- **Decision tiers** — both candidates get their tier badge (Strong Match / Moderate / Weak) inline
- **Rationale sentence** — the current 1-line logic, but now built from a richer `buildRationale()` function that checks: required skill delta, experience months delta, critical gap count delta, domain similarity delta — picking the most informative differentiator

**Data sources:** `MatchResult.overall_score`, `score_breakdown`, `skill_gaps[].severity`

---

### Section 2 — `<ScoreRadarPanel />` (New — Pure CSS/SVG, no chart library)

A side-by-side **radar/spider chart** for the 6 scoring dimensions, drawn with inline SVG path calculations:

| Axis | Field | Weight label |
|---|---|---|
| Required Skills | `required_skill_score` | 40% |
| Experience | `experience_score` | 35% |
| Domain Fit | `role_domain_similarity` | 15% |
| Education | `education_score` | 10% |
| Preferred Skills | `preferred_skill_score` | — |
| Project Relevance | `project_relevance` | — |

- Two overlaid polygons, C1 in blue (`#0a66c2` at 30% opacity), C2 in teal (`#0d9488` at 30% opacity)
- Vertex labels with actual % values
- Hover tooltip on each vertex showing raw score
- No external library — pure SVG polygon computed from normalized values

**Implementation:** `buildRadarPoints(scores: number[], cx: number, cy: number, r: number): string` — standard polar-to-cartesian conversion.

---

### Section 3 — `<ScoreBreakdownTable />` (Upgrade of existing)

Keep the existing 6-row table but add:

- **Mini progress bars** under each cell value (using existing `.progress-bar` CSS class)
- **Delta column** in the centre — `+N%` or `−N%` with directional arrow icon
- **Gap Penalty row** — `gap_penalty` from `ScoreBreakdown` (currently not shown on compare page)
- **Certification / Project rows** — `certification_relevance` and `project_relevance` are in the schema but missing from the current table

Result: table grows from 6 to 9 rows, but all data already exists.

---

### Section 4 — `<SkillDiffPanel />` (New — Core Feature)

This is the most important addition. It surfaces the **per-skill comparison** using `skill_matches[]` from each `MatchResult`.

**Algorithm:**
1. Build a union set of all skill names across both candidates
2. For each skill, look up each candidate's `SkillMatch` entry (or synthesize a "missing" entry if absent)
3. Render a row for each skill, sorted by: required-first, then by winner-margin descending

**Row layout:**

```
[Skill Name + Required/Preferred chip]  |  [C1 status + match% + evidence badge]  |  [Δ diff]  |  [C2 status + match% + evidence badge]
```

- `status` icons: ✅ matched, ⚠️ partial, ❌ missing (using material-symbols `check_circle`, `help`, `cancel`)
- Match value rendered as `XX%` in the appropriate status colour
- `[cite]` amber badge if `evidence_span` exists — clicking expands an inline evidence panel below the row
- The winner column is bold / highlighted; the loser is greyed

**Skill Gap section** (below the matched skill list):

Group gaps by severity:
- 🔴 `HIGH` gaps — candidate has this gap, other doesn't — show as `Exclusive Gap` in red
- 🟡 `MEDIUM` gaps — both candidates have it — neutral row
- ✅ `RESOLVED` — one candidate fills a gap the other can't

---

### Section 5 — `<ExperiencePanel />` (New)

Side-by-side summary of **experience** derived from `MatchResult`:

- Total experience score `experience_score * 100` as a visual gauge
- `responsibility_similarity` score
- The `recruiter_summary` for each candidate (truncated to 2 lines, expandable) — shown as quote blocks

**Note:** Raw experience entries (company names, dates) are only included when `mask_pii=false`, consistent with PII policy.

---

### Section 6 — `<EvidencePanel />` (New)

A unified cross-candidate citation browser:

- Two columns, one per candidate
- Each column lists all `evidence_span` citations from `skill_matches[]` where evidence exists
- Filter by skill (dropdown or chip filter)
- Active citation state: clicking a citation highlights the corresponding skill row in `<SkillDiffPanel />`
- Each citation card: amber border, `CITATION #N`, page number, verbatim excerpt with amber underline

This is already built in the candidate detail page (`marginalia-card` pattern) — reuse the same CSS classes.

---

### Section 7 — `<CompareActions />` (New)

Action bar at the bottom of the page:

| Action | Description |
|---|---|
| **← Back** | Returns to ranked list |
| **Draft Outreach for Winner** | Calls `api.candidateOutreach(jobId, winnerCandidateId)` — opens `<OutreachModal />` (already built) |
| **View Winner Dossier** | Links to `/jobs/${jobId}/candidates/${winnerId}` |
| **Export Comparison PDF** | `window.print()` with a print-specific CSS stylesheet (`@media print`) — no server needed |

---

## Files Changed

### Core

#### [MODIFY] [`compare/page.tsx`](file:///Users/jatin/Projects/TalentX/apps/web/src/app/jobs/%5BjobId%5D/compare/page.tsx)

Full rewrite of the page. The file grows from 175 to ~600 lines, all self-contained sub-components in the same file (no new files needed to keep diff scope contained).

Key changes:
- Import `OutreachModal` from `@/components/OutreachModal`
- Add `outreachData`, `showOutreachModal`, `outreachLoading` state + handler
- Replace the flat table render with the 7-section layout described above
- Add `buildRationale()`, `buildRadarPoints()`, `buildSkillUnion()` pure utility functions at the top of the file
- Add proper TypeScript types for `MatchResult`, `ScoreBreakdown`, `SkillMatch`, `SkillGapItem` (inline — no schema package changes required since this is frontend-only)

---

### Supporting (No Backend Changes Required)

#### [NO CHANGE] [`api.ts`](file:///Users/jatin/Projects/TalentX/apps/web/src/lib/api.ts)
`api.candidate()` and `api.candidateOutreach()` already exist. No new endpoints needed.

#### [NO CHANGE] `packages/schemas/match.py`
`MatchResult` schema already contains all fields we need:
- `score_breakdown.project_relevance` ✅
- `score_breakdown.certification_relevance` ✅
- `score_breakdown.responsibility_similarity` ✅
- `skill_matches[].evidence_span` ✅
- `skill_matches[].page_number` ✅
- `recruiter_summary` ✅

#### [NO CHANGE] `OutreachModal.tsx`
Already built and works for a single candidate. Reused directly.

---

## Detailed Implementation: `buildSkillUnion()` Logic

```ts
type SkillMatch = {
  skill_name: string;
  importance: "must" | "preferred";
  status: "matched" | "partial" | "missing";
  match_value: number;
  evidence_span?: string;
  page_number?: number;
};

type SkillGapItem = {
  skill_name: string;
  importance: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  recommendation?: string;
};

function buildSkillUnion(c1Skills: SkillMatch[], c2Skills: SkillMatch[]) {
  const allNames = new Set([
    ...c1Skills.map(s => s.skill_name),
    ...c2Skills.map(s => s.skill_name),
  ]);

  const MISSING: Omit<SkillMatch, "skill_name"> = {
    importance: "preferred",
    status: "missing",
    match_value: 0,
  };

  return Array.from(allNames).map(name => ({
    name,
    c1: c1Skills.find(s => s.skill_name === name) ?? { ...MISSING, skill_name: name },
    c2: c2Skills.find(s => s.skill_name === name) ?? { ...MISSING, skill_name: name },
  })).sort((a, b) => {
    // required-first
    const aPriority = a.c1.importance === "must" || a.c2.importance === "must" ? 1 : 0;
    const bPriority = b.c1.importance === "must" || b.c2.importance === "must" ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    // then by max delta descending
    return Math.abs(b.c1.match_value - b.c2.match_value) - Math.abs(a.c1.match_value - a.c2.match_value);
  });
}
```

---

## Detailed Implementation: `buildRadarPoints()` Logic

```ts
function buildRadarPoints(
  values: number[],  // 0.0–1.0, length = N axes
  cx: number, cy: number, r: number
): string {
  const N = values.length;
  return values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const x = cx + r * v * Math.cos(angle);
    const y = cy + r * v * Math.sin(angle);
    return `${x},${y}`;
  }).join(" ");
}
```

SVG usage:
```tsx
<polygon
  points={buildRadarPoints([req, exp, domain, edu, preferred, proj], 120, 120, 100)}
  fill="rgba(10,102,194,0.2)"
  stroke="#0a66c2"
  strokeWidth={1.5}
/>
```

---

## Visual Design

Consistent with the rest of the app (Sidebar + TopHeader pattern, `.card`, `.badge-*`, `.font-mono`, material-symbols icons).

**New visual elements:**
- Winner column has a subtle `background: linear-gradient(180deg, #f0fdf4 0%, white 100%)` on the table header cell
- Delta badges: `background: #ecfdf5; color: #059669` for positive, `background: #fef2f2; color: #dc2626` for negative
- Radar chart polygon fill uses existing brand colours
- Evidence expansion uses a slide-down CSS transition (max-height trick, no JS animation library)

---

## Verification Plan

### Automated
- None required (no new API routes, no new Python code) — the page is purely a frontend composition of existing data.

### Manual
1. Navigate to `/jobs/:jobId` → select two candidates → click **Compare Selected**
2. Verify VerdictBanner shows correct winner, delta, and tier badges
3. Verify Radar chart renders with 6 axes, no layout overflow
4. Verify SkillDiffPanel shows union of all skills, correctly identifies winner per row
5. Click `[cite]` on a skill that has an `evidence_span` — confirm inline evidence expands
6. Toggle `mask_pii` in TopHeader — confirm page re-fetches and PII-sensitive text is masked
7. Click **Draft Outreach for Winner** — confirm `OutreachModal` opens pre-populated for the winning candidate
8. Click **Export Comparison PDF** — confirm `window.print()` triggers and page is print-formatted

---

## Open Questions

> [!IMPORTANT]
> **Multi-candidate comparison (3+):** The current URL scheme is `?c1=X&c2=Y`. This plan keeps 2-candidate comparison. If you want to extend to N candidates, the layout would need to shift to a vertical scrollable grid — that's a separate scope item. Confirm 2-candidate is the target.

> [!NOTE]
> **Radar chart axis count:** `ScoreBreakdown` has 8 fields total. The plan uses 6 (the 4 weighted + preferred + project). `certification_relevance` and `responsibility_similarity` are in the table but excluded from the radar to avoid clutter on a small polygon. Let me know if you want all 8.

> [!NOTE]
> **No new backend endpoint needed.** The plan deliberately uses only the existing `GET /jobs/{jobId}/candidates/{candidateId}` endpoint called twice. If you later want a dedicated `GET /jobs/{jobId}/compare?c1=X&c2=Y` endpoint that does server-side diff computation, that would be a backend addition — out of scope here.

// apps/web/src/components/CandidateComparisonView.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api, Job, CandidateMatch, SkillMatch, SkillGap } from "@/lib/api";
import OutreachModal from "@/components/OutreachModal";

interface CandidateComparisonViewProps {
  initialJobId?: string;
  initialC1Id?: string;
  initialC2Id?: string;
  initialMaskPii?: boolean;
}

// ── SVG Radar Chart Points Calculator ──────────────────────────────────────────
function buildRadarPoints(values: number[], cx: number, cy: number, r: number): string {
  const N = values.length;
  return values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
      const val = Math.max(0.05, Math.min(1.0, v));
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// ── Decision Tier Helper ───────────────────────────────────────────────────────
function getDecisionTier(score: number) {
  if (score >= 80) return { label: "Strong Match", badgeCls: "badge-green", color: "#059669", bg: "#ecfdf5" };
  if (score >= 60) return { label: "Moderate Match", badgeCls: "badge-amber", color: "#d97706", bg: "#fffbeb" };
  return { label: "Below Threshold", badgeCls: "badge-red", color: "#dc2626", bg: "#fef2f2" };
}

export default function CandidateComparisonView({
  initialJobId,
  initialC1Id,
  initialC2Id,
  initialMaskPii = false,
}: CandidateComparisonViewProps) {
  const router = useRouter();

  // Selection state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || "");
  const [candidateList, setCandidateList] = useState<CandidateMatch[]>([]);

  const [c1Id, setC1Id] = useState<string>(initialC1Id || "");
  const [c2Id, setC2Id] = useState<string>(initialC2Id || "");
  const [maskPii, setMaskPii] = useState<boolean>(initialMaskPii);

  // Loaded candidates data
  const [c1, setC1] = useState<CandidateMatch | null>(null);
  const [c2, setC2] = useState<CandidateMatch | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [skillFilter, setSkillFilter] = useState<"all" | "required" | "diffs" | "citations">("all");
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null);

  // Outreach Modal state
  const [showOutreachModal, setShowOutreachModal] = useState<boolean>(false);
  const [outreachData, setOutreachData] = useState<any>(null);
  const [outreachLoading, setOutreachLoading] = useState<boolean>(false);

  // 1. Fetch available jobs on mount
  useEffect(() => {
    api.jobs()
      .then((res) => {
        const jList = res.jobs || [];
        setJobs(jList);
        if (!selectedJobId && jList.length > 0) {
          setSelectedJobId(jList[0].job_id);
        }
      })
      .catch((err) => console.error("Failed to load jobs:", err));
  }, []);

  // 2. Fetch candidates whenever selectedJobId or maskPii changes
  useEffect(() => {
    if (!selectedJobId) return;

    api.candidates(selectedJobId, maskPii)
      .then((res) => {
        const cList = res.candidates || [];
        setCandidateList(cList);

        // Pre-select first 2 candidates if none chosen
        if (!c1Id && cList.length > 0) {
          setC1Id(cList[0].candidate_id);
        }
        if (!c2Id && cList.length > 1) {
          setC2Id(cList[1].candidate_id);
        } else if (!c2Id && cList.length === 1) {
          setC2Id(cList[0].candidate_id);
        }
      })
      .catch((err) => console.error("Failed to load candidates for job:", err));
  }, [selectedJobId, maskPii]);

  // 3. Fetch specific pair details when c1Id, c2Id, or selectedJobId changes
  useEffect(() => {
    if (!selectedJobId || !c1Id || !c2Id) return;

    if (c1Id === c2Id && candidateList.length > 1) {
      // Pick alternative if same candidate is chosen twice
      const alternative = candidateList.find((c) => c.candidate_id !== c1Id);
      if (alternative) {
        setC2Id(alternative.candidate_id);
        return;
      }
    }

    setLoading(true);
    setError(null);

    Promise.all([
      api.candidate(selectedJobId, c1Id, maskPii),
      api.candidate(selectedJobId, c2Id, maskPii),
    ])
      .then(([res1, res2]) => {
        setC1(res1);
        setC2(res2);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error("Failed to fetch candidate pair details:", err);
        setError(err.message || "Failed to load candidate comparison.");
        setLoading(false);
      });
  }, [selectedJobId, c1Id, c2Id, maskPii]);

  // Swap candidates
  const handleSwapCandidates = () => {
    const temp = c1Id;
    setC1Id(c2Id);
    setC2Id(temp);
  };

  // Toggle evidence expansion for a skill row
  const toggleEvidence = (skillKey: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [skillKey]: !prev[skillKey] }));
  };

  // Trigger outreach generation for the winner
  const handleOutreachForWinner = async () => {
    if (!c1 || !c2) return;
    const winner = c1.overall_score >= c2.overall_score ? c1 : c2;
    setOutreachLoading(true);
    try {
      const data = await api.candidateOutreach(selectedJobId, winner.candidate_id);
      setOutreachData(data);
      setShowOutreachModal(true);
    } catch (e: any) {
      alert("Failed to draft outreach: " + (e.message || "Unknown error"));
    } finally {
      setOutreachLoading(false);
    }
  };

  // ── Comparative Metrics & Rationale ──────────────────────────────────────────
  const comparisonData = useMemo(() => {
    if (!c1 || !c2) return null;

    const winner = c1.overall_score >= c2.overall_score ? c1 : c2;
    const runnerUp = c1.overall_score >= c2.overall_score ? c2 : c1;
    const isTie = c1.overall_score === c2.overall_score;
    const delta = Math.round(Math.abs(c1.overall_score - c2.overall_score) * 10) / 10;

    const wName = winner.candidate_name || winner.candidate_id;
    const rName = runnerUp.candidate_name || runnerUp.candidate_id;

    const wReq = Math.round((winner.score_breakdown?.required_skill_score || 0) * 100);
    const rReq = Math.round((runnerUp.score_breakdown?.required_skill_score || 0) * 100);

    const wExp = Math.round((winner.score_breakdown?.experience_score || 0) * 100);
    const rExp = Math.round((runnerUp.score_breakdown?.experience_score || 0) * 100);

    const wGaps = (winner.skill_gaps || []).filter((g) => g.severity === "HIGH").length;
    const rGaps = (runnerUp.skill_gaps || []).filter((g) => g.severity === "HIGH").length;

    const wDomain = Math.round((winner.score_breakdown?.role_domain_similarity || 0) * 100);
    const rDomain = Math.round((runnerUp.score_breakdown?.role_domain_similarity || 0) * 100);

    const differentiators: string[] = [];
    if (wReq > rReq) differentiators.push(`+${wReq - rReq}% higher required skill coverage`);
    if (rGaps > wGaps) differentiators.push(`${rGaps - wGaps} fewer critical competency gaps`);
    if (wExp > rExp) differentiators.push(`+${wExp - rExp}% stronger experience relevance`);
    if (wDomain > rDomain) differentiators.push(`+${wDomain - rDomain}% closer domain alignment`);

    let verdictHeadline = "";
    let deltaBadgeBg = "#eff6ff";
    let deltaBadgeColor = "#0a66c2";

    if (delta > 15) {
      verdictHeadline = `${wName} holds a decisive lead over ${rName}`;
      deltaBadgeBg = "#ecfdf5";
      deltaBadgeColor = "#059669";
    } else if (delta >= 5) {
      verdictHeadline = `${wName} holds a clear advantage over ${rName}`;
      deltaBadgeBg = "#eff6ff";
      deltaBadgeColor = "#0a66c2";
    } else {
      verdictHeadline = isTie
        ? `${wName} and ${rName} are tied on composite score`
        : `${wName} edges out ${rName} by a razor-thin margin`;
      deltaBadgeBg = "#fffbeb";
      deltaBadgeColor = "#d97706";
    }

    const narrative = isTie
      ? `Both candidates earned an identical overall score of ${winner.overall_score}%. Compare individual skill citations below to decide best interview fit.`
      : `${wName} scored ${winner.overall_score}% vs ${runnerUp.overall_score}% for ${rName}. The deterministic scoring formula awards ${wName} the higher rank primarily due to ${
          differentiators.length > 0 ? differentiators.join(", ") : "broader composite match indicators"
        }, backed by verbatim resume evidence citations.`;

    return {
      winner,
      runnerUp,
      isTie,
      delta,
      verdictHeadline,
      deltaBadgeBg,
      deltaBadgeColor,
      differentiators,
      narrative,
    };
  }, [c1, c2]);

  // ── Skill Union ──────────────────────────────────────────────────────────────
  const skillUnion = useMemo(() => {
    if (!c1 || !c2) return [];

    const getSkillName = (s: SkillMatch) => s.skill_name || s.skill || "";
    const map = new Map<
      string,
      {
        name: string;
        importance: "must" | "preferred" | string;
        c1: SkillMatch;
        c2: SkillMatch;
      }
    >();

    (c1.skill_matches || []).forEach((s) => {
      const name = getSkillName(s);
      if (!name) return;
      map.set(name.toLowerCase(), {
        name,
        importance: s.importance || "must",
        c1: s,
        c2: { skill_name: name, status: "missing", match_value: 0, importance: s.importance || "must" },
      });
    });

    (c2.skill_matches || []).forEach((s) => {
      const name = getSkillName(s);
      if (!name) return;
      const existing = map.get(name.toLowerCase());
      if (existing) {
        existing.c2 = s;
        if (s.importance === "must") existing.importance = "must";
      } else {
        map.set(name.toLowerCase(), {
          name,
          importance: s.importance || "preferred",
          c1: { skill_name: name, status: "missing", match_value: 0, importance: s.importance || "preferred" },
          c2: s,
        });
      }
    });

    const list = Array.from(map.values()).sort((a, b) => {
      // Must-have first
      const aReq = a.importance === "must" ? 1 : 0;
      const bReq = b.importance === "must" ? 1 : 0;
      if (aReq !== bReq) return bReq - aReq;

      // Then max delta descending
      const aDelta = Math.abs((a.c1.match_value || 0) - (a.c2.match_value || 0));
      const bDelta = Math.abs((b.c1.match_value || 0) - (b.c2.match_value || 0));
      return bDelta - aDelta;
    });

    // Apply filter
    return list.filter((item) => {
      if (skillFilter === "required") return item.importance === "must";
      if (skillFilter === "diffs") return Math.abs((item.c1.match_value || 0) - (item.c2.match_value || 0)) > 0.05;
      if (skillFilter === "citations") return Boolean(item.c1.evidence_span || item.c2.evidence_span);
      return true;
    });
  }, [c1, c2, skillFilter]);

  // ── Radar Chart Dimensions (6 key axes) ───────────────────────────────────────
  const radarAxes = [
    { label: "Required Skills", weight: "40%", key: "required_skill_score" },
    { label: "Experience Relevance", weight: "35%", key: "experience_score" },
    { label: "Domain Alignment", weight: "15%", key: "role_domain_similarity" },
    { label: "Education Match", weight: "10%", key: "education_score" },
    { label: "Preferred Skills", weight: "Bonus", key: "preferred_skill_score" },
    { label: "Project Relevance", weight: "5%", key: "project_relevance" },
  ];

  const c1RadarValues = useMemo(() => {
    if (!c1?.score_breakdown) return [0, 0, 0, 0, 0, 0];
    const b = c1.score_breakdown;
    return [
      b.required_skill_score || 0,
      b.experience_score || 0,
      b.role_domain_similarity || 0,
      b.education_score || 0,
      b.preferred_skill_score || 0,
      b.project_relevance || 0,
    ];
  }, [c1]);

  const c2RadarValues = useMemo(() => {
    if (!c2?.score_breakdown) return [0, 0, 0, 0, 0, 0];
    const b = c2.score_breakdown;
    return [
      b.required_skill_score || 0,
      b.experience_score || 0,
      b.role_domain_similarity || 0,
      b.education_score || 0,
      b.preferred_skill_score || 0,
      b.project_relevance || 0,
    ];
  }, [c2]);

  // ── Score Breakdown Table Rows (9 dimensions) ────────────────────────────────
  const breakdownRows = useMemo(() => {
    if (!c1 || !c2) return [];
    const b1 = c1.score_breakdown || {};
    const b2 = c2.score_breakdown || {};

    const rows = [
      {
        label: "Overall Composite Match",
        weight: "100%",
        v1: c1.overall_score / 100,
        v2: c2.overall_score / 100,
        isPercentage: true,
      },
      {
        label: "Required Skill Coverage",
        weight: "40%",
        v1: b1.required_skill_score ?? 0,
        v2: b2.required_skill_score ?? 0,
        isPercentage: true,
      },
      {
        label: "Experience Relevance",
        weight: "35%",
        v1: b1.experience_score ?? 0,
        v2: b2.experience_score ?? 0,
        isPercentage: true,
      },
      {
        label: "Role & Domain Similarity",
        weight: "15%",
        v1: b1.role_domain_similarity ?? 0,
        v2: b2.role_domain_similarity ?? 0,
        isPercentage: true,
      },
      {
        label: "Responsibilities Alignment",
        weight: "10%",
        v1: b1.responsibility_similarity ?? 0,
        v2: b2.responsibility_similarity ?? 0,
        isPercentage: true,
      },
      {
        label: "Education Qualification",
        weight: "10%",
        v1: b1.education_score ?? 0,
        v2: b2.education_score ?? 0,
        isPercentage: true,
      },
      {
        label: "Preferred Skills",
        weight: "Bonus",
        v1: b1.preferred_skill_score ?? 0,
        v2: b2.preferred_skill_score ?? 0,
        isPercentage: true,
      },
      {
        label: "Project Relevance",
        weight: "5%",
        v1: b1.project_relevance ?? 0,
        v2: b2.project_relevance ?? 0,
        isPercentage: true,
      },
      {
        label: "Critical Gap Penalty",
        weight: "Deduction",
        v1: (b1.gap_penalty ?? 0) * -1,
        v2: (b2.gap_penalty ?? 0) * -1,
        isPenalty: true,
      },
    ];

    return rows;
  }, [c1, c2]);

  const selectedJob = jobs.find((j) => j.job_id === selectedJobId);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-offset" style={{ flex: 1, minHeight: "100vh" }}>
        <TopHeader maskPii={maskPii} onToggleMaskPii={() => setMaskPii((m) => !m)} />
        <main className="page-content" style={{ paddingBottom: 64 }}>
          {/* Header & Requisition Bar */}
          <section
            style={{
              padding: "20px 32px",
              background: "white",
              borderBottom: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
              {/* Breadcrumbs & Controls */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
                  <Link href="/jobs" style={{ color: "#0a66c2", fontWeight: 600, textDecoration: "none" }}>
                    Multi-Role Matcher
                  </Link>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    chevron_right
                  </span>
                  {selectedJobId && (
                    <Link
                      href={`/jobs/${selectedJobId}`}
                      style={{ color: "#0a66c2", fontWeight: 600, textDecoration: "none" }}
                    >
                      {selectedJob?.title || selectedJobId}
                    </Link>
                  )}
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    chevron_right
                  </span>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>Side-by-Side Candidate Comparison</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setMaskPii((m) => !m)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: maskPii ? "#eff6ff" : "white",
                      color: maskPii ? "#0a66c2" : "#475569",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {maskPii ? "visibility_off" : "visibility"}
                    </span>
                    {maskPii ? "PII Masked" : "Mask PII"}
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "white",
                      color: "#475569",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      print
                    </span>
                    Export PDF
                  </button>
                </div>
              </div>

              {/* Title & Interactive Candidate Switcher Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 16,
                  paddingTop: 4,
                }}
              >
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                    Candidate Comparison Matrix
                  </h1>
                  <p style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                    Evidence-grounded deterministic scoring & skill-by-skill delta analysis.
                  </p>
                </div>

                {/* Candidate Pair Selectors */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#f8fafc",
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {/* Job Requisition Picker */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Requisition
                    </span>
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#0f172a",
                        background: "white",
                        cursor: "pointer",
                        maxWidth: 200,
                      }}
                    >
                      {jobs.map((j) => (
                        <option key={j.job_id} value={j.job_id}>
                          {j.job_id}: {j.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ width: 1, height: 28, background: "#cbd5e1", margin: "0 4px" }} />

                  {/* Candidate 1 Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#0a66c2", textTransform: "uppercase" }}>
                      Candidate A
                    </span>
                    <select
                      value={c1Id}
                      onChange={(e) => setC1Id(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1.5px solid #0a66c2",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0a66c2",
                        background: "#eff6ff",
                        cursor: "pointer",
                        maxWidth: 200,
                      }}
                    >
                      {candidateList.map((c) => (
                        <option key={c.candidate_id} value={c.candidate_id}>
                          {c.candidate_name || c.candidate_id} ({c.overall_score}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Swap Button */}
                  <button
                    type="button"
                    title="Swap Candidates"
                    onClick={handleSwapCandidates}
                    style={{
                      background: "white",
                      border: "1px solid #cbd5e1",
                      borderRadius: "50%",
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      marginTop: 14,
                      color: "#475569",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      swap_horiz
                    </span>
                  </button>

                  {/* Candidate 2 Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#0d9488", textTransform: "uppercase" }}>
                      Candidate B
                    </span>
                    <select
                      value={c2Id}
                      onChange={(e) => setC2Id(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1.5px solid #0d9488",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0d9488",
                        background: "#f0fdfa",
                        cursor: "pointer",
                        maxWidth: 200,
                      }}
                    >
                      {candidateList.map((c) => (
                        <option key={c.candidate_id} value={c.candidate_id}>
                          {c.candidate_name || c.candidate_id} ({c.overall_score}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Main Content Area */}
          <section style={{ padding: "28px 32px" }}>
            <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Loading State */}
              {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div className="skeleton" style={{ height: 360, borderRadius: 12 }} />
                    <div className="skeleton" style={{ height: 360, borderRadius: 12 }} />
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div
                  style={{
                    padding: "16px 20px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 10,
                    color: "#dc2626",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong>Comparison Error:</strong> {error}
                  </div>
                  <Link
                    href={`/jobs/${selectedJobId}`}
                    style={{ color: "#0a66c2", fontWeight: 700, textDecoration: "none" }}
                  >
                    ← Back to Job Bench
                  </Link>
                </div>
              )}

              {/* No candidates selected notice */}
              {!loading && !error && (!c1 || !c2) && (
                <div
                  style={{
                    padding: 48,
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    textAlign: "center",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#94a3b8", marginBottom: 12 }}>
                    compare_arrows
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                    Select Two Candidates to Compare
                  </h3>
                  <p style={{ fontSize: 13, color: "#64748b", maxWidth: 440, margin: "0 auto 16px" }}>
                    Choose a Job Requisition and two candidates from the selector at the top to compute full side-by-side
                    evidence diffs and dimensional scoring radars.
                  </p>
                  <Link href={`/jobs/${selectedJobId}`} className="btn btn-primary">
                    View Candidate Bench
                  </Link>
                </div>
              )}

              {/* Loaded Comparison View */}
              {!loading && !error && c1 && c2 && comparisonData && (
                <>
                  {/* ──────────────── 1. VERDICT BANNER ──────────────── */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      padding: 24,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Top Accent Strip */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background:
                          comparisonData.delta > 15
                            ? "linear-gradient(90deg, #059669, #10b981)"
                            : "linear-gradient(90deg, #0a66c2, #0d9488)",
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 16,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: comparisonData.deltaBadgeColor,
                              background: comparisonData.deltaBadgeBg,
                              padding: "3px 8px",
                              borderRadius: 4,
                              border: `1px solid ${comparisonData.deltaBadgeColor}40`,
                            }}
                          >
                            COMPARATIVE AUDIT VERDICT
                          </span>
                          {!comparisonData.isTie && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: "#059669",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                emoji_events
                              </span>
                              Rank #{comparisonData.winner.rank || 1} Recommended
                            </span>
                          )}
                        </div>

                        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                          {comparisonData.verdictHeadline}
                        </h2>
                        <p
                          style={{
                            fontSize: 13,
                            color: "#475569",
                            marginTop: 6,
                            lineHeight: 1.6,
                            maxWidth: 860,
                          }}
                        >
                          {comparisonData.narrative}
                        </p>
                      </div>

                      {/* Right Action CTA */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={handleOutreachForWinner}
                          disabled={outreachLoading}
                          className="btn btn-primary"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "10px 16px",
                            fontWeight: 700,
                            borderRadius: 8,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            outgoing_mail
                          </span>
                          {outreachLoading
                            ? "Drafting..."
                            : `Draft Outreach to ${comparisonData.winner.candidate_name || comparisonData.winner.candidate_id}`}
                        </button>
                      </div>
                    </div>

                    {/* Differentiator Pills */}
                    {comparisonData.differentiators.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          paddingTop: 12,
                          borderTop: "1px solid #f1f5f9",
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", alignSelf: "center" }}>
                          Key Differentiators:
                        </span>
                        {comparisonData.differentiators.map((diff, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#0f172a",
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                              padding: "4px 10px",
                              borderRadius: 6,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#059669" }}>
                              check
                            </span>
                            {diff}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ──────────────── 2. SCORE RADAR & SUMMARY CARDS ──────────────── */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24 }}>
                    {/* Left: SVG Radar Chart */}
                    <div
                      style={{
                        background: "white",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        padding: 24,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 16,
                        }}
                      >
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                            Dimensional Scoring Radar
                          </h3>
                          <p style={{ fontSize: 11, color: "#64748b" }}>
                            Normalized vector comparison across 6 core evaluation dimensions.
                          </p>
                        </div>

                        {/* Legend */}
                        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, fontWeight: 700 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 12, height: 12, background: "#0a66c2", borderRadius: 2 }} />
                            <span style={{ color: "#0a66c2" }}>{c1.candidate_name || c1.candidate_id}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 12, height: 12, background: "#0d9488", borderRadius: 2 }} />
                            <span style={{ color: "#0d9488" }}>{c2.candidate_name || c2.candidate_id}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pure SVG Spider Chart */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 320,
                          padding: 10,
                        }}
                      >
                        <svg
                          viewBox="0 0 400 360"
                          style={{ width: "100%", maxWidth: 440, height: "auto", overflow: "visible" }}
                        >
                          {/* Concentric Grid Webs (20%, 40%, 60%, 80%, 100%) */}
                          {[0.2, 0.4, 0.6, 0.8, 1.0].map((level) => (
                            <polygon
                              key={level}
                              points={buildRadarPoints([level, level, level, level, level, level], 200, 180, 120)}
                              fill={level === 1.0 ? "#f8fafc" : "none"}
                              stroke="#e2e8f0"
                              strokeWidth={level === 1.0 ? "1.5" : "1"}
                              strokeDasharray={level < 1.0 ? "2 2" : "none"}
                            />
                          ))}

                          {/* Axis Lines and Labels */}
                          {radarAxes.map((axis, i) => {
                            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                            const x2 = 200 + 120 * Math.cos(angle);
                            const y2 = 180 + 120 * Math.sin(angle);
                            const labelX = 200 + 148 * Math.cos(angle);
                            const labelY = 180 + 142 * Math.sin(angle);

                            const c1Val = Math.round(c1RadarValues[i] * 100);
                            const c2Val = Math.round(c2RadarValues[i] * 100);

                            return (
                              <g key={i}>
                                <line x1="200" y1="180" x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1" />
                                <text
                                  x={labelX}
                                  y={labelY}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fontSize="10"
                                  fontWeight="700"
                                  fill="#475569"
                                  fontFamily="sans-serif"
                                >
                                  {axis.label}
                                </text>
                                <text
                                  x={labelX}
                                  y={labelY + 12}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fontSize="9"
                                  fill="#94a3b8"
                                  fontFamily="monospace"
                                >
                                  {c1Val}% vs {c2Val}%
                                </text>
                              </g>
                            );
                          })}

                          {/* Candidate 1 Polygon (Blue) */}
                          <polygon
                            points={buildRadarPoints(c1RadarValues, 200, 180, 120)}
                            fill="rgba(10, 102, 194, 0.25)"
                            stroke="#0a66c2"
                            strokeWidth="2.5"
                          />

                          {/* Candidate 2 Polygon (Teal) */}
                          <polygon
                            points={buildRadarPoints(c2RadarValues, 200, 180, 120)}
                            fill="rgba(13, 148, 136, 0.25)"
                            stroke="#0d9488"
                            strokeWidth="2.5"
                          />

                          {/* Vertex Dots */}
                          {c1RadarValues.map((v, i) => {
                            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                            const x1 = 200 + 120 * v * Math.cos(angle);
                            const y1 = 180 + 120 * v * Math.sin(angle);
                            return <circle key={`c1-${i}`} cx={x1} cy={y1} r="4" fill="#0a66c2" />;
                          })}

                          {c2RadarValues.map((v, i) => {
                            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                            const x2 = 200 + 120 * v * Math.cos(angle);
                            const y2 = 180 + 120 * v * Math.sin(angle);
                            return <circle key={`c2-${i}`} cx={x2} cy={y2} r="4" fill="#0d9488" />;
                          })}
                        </svg>
                      </div>
                    </div>

                    {/* Right: Candidate Profile & Dimensional Score Cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Candidate 1 Card */}
                      <div
                        style={{
                          background: "white",
                          borderRadius: 12,
                          border: c1.overall_score >= c2.overall_score ? "2px solid #0a66c2" : "1px solid #e2e8f0",
                          padding: 20,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 16, fontWeight: 800, color: "#0a66c2" }}>
                                {c1.candidate_name || c1.candidate_id}
                              </span>
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
                                {c1.candidate_id}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: "#64748b" }}>Rank #{c1.rank || 1} on Requisition</span>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 24, fontWeight: 900, color: "#0a66c2" }}>
                              {c1.overall_score}%
                            </div>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                                ...getDecisionTier(c1.overall_score),
                              }}
                            >
                              {getDecisionTier(c1.overall_score).label}
                            </span>
                          </div>
                        </div>

                        {/* Mini Dimension Bars for C1 */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                            <span>Core Skills Coverage</span>
                            <strong style={{ color: "#0f172a" }}>
                              {Math.round((c1.score_breakdown?.required_skill_score || 0) * 100)}%
                            </strong>
                          </div>
                          <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${(c1.score_breakdown?.required_skill_score || 0) * 100}%`,
                                background: "#0a66c2",
                              }}
                            />
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", marginTop: 4 }}>
                            <span>Critical Gaps</span>
                            <strong style={{ color: "#dc2626" }}>
                              {(c1.skill_gaps || []).filter((g) => g.severity === "HIGH").length} high severity
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Candidate 2 Card */}
                      <div
                        style={{
                          background: "white",
                          borderRadius: 12,
                          border: c2.overall_score > c1.overall_score ? "2px solid #0d9488" : "1px solid #e2e8f0",
                          padding: 20,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 16, fontWeight: 800, color: "#0d9488" }}>
                                {c2.candidate_name || c2.candidate_id}
                              </span>
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
                                {c2.candidate_id}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: "#64748b" }}>Rank #{c2.rank || 2} on Requisition</span>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 24, fontWeight: 900, color: "#0d9488" }}>
                              {c2.overall_score}%
                            </div>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                                ...getDecisionTier(c2.overall_score),
                              }}
                            >
                              {getDecisionTier(c2.overall_score).label}
                            </span>
                          </div>
                        </div>

                        {/* Mini Dimension Bars for C2 */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                            <span>Core Skills Coverage</span>
                            <strong style={{ color: "#0f172a" }}>
                              {Math.round((c2.score_breakdown?.required_skill_score || 0) * 100)}%
                            </strong>
                          </div>
                          <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${(c2.score_breakdown?.required_skill_score || 0) * 100}%`,
                                background: "#0d9488",
                              }}
                            />
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", marginTop: 4 }}>
                            <span>Critical Gaps</span>
                            <strong style={{ color: "#dc2626" }}>
                              {(c2.skill_gaps || []).filter((g) => g.severity === "HIGH").length} high severity
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Quick Winner Dossier Action */}
                      <div
                        style={{
                          background: "#f8fafc",
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          padding: "14px 18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                            Inspect Winner Full Evidence File
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            Jump directly into candidate dossier citations
                          </div>
                        </div>
                        <Link
                          href={`/jobs/${selectedJobId}/candidates/${comparisonData.winner.candidate_id}`}
                          className="btn btn-sm"
                          style={{ textDecoration: "none", fontWeight: 700 }}
                        >
                          View Dossier →
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* ──────────────── 3. SCORE BREAKDOWN TABLE ──────────────── */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0" }}>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                        Scoring Dimension Breakdown (Deterministic)
                      </h3>
                      <p style={{ fontSize: 12, color: "#64748b" }}>
                        Evaluated with formula: 35% Core Skills + 20% Experience + 15% Domain + 10% Responsibilities +
                        10% Education + 10% Preferred + 5% Project + 5% Certifications − Gap Penalties.
                      </p>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                          <th style={{ padding: "12px 20px", color: "#475569", fontWeight: 700, width: "32%" }}>
                            Evaluation Dimension
                          </th>
                          <th style={{ padding: "12px 20px", color: "#0a66c2", fontWeight: 700, width: "30%" }}>
                            {c1.candidate_name || c1.candidate_id} (Rank #{c1.rank || 1})
                          </th>
                          <th
                            style={{
                              padding: "12px 14px",
                              color: "#64748b",
                              fontWeight: 700,
                              textAlign: "center",
                              width: "8%",
                            }}
                          >
                            Delta
                          </th>
                          <th style={{ padding: "12px 20px", color: "#0d9488", fontWeight: 700, width: "30%" }}>
                            {c2.candidate_name || c2.candidate_id} (Rank #{c2.rank || 2})
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdownRows.map((row, idx) => {
                          const val1Num = Math.round(row.v1 * 100);
                          const val2Num = Math.round(row.v2 * 100);
                          const diff = val1Num - val2Num;
                          const c1Leads = diff > 0;
                          const c2Leads = diff < 0;

                          return (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              {/* Dimension Label */}
                              <td style={{ padding: "12px 20px" }}>
                                <div style={{ fontWeight: 700, color: "#0f172a" }}>{row.label}</div>
                                <span style={{ fontSize: 10, color: "#94a3b8" }}>Formula Weight: {row.weight}</span>
                              </td>

                              {/* Candidate 1 Value */}
                              <td style={{ padding: "12px 20px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                                  <span
                                    style={{
                                      fontFamily: "monospace",
                                      fontWeight: c1Leads ? 800 : 500,
                                      fontSize: c1Leads ? 14 : 12,
                                      color: c1Leads ? "#0a66c2" : "#475569",
                                    }}
                                  >
                                    {row.isPenalty ? `${row.v1.toFixed(1)} pts` : `${val1Num}%`}
                                  </span>
                                  {c1Leads && !row.isPenalty && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 800,
                                        color: "#059669",
                                        background: "#ecfdf5",
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        border: "1px solid #a7f3d0",
                                      }}
                                    >
                                      Superior
                                    </span>
                                  )}
                                </div>
                                {!row.isPenalty && (
                                  <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                                    <div
                                      style={{
                                        height: "100%",
                                        width: `${Math.max(0, Math.min(100, val1Num))}%`,
                                        background: "#0a66c2",
                                      }}
                                    />
                                  </div>
                                )}
                              </td>

                              {/* Delta Column */}
                              <td style={{ padding: "12px 14px", textAlign: "center" }}>
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background:
                                      diff === 0 ? "#f1f5f9" : diff > 0 ? "#eff6ff" : "#f0fdfa",
                                    color: diff === 0 ? "#94a3b8" : diff > 0 ? "#0a66c2" : "#0d9488",
                                  }}
                                >
                                  {diff === 0 ? "—" : diff > 0 ? `+${diff}%` : `${diff}%`}
                                </span>
                              </td>

                              {/* Candidate 2 Value */}
                              <td style={{ padding: "12px 20px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                                  <span
                                    style={{
                                      fontFamily: "monospace",
                                      fontWeight: c2Leads ? 800 : 500,
                                      fontSize: c2Leads ? 14 : 12,
                                      color: c2Leads ? "#0d9488" : "#475569",
                                    }}
                                  >
                                    {row.isPenalty ? `${row.v2.toFixed(1)} pts` : `${val2Num}%`}
                                  </span>
                                  {c2Leads && !row.isPenalty && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 800,
                                        color: "#059669",
                                        background: "#ecfdf5",
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        border: "1px solid #a7f3d0",
                                      }}
                                    >
                                      Superior
                                    </span>
                                  )}
                                </div>
                                {!row.isPenalty && (
                                  <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                                    <div
                                      style={{
                                        height: "100%",
                                        width: `${Math.max(0, Math.min(100, val2Num))}%`,
                                        background: "#0d9488",
                                      }}
                                    />
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ──────────────── 4. SKILL DIFF PANEL (CORE FEATURE) ──────────────── */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* Header & Filter Controls */}
                    <div
                      style={{
                        padding: "18px 24px",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                          Skill-by-Skill Differential Matrix
                        </h3>
                        <p style={{ fontSize: 12, color: "#64748b" }}>
                          Union of all job-required and candidate skills with verbatim evidence citations.
                        </p>
                      </div>

                      {/* Filter Chips */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {(
                          [
                            { id: "all", label: `All Skills (${skillUnion.length})` },
                            { id: "required", label: "Required Only" },
                            { id: "diffs", label: "Significant Diffs" },
                            { id: "citations", label: "With Citations" },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSkillFilter(tab.id)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              border: skillFilter === tab.id ? "1px solid #0a66c2" : "1px solid #cbd5e1",
                              background: skillFilter === tab.id ? "#eff6ff" : "white",
                              color: skillFilter === tab.id ? "#0a66c2" : "#64748b",
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                            <th style={{ padding: "10px 20px", color: "#475569", fontWeight: 700, width: "34%" }}>
                              Skill / Competency
                            </th>
                            <th style={{ padding: "10px 20px", color: "#0a66c2", fontWeight: 700, width: "28%" }}>
                              {c1.candidate_name || c1.candidate_id}
                            </th>
                            <th
                              style={{
                                padding: "10px 14px",
                                color: "#64748b",
                                fontWeight: 700,
                                textAlign: "center",
                                width: "10%",
                              }}
                            >
                              Differential
                            </th>
                            <th style={{ padding: "10px 20px", color: "#0d9488", fontWeight: 700, width: "28%" }}>
                              {c2.candidate_name || c2.candidate_id}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {skillUnion.length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                                No skills match the selected filter.
                              </td>
                            </tr>
                          ) : (
                            skillUnion.map((item, idx) => {
                              const v1 = Math.round((item.c1.match_value || 0) * 100);
                              const v2 = Math.round((item.c2.match_value || 0) * 100);
                              const delta = v1 - v2;
                              const isMust = item.importance === "must";
                              const skillKey = `skill-${idx}-${item.name}`;
                              const isExpanded = Boolean(expandedEvidence[skillKey]);

                              const hasEvidence = Boolean(item.c1.evidence_span || item.c2.evidence_span);

                              return (
                                <tr
                                  key={idx}
                                  style={{
                                    borderBottom: "1px solid #f1f5f9",
                                    background: isExpanded ? "#f8fafc" : "white",
                                  }}
                                >
                                  {/* Skill Name Column */}
                                  <td style={{ padding: "12px 20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.name}</span>
                                      <span
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 800,
                                          textTransform: "uppercase",
                                          padding: "1px 6px",
                                          borderRadius: 4,
                                          background: isMust ? "#fef2f2" : "#f1f5f9",
                                          color: isMust ? "#dc2626" : "#475569",
                                          border: isMust ? "1px solid #fecaca" : "1px solid #e2e8f0",
                                        }}
                                      >
                                        {isMust ? "Must Have" : "Preferred"}
                                      </span>

                                      {hasEvidence && (
                                        <button
                                          type="button"
                                          onClick={() => toggleEvidence(skillKey)}
                                          title="View verbatim evidence citation"
                                          style={{
                                            background: "none",
                                            border: "none",
                                            color: "#d97706",
                                            fontSize: 10,
                                            fontWeight: 800,
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 2,
                                            padding: "2px 4px",
                                            borderRadius: 4,
                                          }}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                                            format_quote
                                          </span>
                                          {isExpanded ? "Hide Cite" : "Cite"}
                                        </button>
                                      )}
                                    </div>

                                    {/* Inline Verbatim Evidence Drawer */}
                                    {isExpanded && (
                                      <div
                                        style={{
                                          marginTop: 10,
                                          padding: 12,
                                          background: "#fffbeb",
                                          border: "1px solid #fde68a",
                                          borderRadius: 6,
                                          fontSize: 11,
                                          color: "#78350f",
                                        }}
                                      >
                                        <div style={{ fontWeight: 700, marginBottom: 4, color: "#92400e" }}>
                                          VERIFIED EVIDENCE SPANS:
                                        </div>
                                        {item.c1.evidence_span && (
                                          <div style={{ marginBottom: 6 }}>
                                            <strong>{c1.candidate_name || c1.candidate_id} (Page {item.c1.page_number || 1}):</strong>{" "}
                                            &ldquo;{item.c1.evidence_span}&rdquo;
                                          </div>
                                        )}
                                        {item.c2.evidence_span && (
                                          <div>
                                            <strong>{c2.candidate_name || c2.candidate_id} (Page {item.c2.page_number || 1}):</strong>{" "}
                                            &ldquo;{item.c2.evidence_span}&rdquo;
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>

                                  {/* Candidate 1 Match */}
                                  <td style={{ padding: "12px 20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span
                                        className="material-symbols-outlined"
                                        style={{
                                          fontSize: 16,
                                          color: v1 >= 80 ? "#059669" : v1 >= 35 ? "#d97706" : "#dc2626",
                                        }}
                                      >
                                        {v1 >= 80 ? "check_circle" : v1 >= 35 ? "help" : "cancel"}
                                      </span>
                                      <span
                                        style={{
                                          fontFamily: "monospace",
                                          fontWeight: 700,
                                          fontSize: 12,
                                          color: v1 >= 80 ? "#059669" : v1 >= 35 ? "#d97706" : "#94a3b8",
                                        }}
                                      >
                                        {v1 > 0 ? `${v1}%` : "Missing"}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Differential Indicator */}
                                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontFamily: "monospace",
                                        fontWeight: 700,
                                        color: delta === 0 ? "#94a3b8" : delta > 0 ? "#0a66c2" : "#0d9488",
                                      }}
                                    >
                                      {delta === 0 ? "Tie" : delta > 0 ? `C1 +${delta}%` : `C2 +${Math.abs(delta)}%`}
                                    </span>
                                  </td>

                                  {/* Candidate 2 Match */}
                                  <td style={{ padding: "12px 20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span
                                        className="material-symbols-outlined"
                                        style={{
                                          fontSize: 16,
                                          color: v2 >= 80 ? "#059669" : v2 >= 35 ? "#d97706" : "#dc2626",
                                        }}
                                      >
                                        {v2 >= 80 ? "check_circle" : v2 >= 35 ? "help" : "cancel"}
                                      </span>
                                      <span
                                        style={{
                                          fontFamily: "monospace",
                                          fontWeight: 700,
                                          fontSize: 12,
                                          color: v2 >= 80 ? "#059669" : v2 >= 35 ? "#d97706" : "#94a3b8",
                                        }}
                                      >
                                        {v2 > 0 ? `${v2}%` : "Missing"}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ──────────────── 5. SKILL GAP SEVERITY COMPARISON ──────────────── */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    {/* C1 Gaps Card */}
                    <div
                      style={{
                        background: "white",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        padding: 20,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 800, color: "#0a66c2" }}>
                          {c1.candidate_name || c1.candidate_id} — Gaps Analysis
                        </h4>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          Total: {(c1.skill_gaps || []).length} gaps
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(c1.skill_gaps || []).length === 0 ? (
                          <div style={{ color: "#059669", fontSize: 12, fontWeight: 600 }}>
                            ✓ No critical gaps identified against this requisition!
                          </div>
                        ) : (
                          (c1.skill_gaps || []).map((gap, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                borderRadius: 6,
                                background: gap.severity === "HIGH" ? "#fef2f2" : "#fffbeb",
                                border: gap.severity === "HIGH" ? "1px solid #fecaca" : "1px solid #fde68a",
                                fontSize: 12,
                              }}
                            >
                              <span style={{ fontWeight: 700, color: "#0f172a" }}>{gap.skill_name || gap.skill}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: gap.severity === "HIGH" ? "#dc2626" : "#d97706",
                                }}
                              >
                                {gap.severity} SEVERITY
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* C2 Gaps Card */}
                    <div
                      style={{
                        background: "white",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        padding: 20,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 800, color: "#0d9488" }}>
                          {c2.candidate_name || c2.candidate_id} — Gaps Analysis
                        </h4>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          Total: {(c2.skill_gaps || []).length} gaps
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(c2.skill_gaps || []).length === 0 ? (
                          <div style={{ color: "#059669", fontSize: 12, fontWeight: 600 }}>
                            ✓ No critical gaps identified against this requisition!
                          </div>
                        ) : (
                          (c2.skill_gaps || []).map((gap, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                borderRadius: 6,
                                background: gap.severity === "HIGH" ? "#fef2f2" : "#fffbeb",
                                border: gap.severity === "HIGH" ? "1px solid #fecaca" : "1px solid #fde68a",
                                fontSize: 12,
                              }}
                            >
                              <span style={{ fontWeight: 700, color: "#0f172a" }}>{gap.skill_name || gap.skill}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: gap.severity === "HIGH" ? "#dc2626" : "#d97706",
                                }}
                              >
                                {gap.severity} SEVERITY
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ──────────────── 6. RECRUITER AGENT SYNTHESIS DOSSIER ──────────────── */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      padding: 24,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#0a66c2" }}>
                        neurology
                      </span>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                        Recruiter Agent Executive Syntheses
                      </h3>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                      <div
                        style={{
                          padding: 16,
                          borderRadius: 8,
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          fontSize: 12,
                          lineHeight: 1.6,
                          color: "#1e3a8a",
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: 6, color: "#1e40af" }}>
                          {c1.candidate_name || c1.candidate_id} Summary:
                        </div>
                        {c1.recruiter_summary || "No executive summary compiled."}
                      </div>

                      <div
                        style={{
                          padding: 16,
                          borderRadius: 8,
                          background: "#f0fdfa",
                          border: "1px solid #99f6e4",
                          fontSize: 12,
                          lineHeight: 1.6,
                          color: "#134e4a",
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: 6, color: "#115e59" }}>
                          {c2.candidate_name || c2.candidate_id} Summary:
                        </div>
                        {c2.recruiter_summary || "No executive summary compiled."}
                      </div>
                    </div>
                  </div>

                  {/* ──────────────── 7. BOTTOM ACTION TOOLBAR ──────────────── */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 12,
                    }}
                  >
                    <Link
                      href={`/jobs/${selectedJobId}`}
                      className="btn btn-sm"
                      style={{ textDecoration: "none", fontWeight: 700 }}
                    >
                      ← Back to Candidate Bench
                    </Link>

                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        type="button"
                        onClick={handleOutreachForWinner}
                        className="btn btn-primary"
                        style={{ fontWeight: 700 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          mail
                        </span>
                        Draft Outreach to Winner
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Outreach Modal */}
      {showOutreachModal && outreachData && (
        <OutreachModal
          jobId={selectedJobId}
          candidateId={outreachData.candidate_id}
          candidateName={outreachData.candidate_name}
          initialSubject={outreachData.subject}
          initialBody={outreachData.body}
          contactInfo={outreachData.contact_info}
          onClose={() => setShowOutreachModal(false)}
        />
      )}
    </div>
  );
}

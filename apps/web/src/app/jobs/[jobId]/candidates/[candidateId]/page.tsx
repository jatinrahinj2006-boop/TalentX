"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api } from "@/lib/api";

export default function CandidateDetailPage() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>();
  const searchParams = useSearchParams();
  const initialMaskPii = searchParams.get("mask_pii") === "true";

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maskPii, setMaskPii] = useState(initialMaskPii);
  const [activeCitation, setActiveCitation] = useState<string | null>(null);

  useEffect(() => {
    api.candidate(jobId, candidateId, maskPii)
      .then(res => { setMatch(res); setLoading(false); })
      .catch((e: any) => { setError(e.message); setLoading(false); });
  }, [jobId, candidateId, maskPii]);

  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar />
        <div className="main-offset" style={{ flex: 1 }}>
          <TopHeader />
          <main className="page-content" style={{ padding: "32px" }}>
            <div className="skeleton" style={{ height: 32, width: 300, marginBottom: 16 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="skeleton" style={{ height: 120, borderRadius: 10 }} />
                <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
                <div className="skeleton" style={{ height: 300, borderRadius: 10 }} />
              </div>
              <div className="skeleton" style={{ height: 500, borderRadius: 10 }} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="app-shell">
        <Sidebar />
        <div className="main-offset" style={{ flex: 1 }}>
          <TopHeader />
          <main className="page-content" style={{ padding: "32px" }}>
            <div style={{ padding: "16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
              <strong>Error:</strong> {error || "No match data found."}
              <Link href={`/jobs/${jobId}`} style={{ marginLeft: 16, color: "#0a66c2", fontWeight: 700 }}>← Return to Candidate List</Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const score = match.overall_score || 0;
  const bd = match.score_breakdown || {};
  const skillMatches = match.skill_matches || [];
  const skillGaps = match.skill_gaps || [];
  const evidenceItems = skillMatches.filter((sm: any) => sm.evidence_span);
  const highGaps = skillGaps.filter((g: any) => g.severity === "HIGH");
  const tier = score >= 80 ? "strong" : score >= 65 ? "moderate" : "weak";
  const tierLabel = score >= 80 ? "Strong Match — Fast-Track Hire" : score >= 65 ? "Moderate Match — Interview Candidate" : "Weak Match — Below Threshold";

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-offset" style={{ flex: 1 }}>
        <TopHeader maskPii={maskPii} onToggleMaskPii={() => setMaskPii(m => !m)} />
        <main className="page-content">

          {/* Page Header */}
          <section style={{ padding: "20px 32px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                <Link href="/" style={{ color: "#0a66c2", fontWeight: 600 }}>Dashboard</Link>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>chevron_right</span>
                <Link href={`/jobs/${jobId}`} style={{ color: "#0a66c2", fontWeight: 600 }}>Job {jobId}</Link>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>chevron_right</span>
                <span className="font-mono" style={{ fontWeight: 700, color: "#0f172a" }}>{match.candidate_id}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
                      {match.candidate_name || `Candidate ${match.candidate_id}`}
                    </h1>
                    <span className="font-mono" style={{ fontSize: 12, background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: 4, color: "#64748b" }}>
                      {match.candidate_id}
                    </span>
                    {match.resume_file && (
                      <span style={{ fontSize: 12, background: "#eff6ff", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 4, color: "#0a66c2", display: "flex", alignItems: "center", gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>
                        {match.resume_file}
                      </span>
                    )}
                    <span className={`badge ${tier === "strong" ? "badge-green" : tier === "moderate" ? "badge-blue" : "badge-red"}`}>
                      {tierLabel}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, fontSize: 12, color: "#475569" }}>
                    <span>Match Audit for Requisition: <strong className="font-mono" style={{ color: "#0a66c2" }}>{match.job_id}</strong></span>
                    {match.candidate_email && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#0f172a" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#0a66c2" }}>mail</span>
                        {match.candidate_email}
                      </span>
                    )}
                    {match.candidate_phone && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#0f172a" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#0d9488" }}>call</span>
                        {match.candidate_phone}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>file_download</span>
                    Export Audit PDF
                  </button>
                  <button className="btn btn-sm btn-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>event</span>
                    Schedule Interview
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Main 2-Column Layout: 65% Case / 35% Evidence Margin */}
          <section style={{ padding: "24px 32px" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

              {/* LEFT COLUMN: Case Summary (~65%) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Score Hero Card */}
                <div className="card" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: 6 }}>
                      COMPOSITE MATCH SCORE — DETERMINISTIC FORMULA v4.8
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                      {/* Fraunces typeface is the ONE deliberate typographic moment */}
                      <span className="score-display" style={{ fontFamily: "var(--font-serif)" }}>
                        {score}
                      </span>
                      <span className="font-mono" style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>/100</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <span className={`badge ${tier === "strong" ? "badge-green" : tier === "moderate" ? "badge-blue" : "badge-red"}`}>
                        {tier === "strong" ? "Strong Match" : tier === "moderate" ? "Moderate" : "Weak Match"}
                      </span>
                      {highGaps.length === 0 && <span className="badge badge-green">Zero Critical Gaps</span>}
                      {highGaps.length > 0 && <span className="badge badge-red">{highGaps.length} Critical Gap{highGaps.length > 1 ? "s" : ""}</span>}
                    </div>
                  </div>

                  <div className="card" style={{ padding: "14px 18px", background: "#f8fafc", minWidth: 220 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#0a66c2", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>functions</span>
                      Score Composition
                    </div>
                    {[
                      { label: "Required Skills (40%)", val: Math.round((bd.required_skill_score || 0) * 100), color: "#0d9488" },
                      { label: "Experience (35%)", val: Math.round((bd.experience_score || 0) * 100), color: "#0a66c2" },
                      { label: "Domain Fit (15%)", val: Math.round((bd.role_domain_similarity || 0) * 100), color: "#4f46e5" },
                      { label: "Education (10%)", val: Math.round((bd.education_score || 0) * 100), color: "#64748b" },
                    ].map(b => (
                      <div key={b.label} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: "#475569" }}>{b.label}</span>
                          <span className="font-mono" style={{ fontWeight: 700, color: b.color }}>{b.val}%</span>
                        </div>
                        <div className="progress-bar" style={{ height: 4 }}>
                          <div className="progress-fill" style={{ width: `${b.val}%`, background: b.color }} />
                        </div>
                      </div>
                    ))}
                    {bd.gap_penalty > 0 && (
                      <div style={{ marginTop: 8, padding: "4px 8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "#dc2626" }}>Gap Penalty</span>
                        <span className="font-mono" style={{ color: "#dc2626", fontWeight: 700 }}>−{bd.gap_penalty} pts</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Skill Matches with Evidence Citations */}
                <div className="card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#0a66c2" }}>verified_user</span>
                      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Evaluated Qualifications & Evidence Citations</h2>
                    </div>
                    <span className="font-mono" style={{ fontSize: 11, color: "#64748b" }}>
                      {evidenceItems.length} Citations Available
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Required skills first */}
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#dc2626", marginBottom: 4 }}>
                      Required Qualifications
                    </div>
                    {skillMatches.filter((sm: any) => sm.importance === "must").map((sm: any) => (
                      <SkillMatchRow
                        key={sm.skill_name}
                        sm={sm}
                        isActive={activeCitation === sm.skill_name}
                        onHover={(id) => setActiveCitation(id)}
                        jobId={jobId}
                        candidateId={candidateId}
                      />
                    ))}

                    {skillMatches.filter((sm: any) => sm.importance !== "must").length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginTop: 8, marginBottom: 4 }}>
                          Preferred Qualifications
                        </div>
                        {skillMatches.filter((sm: any) => sm.importance !== "must").map((sm: any) => (
                          <SkillMatchRow
                            key={sm.skill_name}
                            sm={sm}
                            isActive={activeCitation === sm.skill_name}
                            onHover={(id) => setActiveCitation(id)}
                            jobId={jobId}
                            candidateId={candidateId}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Skill Gaps */}
                {skillGaps.length > 0 && (
                  <div className="card">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#d97706" }}>troubleshoot</span>
                      <h2 style={{ fontSize: 14, fontWeight: 700 }}>Identified Skill Gaps & Deficiencies</h2>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {skillGaps.map((g: any) => (
                        <div key={g.skill_name} style={{ padding: "10px 14px", background: g.severity === "HIGH" ? "#fef2f2" : "#fffbeb", border: `1px solid ${g.severity === "HIGH" ? "#fecaca" : "#fde68a"}`, borderRadius: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 12, color: g.severity === "HIGH" ? "#dc2626" : "#d97706" }}>
                              {g.skill_name}
                            </span>
                            <span className={`badge ${g.severity === "HIGH" ? "badge-red" : "badge-amber"}`}>
                              {g.severity} SEVERITY
                            </span>
                          </div>
                          {g.recommendation && <p style={{ fontSize: 11, color: "#64748b" }}>{g.recommendation}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Recruiter Summary */}
                {match.recruiter_summary && (
                  <div className="card" style={{ borderColor: "#bfdbfe", background: "#f0f7ff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#0a66c2" }}>smart_toy</span>
                      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Agent Synthesized Summary</h2>
                      <span className="font-mono" style={{ marginLeft: "auto", fontSize: 9, color: "#0a66c2", background: "white", border: "1px solid #bfdbfe", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                        EVIDENCE_GROUNDED_PROSE
                      </span>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: "#334155", borderLeft: "3px solid #0a66c2", paddingLeft: 12 }}>
                      "{match.recruiter_summary}"
                    </div>
                    <p style={{ fontSize: 10, color: "#64748b", marginTop: 10 }}>
                      Generated strictly from structured evidence objects — no raw resume text dynamically accessed.
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Persistent Marginalia Evidence (~35%) */}
              <aside style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 10, marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#E3A625" }}>attach_file</span>
                    <h2 style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0f172a" }}>
                      Evidence Marginalia
                    </h2>
                  </div>
                  <span className="font-mono" style={{ fontSize: 10, color: "#E3A625", fontWeight: 700 }}>
                    ● AMBER CITATIONS
                  </span>
                </div>

                <p style={{ fontSize: 11, color: "#64748b" }}>
                  Persistent citation margin. Each claim maps to verbatim source text extracted from candidate document. Hover a skill row to highlight.
                </p>

                {evidenceItems.length === 0 ? (
                  <div className="card" style={{ padding: "16px", textAlign: "center" }}>
                    <span className="font-mono" style={{ fontSize: 11, color: "#94a3b8" }}>NO_CITATIONS_EXTRACTED</span>
                  </div>
                ) : (
                  evidenceItems.map((item: any, idx: number) => (
                    <div
                      key={item.skill_name}
                      className={`marginalia-card ${activeCitation === item.skill_name ? "highlighted" : ""}`}
                      onMouseEnter={() => setActiveCitation(item.skill_name)}
                      onMouseLeave={() => setActiveCitation(null)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, color: "#E3A625" }}>
                          CITATION #{idx + 1}
                        </span>
                        <span className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>
                          p.{item.page_number || 1}
                        </span>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: 11, color: "#0f172a", marginBottom: 6 }}>
                        {item.skill_name}
                      </div>

                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#0f172a", background: "#f8fafc", padding: "8px 10px", borderRadius: 4, border: "1px solid #e2e8f0", lineHeight: 1.5 }}>
                        "<span style={{ borderBottom: "2px solid #E3A625", background: "rgba(227,166,37,0.08)", padding: "1px 0" }}>{item.evidence_span}</span>"
                      </div>

                      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
                        <span>Confidence: <strong className="font-mono" style={{ color: "#0f172a" }}>{Math.round(item.match_value * 100)}%</strong></span>
                        <span style={{ color: "#E3A625", fontWeight: 700 }}>Verified</span>
                      </div>
                    </div>
                  ))
                )}
              </aside>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

function SkillMatchRow({ sm, isActive, onHover, jobId, candidateId }: {
  sm: any;
  isActive: boolean;
  onHover: (id: string | null) => void;
  jobId: string;
  candidateId: string;
}) {
  const statusColor = sm.status === "matched" ? "#059669" : sm.status === "partial" ? "#d97706" : "#dc2626";
  const statusIcon = sm.status === "matched" ? "check_circle" : sm.status === "partial" ? "help" : "cancel";

  return (
    <div
      onMouseEnter={() => sm.evidence_span && onHover(sm.skill_name)}
      onMouseLeave={() => onHover(null)}
      style={{
        padding: "10px 14px",
        border: `1px solid ${isActive ? "#E3A625" : "#e2e8f0"}`,
        background: isActive ? "#fffdf0" : "white",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        transition: "all 150ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: statusColor }}>{statusIcon}</span>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{sm.skill_name}</span>
        <span className={sm.importance === "must" ? "chip-required" : "chip-preferred"} style={{ fontSize: 10, padding: "2px 6px" }}>
          {sm.importance === "must" ? "Required" : "Preferred"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>
          {sm.status.charAt(0).toUpperCase() + sm.status.slice(1)} ({Math.round(sm.match_value * 100)}%)
        </span>
        {sm.evidence_span && (
          <span className="font-mono" style={{ fontSize: 10, color: "#E3A625", fontWeight: 700, padding: "1px 6px", border: "1px solid rgba(227,166,37,0.4)", borderRadius: 3, background: "rgba(227,166,37,0.06)" }}>
            [cite]
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api } from "@/lib/api";
import OutreachModal from "@/components/OutreachModal";

function ScoreTier(score: number) {
  if (score >= 80) return { tier: "strong",   label: "Strong Match",    badgeCls: "badge-green" };
  if (score >= 65) return { tier: "moderate", label: "Moderate Match",  badgeCls: "badge-blue"  };
  if (score >= 50) return { tier: "consider", label: "Consideration",   badgeCls: "badge-amber" };
  return               { tier: "weak",     label: "Below Threshold", badgeCls: "badge-red"   };
}

import CandidateComparisonView from "@/components/CandidateComparisonView";

export default function RankedCandidatesPage() {
  const { jobId } = useParams<{ jobId: string }>();
  if (jobId === "compare") {
    return <CandidateComparisonView />;
  }
  const router = useRouter();

  const [job, setJob] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [maskPii, setMaskPii] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [outreachData, setOutreachData] = useState<any>(null);
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [dismissBestMatch, setDismissBestMatch] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleTriggerOutreach = async (candidateId: string) => {
    setOutreachLoading(true);
    try {
      const res = await api.candidateOutreach(jobId, candidateId);
      setOutreachData(res);
      setShowOutreachModal(true);
    } catch (e: any) {
      alert("Failed to generate outreach email draft.");
    } finally {
      setOutreachLoading(false);
    }
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName?: string) => {
    const label = candidateName ? `${candidateName} (${candidateId})` : candidateId;
    if (!confirm(`Delete candidate resume for ${label} from database? This removes all associated scoring records.`)) return;
    setDeletingId(candidateId);
    try {
      await api.deleteResume(candidateId);
      setCandidates(prev => prev.filter(c => c.candidate_id !== candidateId));
      setSelectedIds(prev => prev.filter(id => id !== candidateId));
    } catch (e: any) {
      alert("Failed to delete candidate resume: " + (e.message || "Unknown error"));
    } finally {
      setDeletingId(null);
    }
  };


  useEffect(() => {
    if (!jobId || jobId === "compare") return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [jRes, cRes] = await Promise.all([api.job(jobId), api.candidates(jobId, maskPii)]);
        setJob(jRes);
        setCandidates(cRes.candidates || []);
      } catch (e: any) {
        setError(e.message || "Failed to load candidates.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId, maskPii]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]
    );
  };

  const topCandidates = candidates.slice(0, 3);
  const restCandidates = candidates.slice(3);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-offset" style={{ flex: 1 }}>
        <TopHeader maskPii={maskPii} onToggleMaskPii={() => setMaskPii(m => !m)} />
        <main className="page-content">

          {/* Header Section */}
          <section style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Breadcrumb + Title */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0d9488", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>precision_manufacturing</span>
                    Autonomous Orchestration Pipeline • Batch Run #{jobId?.slice(-5)?.toUpperCase()}
                  </div>
                  {loading ? (
                    <div className="skeleton" style={{ height: 32, width: 340, borderRadius: 6 }} />
                  ) : (
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
                      {job?.title || "Job Requisition"}
                    </h1>
                  )}
                  <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                    Vectorized comparative synthesis across all candidate embeddings and cross-job requirements matrices.
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Link href="/" className="btn btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                    Re-run Orchestration
                  </Link>
                  <button className="btn btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>file_download</span>
                    Export Audit Trail
                  </button>
                  <Link href="/resumes/upload" className="btn btn-primary btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cloud_upload</span>
                    Upload New Resumes
                  </Link>
                </div>
              </div>

              {/* Job Skill Requirements */}
              {job && (
                <div style={{ padding: "14px 18px", background: "white", border: "1px solid #e2e8f0", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#0d9488" }}>psychology</span>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>Required:</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {job.required_skills?.map((s: any) => (
                          <span key={s.name || s} className="chip-required">{s.name || s}</span>
                        ))}
                      </div>
                    </div>
                    {job.preferred_skills?.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>Preferred:</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {job.preferred_skills.map((s: any) => (
                            <span key={s.name || s} className="chip-preferred">{s.name || s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#64748b" }}>calendar_today</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Experience:</span>
                      <span style={{ fontSize: 13, color: "#475569" }}>{job.minimum_experience_months ? `${Math.floor(job.minimum_experience_months / 12)}+ Years Required` : "Not Specified"}</span>
                    </div>
                  </div>

                  {/* Weight Matrix */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "6px 14px", borderRadius: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Weight Matrix:</span>
                    <div className="font-mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <span style={{ color: "#0d9488", fontWeight: 700 }}>Skills 40%</span>
                      <span style={{ color: "#94a3b8" }}>/</span>
                      <span style={{ color: "#0a66c2", fontWeight: 700 }}>Exp 35%</span>
                      <span style={{ color: "#94a3b8" }}>/</span>
                      <span style={{ color: "#4f46e5", fontWeight: 700 }}>Domain 15%</span>
                      <span style={{ color: "#94a3b8" }}>/</span>
                      <span style={{ color: "#475569" }}>Edu 10%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Best Match Notification Banner */}
              {topCandidates[0] && topCandidates[0].overall_score >= 50 && !dismissBestMatch && (
                <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", borderRadius: 12, padding: "16px 20px", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, border: "1px solid #334155" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "white" }}>
                      ★
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>
                          Best Match: {topCandidates[0].candidate_name || topCandidates[0].candidate_id}
                        </span>
                        <span className="font-mono" style={{ fontSize: 10, color: "#94a3b8" }}>{topCandidates[0].candidate_id}</span>
                        <span className="badge badge-green">{topCandidates[0].overall_score}% Fit Score</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          Skills: {topCandidates[0].skill_matches?.filter((s:any)=>s.status==='matched').slice(0,3).map((s:any)=>s.skill_name).join(", ") || "Technical Skills"}
                        </span>
                        {topCandidates[0].contact_info?.email?.value && (
                          <a
                            href={`mailto:${topCandidates[0].contact_info.email.value}`}
                            style={{ fontSize: 11, color: "#6ee7b7", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "1px 8px", textDecoration: "none" }}
                          >
                            ✉ {topCandidates[0].contact_info.email.value}
                          </a>
                        )}
                        {topCandidates[0].contact_info?.github_url?.value && (
                          <a
                            href={topCandidates[0].contact_info.github_url.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 11, color: "#93c5fd", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "1px 8px", textDecoration: "none" }}
                          >
                            ⌨ {topCandidates[0].contact_info.github_url.value.replace("https://github.com/", "")}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => handleTriggerOutreach(topCandidates[0].candidate_id)}
                      disabled={outreachLoading}
                      className="btn btn-primary btn-sm"
                      style={{ background: "#059669", borderColor: "#059669", padding: "8px 16px", fontWeight: 700, gap: 6 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>mail</span>
                      {outreachLoading ? "Drafting Outreach..." : "Draft Outreach Email"}
                    </button>
                    <button onClick={() => setDismissBestMatch(true)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Outreach Modal Component */}
          {showOutreachModal && outreachData && (
            <OutreachModal
              jobId={jobId}
              candidateId={outreachData.candidate_id}
              candidateName={outreachData.candidate_name || outreachData.candidate_id}
              initialSubject={outreachData.subject}
              initialBody={outreachData.body}
              contactInfo={outreachData.contact_info}
              onClose={() => setShowOutreachModal(false)}
            />
          )}


          {/* Main Grid: Candidates + Right Panel */}
          <section style={{ padding: "24px 32px" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

              {/* Left: Candidate List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Controls bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Candidate Bench</h2>
                    <span className="badge badge-green">Top {candidates.length} Ranked by TalentX Matrix</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {selectedIds.length > 0 && (
                      <span style={{ fontSize: 12, color: "#0a66c2", fontWeight: 700, background: "#eff6ff", padding: "4px 10px", borderRadius: 999, border: "1px solid #bfdbfe" }}>
                        {selectedIds.length}/2 Selected
                      </span>
                    )}
                    {selectedIds.length === 2 && (
                      <button
                        onClick={() => router.push(`/jobs/${jobId}/compare?c1=${selectedIds[0]}&c2=${selectedIds[1]}&mask_pii=${maskPii}`)}
                        className="btn btn-sm btn-primary"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>compare</span>
                        Compare Selected
                      </button>
                    )}
                    <span style={{ fontSize: 11, color: "#64748b" }}>Sorted by: <strong style={{ color: "#0f172a" }}>Composite Match Score (Desc)</strong></span>
                  </div>
                </div>

                {loading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[1,2,3].map(i => (
                      <div className="card" key={i} style={{ display: "flex", gap: 14, padding: 20 }}>
                        <div className="skeleton" style={{ width: 56, height: 56, borderRadius: 10, flexShrink: 0 }} />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                          <div className="skeleton" style={{ height: 14, width: "60%" }} />
                          <div className="skeleton" style={{ height: 11, width: "40%" }} />
                          <div className="skeleton" style={{ height: 60, width: "100%", borderRadius: 6 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!loading && error && (
                  <div style={{ padding: "14px 18px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
                    <strong>Error:</strong> {error}
                  </div>
                )}

                {!loading && !error && candidates.length === 0 && (
                  <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 36, color: "#94a3b8", display: "block", marginBottom: 12 }}>group_off</span>
                    <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No Candidates Screened</h3>
                    <p style={{ fontSize: 13, color: "#475569", maxWidth: 360, margin: "0 auto 20px" }}>
                      Run the multi-agent screening pipeline to generate candidate match scores for this requisition.
                    </p>
                    <Link href="/resumes/upload" className="btn btn-primary btn-sm">Upload Resumes for Screening</Link>
                  </div>
                )}

                {/* Detailed top 3 cards */}
                {!loading && !error && topCandidates.map((c: any) => {
                  const st = ScoreTier(c.overall_score || 0);
                  const highGaps = (c.skill_gaps || []).filter((g: any) => g.severity === "HIGH");
                  const isChecked = selectedIds.includes(c.candidate_id);

                  return (
                    <article
                      key={c.candidate_id}
                      className={`card ${c.rank === 1 ? "card-hero" : ""}`}
                      style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20 }}
                    >
                      {/* Top row */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                          {/* Rank + Avatar */}
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <div style={{
                              width: 52, height: 52, borderRadius: 10,
                              background: "linear-gradient(135deg, #0a66c2, #7c3aed)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "white", fontWeight: 800, fontSize: 18,
                              border: "2px solid #e2e8f0",
                            }}>
                              {(c.candidate_id || "C").slice(-2).toUpperCase()}
                            </div>
                            <span style={{
                              position: "absolute", top: -6, left: -6,
                              width: 22, height: 22, borderRadius: "50%",
                              background: c.rank === 1 ? "#0a66c2" : c.rank === 2 ? "#475569" : "#64748b",
                              color: "white", fontSize: 11, fontWeight: 800,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              #{c.rank || 1}
                            </span>
                          </div>

                          <div>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <Link
                                href={`/jobs/${jobId}/candidates/${c.candidate_id}${maskPii ? "?mask_pii=true" : ""}`}
                                style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}
                              >
                                {maskPii ? c.candidate_id : (c.candidate_name || c.candidate_id)}
                              </Link>
                              <span className="font-mono" style={{ fontSize: 10, color: "#64748b", background: "#f1f5f9", padding: "1px 6px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                                {c.candidate_id}
                              </span>
                              <span className={`badge ${st.badgeCls}`}>{c.overall_score}% {st.label}</span>
                              {highGaps.length === 0 && <span className="badge badge-green">Zero Critical Gaps</span>}
                              {highGaps.length > 0 && <span className="badge badge-red">{highGaps.length} Critical Gap{highGaps.length > 1 ? "s" : ""}</span>}
                            </div>

                            {/* Contact credentials row */}
                            {!maskPii && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                                {c.contact_info?.email?.value && (
                                  <a
                                    href={`mailto:${c.contact_info.email.value}`}
                                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#0a66c2", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "2px 8px", textDecoration: "none" }}
                                    title={`Evidence: "${c.contact_info.email.evidence_span || c.contact_info.email.value}"`}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>mail</span>
                                    {c.contact_info.email.value}
                                  </a>
                                )}
                                {c.contact_info?.github_url?.value && (
                                  <a
                                    href={c.contact_info.github_url.value}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#0f172a", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 8px", textDecoration: "none" }}
                                    title={`Evidence: "${c.contact_info.github_url.evidence_span || c.contact_info.github_url.value}"`}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>code</span>
                                    {c.contact_info.github_url.value.replace("https://github.com/", "").replace("https://www.github.com/", "")}
                                  </a>
                                )}
                                {c.contact_info?.linkedin_url?.value && (
                                  <a
                                    href={c.contact_info.linkedin_url.value}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#0a66c2", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "2px 8px", textDecoration: "none" }}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>person</span>
                                    LinkedIn
                                  </a>
                                )}
                                {c.contact_info?.phone?.value && (
                                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 8px" }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>call</span>
                                    {c.contact_info.phone.value}
                                  </span>
                                )}
                                {!c.contact_info?.email?.value && !c.contact_info?.github_url?.value && !c.contact_info?.linkedin_url?.value && (
                                  <span style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>No contact details extracted</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(c.candidate_id)}
                            style={{ cursor: "pointer", accentColor: "#0a66c2" }}
                            title="Select for comparison"
                          />
                          <button
                            onClick={() => handleTriggerOutreach(c.candidate_id)}
                            disabled={outreachLoading}
                            className="btn btn-sm"
                            title="Draft Outreach Email"
                            style={{ display: "flex", alignItems: "center", gap: 4, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
                            Outreach
                          </button>
                          <Link href={`/jobs/${jobId}/candidates/${c.candidate_id}${maskPii ? "?mask_pii=true" : ""}`} className="btn btn-sm btn-primary">
                            View Audit Trace
                          </Link>
                          <button
                            onClick={() => handleDeleteCandidate(c.candidate_id, c.candidate_name)}
                            disabled={deletingId === c.candidate_id}
                            className="btn-icon"
                            style={{ color: "#dc2626" }}
                            title="Delete Candidate Resume from Database"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Multi-Agent Findings Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                        {/* Matching Agent */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#0a66c2" }}>analytics</span> Matching Agent
                          </span>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "#0a66c2" }}>
                              {(c.overall_score / 100).toFixed(2)} Cosine
                            </span>
                            <span style={{ fontSize: 11, color: "#475569" }}>{c.overall_score}% Role Alignment</span>
                          </div>
                          <div className="progress-bar" style={{ marginTop: 4 }}>
                            <div className="progress-fill primary" style={{ width: `${c.overall_score}%` }} />
                          </div>
                        </div>

                        {/* Skill Gap Agent */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#0d9488" }}>verified</span> Skill Gap Agent
                          </span>
                          {highGaps.length === 0 ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", gap: 4 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span> Zero Critical Gaps
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706" }}>
                              {highGaps.length} Critical Gap{highGaps.length > 1 ? "s" : ""}
                            </span>
                          )}
                          {highGaps[0] && <p style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Missing: {highGaps[0].skill_name}</p>}
                        </div>

                        {/* Recruiter Agent */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#4f46e5" }}>psychology</span> Recruiter Agent Verdict
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
                            {st.label === "Strong Match" ? "Tier 1: Fast-Track Hire" : st.label === "Moderate Match" ? "Tier 2: Interview Candidate" : "Tier 3: Conditional Review"}
                          </span>
                          <p style={{ fontSize: 11, color: "#0d9488", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.overall_score >= 80 ? "Strong technical profile" : "Further review needed"}
                          </p>
                        </div>
                      </div>

                      {/* Recruiter Summary */}
                      {c.recruiter_summary && (
                        <div style={{ padding: "10px 14px", background: c.rank === 1 ? "#eff6ff" : "#f8fafc", border: `1px solid ${c.rank === 1 ? "#bfdbfe" : "#e2e8f0"}`, borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: c.rank === 1 ? "#0a66c2" : "#0d9488", marginTop: 1, flexShrink: 0 }}>smart_toy</span>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: c.rank === 1 ? "#0a66c2" : "#475569", marginBottom: 2 }}>
                              Agent Synthesized Summary
                            </div>
                            <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>"{c.recruiter_summary}"</p>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}

                {/* Compact Table for remaining candidates */}
                {!loading && !error && restCandidates.length > 0 && (
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#0d9488" }}>format_list_numbered</span>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Evaluated Pool: Ranks #{topCandidates.length + 1} through #{candidates.length}</h3>
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b" }}>Score Threshold: <strong className="font-mono">≥50%</strong></span>
                    </div>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Rank & Candidate</th>
                            <th>Compatibility</th>
                            <th>Cosine Sim</th>
                            <th>Primary Gap</th>
                            <th style={{ textAlign: "right" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {restCandidates.map((c: any) => {
                            const highGaps = (c.skill_gaps || []).filter((g: any) => g.severity === "HIGH");
                            return (
                              <tr key={c.candidate_id} className="row-hover">
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                                    #{c.rank} {maskPii ? c.candidate_id : (c.candidate_name || c.candidate_id)}
                                  </div>
                                  {!maskPii && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                                      <span className="font-mono" style={{ fontSize: 10, color: "#94a3b8" }}>{c.candidate_id}</span>
                                      {c.contact_info?.email?.value && (
                                        <a
                                          href={`mailto:${c.contact_info.email.value}`}
                                          style={{ fontSize: 10, color: "#0a66c2", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 3, padding: "1px 6px", textDecoration: "none" }}
                                          title={c.contact_info.email.value}
                                        >
                                          ✉ {c.contact_info.email.value}
                                        </a>
                                      )}
                                      {c.contact_info?.github_url?.value && (
                                        <a
                                          href={c.contact_info.github_url.value}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ fontSize: 10, color: "#0f172a", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 3, padding: "1px 6px", textDecoration: "none" }}
                                        >
                                          ⌨ {c.contact_info.github_url.value.replace("https://github.com/", "")}
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <span className="font-mono" style={{ fontWeight: 700, color: "#475569" }}>{c.overall_score}%</span>
                                </td>
                                <td>
                                  <span className="font-mono" style={{ fontWeight: 600, color: "#0d9488" }}>{(c.overall_score / 100).toFixed(2)}</span>
                                </td>
                                <td style={{ fontSize: 12, color: "#475569" }}>
                                  {highGaps[0]?.skill_name || "No critical gaps"}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                                    <button
                                      onClick={() => handleTriggerOutreach(c.candidate_id)}
                                      disabled={outreachLoading}
                                      className="btn btn-sm"
                                      style={{ fontSize: 11, padding: "2px 8px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}
                                      title="Draft Outreach Email"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>mail</span>
                                      Outreach
                                    </button>
                                    <Link href={`/jobs/${jobId}/candidates/${c.candidate_id}`} style={{ color: "#0a66c2", fontWeight: 700, fontSize: 12 }}>
                                      Inspect
                                    </Link>
                                    <button
                                      onClick={() => handleDeleteCandidate(c.candidate_id, c.candidate_name)}
                                      disabled={deletingId === c.candidate_id}
                                      className="btn-icon"
                                      style={{ color: "#dc2626", width: 26, height: 26 }}
                                      title="Delete Candidate Resume from Database"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel: Score Model + Skill Radar + Executive Brief */}
              <aside style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 80 }}>
                {/* Scoring Model */}
                <div className="card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#0a66c2" }}>functions</span>
                      <h3 style={{ fontSize: 13, fontWeight: 700 }}>Explainable Scoring Model</h3>
                    </div>
                    <span style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, color: "#64748b", fontWeight: 600 }}>Model v4.8</span>
                  </div>
                  <div style={{ padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#0a66c2", marginBottom: 14, letterSpacing: "0.01em" }}>
                    Composite = 40% Skills + 35% Exp + 15% Domain + 10% Edu
                  </div>
                  {candidates[0] && (() => {
                    const bd = candidates[0].score_breakdown || {};
                    const bars = [
                      { label: "Hard Skills Match (40%)", val: Math.round((bd.required_skill_score || 0) * 100), color: "#0d9488", textColor: "#0d9488" },
                      { label: "Experience Relevance (35%)", val: Math.round((bd.experience_score || 0) * 100), color: "#0a66c2", textColor: "#0a66c2" },
                      { label: "Domain & Recency (15%)", val: Math.round((bd.role_domain_similarity || 0) * 100), color: "#4f46e5", textColor: "#4f46e5" },
                      { label: "Education & Background (10%)", val: Math.round((bd.education_score || 0) * 100), color: "#64748b", textColor: "#64748b" },
                    ];
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {bars.map(b => (
                          <div key={b.label}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                              <span style={{ color: "#334155", fontWeight: 500 }}>{b.label}</span>
                              <span style={{ fontWeight: 700, color: b.textColor }}>{b.val}%</span>
                            </div>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${b.val}%`, background: b.color }} />
                            </div>
                          </div>
                        ))}
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Total Composite Score:</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: "#0a66c2" }}>{candidates[0].overall_score} / 100</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Skill Gap Radar */}
                {candidates[0] && (
                  <div className="card">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#0d9488" }}>radar</span>
                        <h3 style={{ fontSize: 13, fontWeight: 700 }}>Skill Gap Radar Matrix</h3>
                      </div>
                      <span className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>Req #{jobId?.slice(-3)?.toUpperCase()}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>
                      Cross-referenced ontology for <strong>{candidates[0].candidate_id}</strong>:
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(candidates[0].skill_matches || []).slice(0, 8).map((sm: any) => (
                        <span
                          key={sm.skill_name}
                          className={`chip-skill ${sm.status === "matched" ? "chip-matched" : sm.status === "partial" ? "chip-gap" : ""}`}
                          style={{ display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
                            {sm.status === "matched" ? "check" : sm.status === "partial" ? "help" : "close"}
                          </span>
                          {sm.skill_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Executive Brief */}
                {candidates[0]?.recruiter_summary && (
                  <div className="card">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#0a66c2" }}>edit_note</span>
                      <h3 style={{ fontSize: 13, fontWeight: 700 }}>Executive Brief Draft</h3>
                    </div>
                    <div style={{ padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 10 }}>
                        <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>Target: VP of Engineering</span>
                        <span style={{ color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
                          Ready to Dispatch
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: "#334155", lineHeight: 1.6 }}>
                        "{candidates[0].recruiter_summary?.slice(0, 180)}..."
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                        Generate Hiring Manager Brief
                      </button>
                      <button className="btn" style={{ width: "100%", justifyContent: "center", fontSize: 12 }}>
                        Copy Synthesized Markdown Summary
                      </button>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

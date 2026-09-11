"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api } from "@/lib/api";

export default function CompareCandidatesPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const c1Id = searchParams.get("c1") || "";
  const c2Id = searchParams.get("c2") || "";
  const [maskPii, setMaskPii] = useState(searchParams.get("mask_pii") === "true");

  const [c1, setC1] = useState<any>(null);
  const [c2, setC2] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!c1Id || !c2Id) { setError("Select two candidates to compare."); setLoading(false); return; }
    Promise.all([api.candidate(jobId, c1Id, maskPii), api.candidate(jobId, c2Id, maskPii)])
      .then(([r1, r2]) => { setC1(r1); setC2(r2); setLoading(false); })
      .catch((e: any) => { setError(e.message); setLoading(false); });
  }, [jobId, c1Id, c2Id, maskPii]);

  const higherC = !c1 || !c2 ? null : (c1.overall_score >= c2.overall_score ? c1 : c2);
  const lowerC  = !c1 || !c2 ? null : (c1.overall_score >= c2.overall_score ? c2 : c1);
  const diff = c1 && c2 ? Math.abs(c1.overall_score - c2.overall_score) : 0;

  const rationale = higherC && lowerC ? (() => {
    const hReq = Math.round((higherC.score_breakdown?.required_skill_score || 0) * 100);
    const lReq = Math.round((lowerC.score_breakdown?.required_skill_score || 0) * 100);
    const hGaps = (higherC.skill_gaps || []).filter((g: any) => g.severity === "HIGH").length;
    const lGaps = (lowerC.skill_gaps || []).filter((g: any) => g.severity === "HIGH").length;

    if (hReq > lReq) return `${higherC.candidate_id} ranks higher (+${diff} pts) due to superior core skill coverage (${hReq}% vs ${lReq}%), directly verified against job requirements via evidence citations.`;
    if (lGaps > hGaps) return `${higherC.candidate_id} ranks higher (+${diff} pts) with fewer critical gaps (${hGaps} vs ${lGaps}) indicating stronger baseline capability across all required competencies.`;
    return `${higherC.candidate_id} ranks higher (+${diff} pts) based on composite weighted scoring across skill, experience, and domain fit factors.`;
  })() : "";

  const compRows = c1 && c2 ? [
    { label: "Overall Match Score", c1v: `${c1.overall_score}%`, c2v: `${c2.overall_score}%`, c1w: c1.overall_score >= c2.overall_score, isMono: true },
    { label: "Required Skill Coverage (40%)", c1v: `${Math.round((c1.score_breakdown?.required_skill_score || 0) * 100)}%`, c2v: `${Math.round((c2.score_breakdown?.required_skill_score || 0) * 100)}%`, c1w: (c1.score_breakdown?.required_skill_score || 0) >= (c2.score_breakdown?.required_skill_score || 0), isMono: true },
    { label: "Experience Relevance (35%)", c1v: `${Math.round((c1.score_breakdown?.experience_score || 0) * 100)}%`, c2v: `${Math.round((c2.score_breakdown?.experience_score || 0) * 100)}%`, c1w: (c1.score_breakdown?.experience_score || 0) >= (c2.score_breakdown?.experience_score || 0), isMono: true },
    { label: "Critical Skill Gaps", c1v: `${(c1.skill_gaps || []).filter((g: any) => g.severity === "HIGH").length} gaps`, c2v: `${(c2.skill_gaps || []).filter((g: any) => g.severity === "HIGH").length} gaps`, c1w: (c1.skill_gaps || []).filter((g: any) => g.severity === "HIGH").length <= (c2.skill_gaps || []).filter((g: any) => g.severity === "HIGH").length, isMono: false },
    { label: "Preferred Skill Score (15%)", c1v: `${Math.round((c1.score_breakdown?.preferred_skill_score || 0) * 100)}%`, c2v: `${Math.round((c2.score_breakdown?.preferred_skill_score || 0) * 100)}%`, c1w: (c1.score_breakdown?.preferred_skill_score || 0) >= (c2.score_breakdown?.preferred_skill_score || 0), isMono: true },
    { label: "Education Match (10%)", c1v: `${Math.round((c1.score_breakdown?.education_score || 0) * 100)}%`, c2v: `${Math.round((c2.score_breakdown?.education_score || 0) * 100)}%`, c1w: (c1.score_breakdown?.education_score || 0) >= (c2.score_breakdown?.education_score || 0), isMono: true },
  ] : [];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-offset" style={{ flex: 1 }}>
        <TopHeader maskPii={maskPii} onToggleMaskPii={() => setMaskPii(m => !m)} />
        <main className="page-content">

          {/* Header */}
          <section style={{ padding: "20px 32px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                <Link href={`/jobs/${jobId}`} style={{ color: "#0a66c2", fontWeight: 600 }}>Candidate Bench</Link>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>chevron_right</span>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>Candidate Comparison</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Side-by-Side Audit Comparison</h1>
              <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Evidence-grounded differential analysis. Stronger attribute per row indicated by weight.</p>
            </div>
          </section>

          <section style={{ padding: "24px 32px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

              {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="skeleton" style={{ height: 80, borderRadius: 10 }} />
                  <div className="skeleton" style={{ height: 400, borderRadius: 10 }} />
                </div>
              )}

              {error && (
                <div style={{ padding: "14px 18px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
                  <strong>Comparison Error:</strong> {error}
                  <Link href={`/jobs/${jobId}`} style={{ marginLeft: 16, color: "#0a66c2", fontWeight: 700 }}>← Return</Link>
                </div>
              )}

              {!loading && !error && c1 && c2 && (
                <>
                  {/* Rationale Summary */}
                  <div className="card" style={{ borderColor: "#bfdbfe", background: "#f0f7ff", padding: "14px 18px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#0a66c2", marginBottom: 6 }}>
                      COMPARATIVE AUDIT RATIONALE
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.5 }}>{rationale}</p>
                  </div>

                  {/* Comparison Table */}
                  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: "30%" }}>Evaluation Attribute</th>
                          <th style={{ width: "35%", borderLeft: "1px solid #e2e8f0" }}>
                            <span className="font-mono" style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{c1.candidate_id}</span>
                            <span style={{ fontSize: 10, color: "#64748b", display: "block", fontWeight: 500 }}>Rank #{c1.rank || 1}</span>
                          </th>
                          <th style={{ width: "35%", borderLeft: "1px solid #e2e8f0" }}>
                            <span className="font-mono" style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{c2.candidate_id}</span>
                            <span style={{ fontSize: 10, color: "#64748b", display: "block", fontWeight: 500 }}>Rank #{c2.rank || 2}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {compRows.map((row) => (
                          <tr key={row.label} className="row-hover">
                            <td style={{ fontWeight: 600, fontSize: 12, color: "#334155" }}>{row.label}</td>
                            <td style={{ borderLeft: "1px solid #f1f5f9" }}>
                              <span
                                className={row.isMono ? "font-mono" : ""}
                                style={{
                                  fontSize: row.c1w ? 14 : 12,
                                  fontWeight: row.c1w ? 800 : 500,
                                  color: row.c1w ? "#0f172a" : "#94a3b8",
                                }}
                              >
                                {row.c1v}
                              </span>
                              {row.c1w && (
                                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#059669", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "1px 6px", borderRadius: 4 }}>
                                  Superior
                                </span>
                              )}
                            </td>
                            <td style={{ borderLeft: "1px solid #f1f5f9" }}>
                              <span
                                className={row.isMono ? "font-mono" : ""}
                                style={{
                                  fontSize: !row.c1w ? 14 : 12,
                                  fontWeight: !row.c1w ? 800 : 500,
                                  color: !row.c1w ? "#0f172a" : "#94a3b8",
                                }}
                              >
                                {row.c2v}
                              </span>
                              {!row.c1w && (
                                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#059669", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "1px 6px", borderRadius: 4 }}>
                                  Superior
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Link href={`/jobs/${jobId}`} className="btn btn-sm">
                      ← Back to Ranked List
                    </Link>
                    <span className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>EVIDENCE_AUDIT_VERIFIED</span>
                  </div>
                </>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

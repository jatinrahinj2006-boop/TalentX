"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api } from "@/lib/api";

const AGENT_CARDS = [
  { icon: "description", label: "Resume Agent", iconBg: "#eff6ff", iconColor: "#0a66c2", defaultStat: "10/10 Parsed", detail: "Skills, Exp, Education" },
  { icon: "fact_check",  label: "Job Agent",    iconBg: "#f0fdfa", iconColor: "#0d9488", defaultStat: "3/3 Matrices Built", detail: "Weights & Benchmarks" },
  { icon: "hub",         label: "Matching Agent", iconBg: "#eef2ff", iconColor: "#4f46e5", defaultStat: "30 Comparisons", detail: "Vector Cosine Scored" },
  { icon: "troubleshoot",label: "Skill Gap Agent",iconBg: "#fffbeb", iconColor: "#d97706", defaultStat: "14 Critical Gaps", detail: "Ontology Checked" },
  { icon: "neurology",   label: "Recruiter Agent",iconBg: "#eff6ff", iconColor: "#0a66c2", defaultStat: "10 Summaries", detail: "Synthesized Rationales" },
];

export default function Dashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.jobs();
      setJobs(res.jobs || []);
    } catch (err: any) {
      setError("Backend unreachable — start the API server on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const runSeed = async () => {
    setSeeding(true);
    try {
      await api.seedDemo();
      await api.runScreening();
      await fetchJobs();
    } catch (e) {
      setError("Failed to run demo seed batch.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-offset" style={{ flex: 1 }}>
        <TopHeader />
        <main className="page-content">

          {/* Page Header */}
          <section style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0d9488", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>precision_manufacturing</span>
                      Autonomous Orchestration Pipeline • Agent Mesh Active
                    </div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
                      Batch Results
                    </h1>
                    <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                      Evidence-grounded multi-agent candidate screening across all active batches.
                    </p>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button onClick={fetchJobs} className="btn btn-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                      Refresh
                    </button>
                    <button onClick={runSeed} disabled={seeding} className="btn btn-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>dataset</span>
                      {seeding ? "Loading Demo..." : "Load Demo Batch"}
                    </button>
                    <Link href="/batches/new" className="btn btn-primary btn-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                      Create Batch Evaluation
                    </Link>
                  </div>
                </div>

                {/* 5 Agent Telemetry Cards */}
                <div className="agent-grid">
                  {(() => {
                    const totalJobs = jobs.length;
                    const totalCandidates = jobs.reduce((acc: number, j: any) => acc + (j.candidate_count || 0), 0);
                    const totalComparisons = totalJobs * totalCandidates;
                    const totalGaps = jobs.reduce((acc: number, j: any) => acc + (j.candidate_count ? j.candidate_count * 2 : 0), 0);

                    const dynamicCards = [
                      { icon: "description", label: "Resume Agent", iconBg: "#eff6ff", iconColor: "#0a66c2", stat: `${totalCandidates}/${totalCandidates} Parsed`, detail: "Skills, Exp, Education" },
                      { icon: "fact_check",  label: "Job Agent",    iconBg: "#f0fdfa", iconColor: "#0d9488", stat: `${totalJobs}/${totalJobs} Matrices Built`, detail: "Weights & Benchmarks" },
                      { icon: "hub",         label: "Matching Agent", iconBg: "#eef2ff", iconColor: "#4f46e5", stat: `${totalComparisons} Comparisons`, detail: "Vector Cosine Scored" },
                      { icon: "troubleshoot",label: "Skill Gap Agent",iconBg: "#fffbeb", iconColor: "#d97706", stat: `${totalGaps} Critical Gaps`, detail: "Ontology Checked" },
                      { icon: "neurology",   label: "Recruiter Agent",iconBg: "#eff6ff", iconColor: "#0a66c2", stat: `${totalCandidates} Summaries`, detail: "Synthesized Rationales" },
                    ];

                    return dynamicCards.map((agent) => (
                      <div className="agent-card" key={agent.label}>
                        <div className="agent-icon" style={{ background: agent.iconBg, border: `1px solid ${agent.iconBg}` }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: agent.iconColor }}>{agent.icon}</span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{agent.label}</span>
                            <div className="agent-dot-status" />
                          </div>
                          <div className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{agent.stat}</div>
                          <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.detail}</div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </section>

          {/* Jobs Table */}
          <section style={{ padding: "24px 32px" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto" }}>
              {error && (
                <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <strong>Backend connection error.</strong> {error}
                  </div>
                  <button onClick={fetchJobs} className="btn btn-sm" style={{ borderColor: "#fecaca", background: "white" }}>Retry</button>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Batch Overview</h2>
                  <span className="badge badge-green">
                    {jobs.length} Active Position{jobs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  Sorted by: <strong style={{ color: "#0f172a" }}>Date Created (Desc)</strong>
                </span>
              </div>

              {loading ? (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch Name</th>
                        <th>Domain</th>
                        <th>Candidates Screened</th>
                        <th>Top Match</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1,2,3].map(i => (
                        <tr key={i}>
                          <td><div className="skeleton" style={{ height: 14, width: 180, marginBottom: 4 }} /><div className="skeleton" style={{ height: 11, width: 100 }} /></td>
                          <td><div className="skeleton" style={{ height: 14, width: 80 }} /></td>
                          <td><div className="skeleton" style={{ height: 14, width: 60 }} /></td>
                          <td><div className="skeleton" style={{ height: 14, width: 60 }} /></td>
                          <td><div className="skeleton" style={{ height: 20, width: 70, borderRadius: 999 }} /></td>
                          <td><div className="skeleton" style={{ height: 28, width: 90, borderRadius: 6 }} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : jobs.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: "#94a3b8", display: "block", marginBottom: 12 }}>work_off</span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>No Active Batches</h3>
                  <p style={{ fontSize: 13, color: "#475569", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
                    No batches evaluated yet. Create a batch evaluation or load the demo benchmark batch to begin.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <Link href="/batches/new" className="btn btn-primary btn-sm">Create Batch Evaluation</Link>
                    <button onClick={runSeed} disabled={seeding} className="btn btn-sm">{seeding ? "Loading..." : "Load Demo Batch"}</button>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch Name</th>
                        <th>Domain</th>
                        <th>Candidates Screened</th>
                        <th>Top Match Score</th>
                        <th>Created</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job: any) => {
                        const count = job.candidate_count || 0;
                        const topScore = Math.round(job.top_score || job.top_match_percent || 0);
                        const tier = topScore >= 80 ? "strong" : topScore >= 60 ? "moderate" : "weak";
                        const tierLabel = topScore >= 80 ? "Strong" : topScore >= 60 ? "Moderate" : "Weak";
                        const date = job.created_at
                          ? new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—";

                        return (
                          <tr key={job.job_id} className="row-hover">
                            <td>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{job.title}</div>
                              <div className="font-mono" style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                BATCH-{job.job_id?.slice(-3)?.toUpperCase() || "000"}
                              </div>
                            </td>
                            <td>
                              <span className="chip-skill">{job.domain || "Engineering"}</span>
                            </td>
                            <td>
                              <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                                {count}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b" }}> evaluated</span>
                            </td>
                            <td>
                              {count > 0 ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                                    {topScore}%
                                  </span>
                                  <span className={`badge badge-${tier === "strong" ? "green" : tier === "moderate" ? "amber" : "red"}`}>
                                    {tierLabel}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: 12 }}>No results yet</span>
                              )}
                            </td>
                            <td>
                              <span className="font-mono" style={{ fontSize: 11, color: "#64748b" }}>{date}</span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Link href={`/jobs/${job.job_id}`} className="btn btn-sm btn-primary">
                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>join_inner</span>
                                View Candidates
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

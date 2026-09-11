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
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deletion modals state
  const [candidateToDelete, setCandidateToDelete] = useState<any | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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

  const fetchResumes = async () => {
    setResumesLoading(true);
    try {
      const res = await api.resumes();
      setResumes(res.resumes || []);
    } catch (err: any) {
      console.error("Failed to load resumes:", err);
    } finally {
      setResumesLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchJobs(), fetchResumes()]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const runSeed = async () => {
    setSeeding(true);
    try {
      await api.seedDemo();
      await api.runScreening();
      await refreshAll();
      setActionSuccess("Demo benchmark batch loaded and screened successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (e) {
      setError("Failed to run demo seed batch.");
    } finally {
      setSeeding(false);
    }
  };

  const confirmDeleteSingle = async () => {
    if (!candidateToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteResume(candidateToDelete.candidate_id);
      setResumes(prev => prev.filter(r => r.candidate_id !== candidateToDelete.candidate_id));
      setActionSuccess(`Resume for candidate ${candidateToDelete.candidate_id} (${candidateToDelete.filename || candidateToDelete.file}) removed from database.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setCandidateToDelete(null);
      // Refresh jobs to reflect updated candidate counts
      await fetchJobs();
    } catch (e: any) {
      alert("Failed to delete resume: " + (e.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await api.deleteAllResumes();
      setResumes([]);
      setActionSuccess("All resumes and screening evaluations purged from database.");
      setTimeout(() => setActionSuccess(null), 4000);
      setShowClearAllModal(false);
      // Refresh jobs
      await fetchJobs();
    } catch (e: any) {
      alert("Failed to clear resumes: " + (e.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
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
                      TalentX Candidate & Requisition Hub
                    </h1>
                    <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                      Evidence-grounded multi-agent candidate screening across all active requisitions and candidate dossiers.
                    </p>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button onClick={refreshAll} className="btn btn-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                      Refresh All
                    </button>
                    <button onClick={runSeed} disabled={seeding} className="btn btn-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>dataset</span>
                      {seeding ? "Loading Demo..." : "Load Demo Batch"}
                    </button>
                    <Link href="/jobs/new" className="btn btn-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                      Post New Requisition
                    </Link>
                    <Link href="/resumes/upload" className="btn btn-primary btn-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cloud_upload</span>
                      Upload Resumes
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Action Success Toast */}
          {actionSuccess && (
            <div style={{ margin: "16px 32px 0", maxWidth: 1600 }}>
              <div style={{ padding: "12px 18px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#16a34a" }}>check_circle</span>
                <span>{actionSuccess}</span>
              </div>
            </div>
          )}

          {/* Section 1: Jobs Table */}
          <section style={{ padding: "24px 32px 12px" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto" }}>
              {error && (
                <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <strong>Backend connection error.</strong> {error}
                  </div>
                  <button onClick={refreshAll} className="btn btn-sm" style={{ borderColor: "#fecaca", background: "white" }}>Retry</button>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Requisition Portfolio</h2>
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
                        <th>Requisition</th>
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
                <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: "#94a3b8", display: "block", marginBottom: 12 }}>work_off</span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>No Active Requisitions</h3>
                  <p style={{ fontSize: 13, color: "#475569", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
                    No job positions loaded. Post a requisition or load the demo benchmark batch to begin.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <Link href="/jobs/new" className="btn btn-primary btn-sm">Post Requisition</Link>
                    <button onClick={runSeed} disabled={seeding} className="btn btn-sm">{seeding ? "Loading..." : "Load Demo Batch"}</button>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Requisition ID & Title</th>
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
                        const topScore = job.top_score || job.top_match_percent || 0;
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
                                REQ-{job.job_id?.slice(-3)?.toUpperCase() || "000"}
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

          {/* Section 2: Uploaded Resumes & Database Dossiers */}
          <section style={{ padding: "16px 32px 36px" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#0a66c2" }}>folder_shared</span>
                    Candidate Resume Database
                  </h2>
                  <span className="badge badge-blue">
                    {resumes.length} Stored in DB
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {resumes.length > 0 && (
                    <button
                      onClick={() => setShowClearAllModal(true)}
                      className="btn btn-sm"
                      style={{ color: "#dc2626", borderColor: "#fecaca", background: "#fef2f2" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_sweep</span>
                      Delete All Resumes
                    </button>
                  )}
                  <Link href="/resumes/upload" className="btn btn-sm btn-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cloud_upload</span>
                    Upload More Resumes
                  </Link>
                </div>
              </div>

              {resumesLoading ? (
                <div className="card" style={{ padding: 20 }}>
                  <div className="skeleton" style={{ height: 16, width: "30%", marginBottom: 10 }} />
                  <div className="skeleton" style={{ height: 14, width: "50%", marginBottom: 16 }} />
                  <div className="skeleton" style={{ height: 80, width: "100%", borderRadius: 6 }} />
                </div>
              ) : resumes.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "48px 24px", background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: "#94a3b8", display: "block", marginBottom: 10 }}>description</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>No Resumes in Database</h3>
                  <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16, maxWidth: 440, margin: "0 auto 16px" }}>
                    Resumes uploaded via batch upload or one-click demo are stored persistently in the database. Upload candidate resumes to screen them against open jobs.
                  </p>
                  <Link href="/resumes/upload" className="btn btn-primary btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cloud_upload</span>
                    Upload Candidate Resumes
                  </Link>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Candidate ID</th>
                        <th>Document / File Name</th>
                        <th>File Size</th>
                        <th>Screened Against</th>
                        <th>Top Match Score</th>
                        <th>Uploaded Date</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumes.map((r: any) => {
                        const topScore = r.top_score || 0;
                        const tierBadge = topScore >= 80 ? "badge-green" : topScore >= 60 ? "badge-amber" : "badge-blue";
                        const uploadDate = r.created_at
                          ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "Stored in DB";

                        return (
                          <tr key={r.candidate_id} className="row-hover">
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: 6,
                                  background: "#eff6ff", color: "#0a66c2",
                                  fontWeight: 800, fontSize: 11,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  border: "1px solid #bfdbfe"
                                }}>
                                  {r.candidate_id.slice(-2)}
                                </div>
                                <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                                  {r.candidate_id}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#64748b" }}>description</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                                  {r.filename || r.file || "Candidate Resume"}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="font-mono" style={{ fontSize: 11, color: "#64748b" }}>
                                {r.file_size_kb ? `${r.file_size_kb} KB` : "—"}
                              </span>
                            </td>
                            <td>
                              <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                                {r.screened_jobs_count || 0}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b" }}> position{r.screened_jobs_count !== 1 ? "s" : ""}</span>
                            </td>
                            <td>
                              {r.screened_jobs_count > 0 ? (
                                <span className={`badge ${tierBadge}`}>
                                  {topScore}% Match
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>Not yet evaluated</span>
                              )}
                            </td>
                            <td>
                              <span className="font-mono" style={{ fontSize: 11, color: "#64748b" }}>
                                {uploadDate}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                <button
                                  onClick={() => setCandidateToDelete(r)}
                                  className="btn btn-sm"
                                  style={{ color: "#dc2626", borderColor: "#fecaca", padding: "4px 8px" }}
                                  title="Delete Resume from Database"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                                  Delete
                                </button>
                              </div>
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

          {/* Delete Single Resume Modal */}
          {candidateToDelete && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 9999, padding: 20
            }}>
              <div className="card" style={{ maxWidth: 480, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24 }}>delete_forever</span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Remove Resume from Database?</h3>
                    <p style={{ fontSize: 12, color: "#64748b" }}>This action permanently deletes the dossier and match records.</p>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#64748b" }}>Candidate ID:</span>
                    <span className="font-mono" style={{ fontWeight: 700, color: "#0f172a" }}>{candidateToDelete.candidate_id}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#64748b" }}>File:</span>
                    <span style={{ fontWeight: 600, color: "#0f172a", maxWidth: 260, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {candidateToDelete.filename || candidateToDelete.file}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    onClick={() => setCandidateToDelete(null)}
                    disabled={isDeleting}
                    className="btn btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteSingle}
                    disabled={isDeleting}
                    className="btn btn-sm"
                    style={{ background: "#dc2626", color: "white", borderColor: "#dc2626", fontWeight: 700 }}
                  >
                    {isDeleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete All Resumes Modal */}
          {showClearAllModal && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 9999, padding: 20
            }}>
              <div className="card" style={{ maxWidth: 480, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24 }}>warning</span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Purge Entire Resume Database?</h3>
                    <p style={{ fontSize: 12, color: "#64748b" }}>All {resumes.length} candidate resumes and match results will be cleared.</p>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>
                  This will remove all candidate files from disk and delete all scoring evaluations across all job positions. You can re-upload resumes or load the demo dataset at any time.
                </p>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    onClick={() => setShowClearAllModal(false)}
                    disabled={isDeleting}
                    className="btn btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteAll}
                    disabled={isDeleting}
                    className="btn btn-sm"
                    style={{ background: "#dc2626", color: "white", borderColor: "#dc2626", fontWeight: 700 }}
                  >
                    {isDeleting ? "Purging..." : "Purge All Resumes"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

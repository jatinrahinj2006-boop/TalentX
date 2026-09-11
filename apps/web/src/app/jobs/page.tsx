"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api } from "@/lib/api";

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.jobs();
      setJobs(res.jobs || []);
    } catch (err: any) {
      setError("Failed to load jobs from API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-offset" style={{ flex: 1 }}>
        <TopHeader />
        <main className="page-content">

          {/* Header */}
          <section style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0d9488", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>work</span>
                    Requisition Portfolio Management
                  </div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
                    Job Positions & Requirements
                  </h1>
                  <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                    Active requisitions with automated benchmark weighting matrices and candidate coverage.
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button onClick={fetchJobs} className="btn btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                    Refresh List
                  </button>
                  <Link href="/jobs/new" className="btn btn-primary btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                    Post New Position
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Main Content */}
          <section style={{ padding: "32px" }}>
            <div style={{ maxWidth: 1600, margin: "0 auto" }}>

              {error && (
                <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
                  {error}
                </div>
              )}

              {loading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="card">
                      <div className="skeleton" style={{ height: 20, width: 220, marginBottom: 8 }} />
                      <div className="skeleton" style={{ height: 14, width: 120, marginBottom: 16 }} />
                      <div className="skeleton" style={{ height: 40, borderRadius: 6, marginBottom: 12 }} />
                      <div className="skeleton" style={{ height: 28, width: "100%", borderRadius: 6 }} />
                    </div>
                  ))}
                </div>
              ) : jobs.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 40, color: "#94a3b8", display: "block", marginBottom: 12 }}>
                    work_off
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>No Active Job Positions</h3>
                  <p style={{ fontSize: 13, color: "#475569", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
                    No job requisitions created yet. Create a position or run the demo batch from the dashboard.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <Link href="/jobs/new" className="btn btn-primary btn-sm">Post New Position</Link>
                    <Link href="/" className="btn btn-sm">Go to Dashboard</Link>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 20 }}>
                  {jobs.map((job) => {
                    const count = job.candidate_count || 0;
                    const topScore = job.top_score || job.top_match_percent || 0;
                    const reqSkills = job.required_skills || [];
                    const prefSkills = job.preferred_skills || [];

                    return (
                      <div key={job.job_id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                            <div>
                              <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: "#0d9488", background: "#f0fdfa", border: "1px solid #ccfbf1", padding: "2px 8px", borderRadius: 4 }}>
                                REQ-{job.job_id?.slice(-3)?.toUpperCase() || "000"}
                              </span>
                              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 6, lineHeight: 1.3 }}>
                                {job.title}
                              </h3>
                            </div>
                            <span className="chip-skill">{job.domain || "Engineering"}</span>
                          </div>

                          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
                            Minimum Experience: <strong style={{ color: "#0f172a" }}>{job.minimum_experience_months || 0} months</strong>
                          </p>

                          {/* Skill Chips */}
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                              Required Skills ({reqSkills.length})
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {reqSkills.slice(0, 6).map((s: any) => (
                                <span key={s.name} className="badge badge-blue" style={{ fontSize: 11 }}>
                                  {s.name}
                                </span>
                              ))}
                              {reqSkills.length > 6 && (
                                <span className="font-mono" style={{ fontSize: 10, color: "#64748b", alignSelf: "center" }}>
                                  +{reqSkills.length - 6} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Action */}
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>Screened Candidates</div>
                            <div className="font-mono" style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                              {count} evaluated
                            </div>
                          </div>

                          <Link href={`/jobs/${job.job_id}`} className="btn btn-primary btn-sm">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>join_inner</span>
                            View Candidates ({count})
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

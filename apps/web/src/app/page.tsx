"use client";
// apps/web/src/app/page.tsx — Dashboard
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

const AGENTS = [
  "Resume Agent",
  "Job Agent",
  "Matching Agent",
  "Skill Gap Agent",
  "Recruiter Agent",
];

export default function Dashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [seeding, setSeeding] = useState(false);
  const [agentStep, setAgentStep] = useState(-1);

  const refresh = async () => {
    try {
      const { jobs: j } = await api.jobs();
      setJobs(j || []);
      const { status: s } = await api.screeningStatus();
      setStatus(s || {});
    } catch {}
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const running = Object.values(status).some((s) => s === "running" || s === "pending");
    if (running) {
      const t = setInterval(refresh, 1500);
      return () => clearInterval(t);
    }
  }, [status]);

  const runDemo = async () => {
    setSeeding(true);
    setAgentStep(0);
    try {
      await api.seedDemo();
      // Animate agent checklist
      for (let i = 0; i <= AGENTS.length; i++) {
        await new Promise((r) => setTimeout(r, 900));
        setAgentStep(i);
      }
      await refresh();
    } catch (e) { console.error(e); }
    setSeeding(false);
  };

  const allDone = Object.values(status).every((s) => s === "done");
  const anyRunning = Object.values(status).some((s) => s === "running" || s === "pending");
  const totalCandidates = jobs.reduce((a, j) => a + (j.candidate_count || 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-32">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="muted small mt-8">Multi-agent resume screening pipeline</p>
        </div>
        <button className="btn btn-primary" onClick={runDemo} disabled={seeding}>
          {seeding ? <span className="spin">⟳</span> : "⚡"}{" "}
          {seeding ? "Running Pipeline…" : "Run AI Screening"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-32">
        {[
          { n: jobs.length,        label: "Jobs",           icon: "💼", color: "var(--accent)" },
          { n: 3,                  label: "Resumes Loaded", icon: "📄", color: "var(--purple)" },
          { n: totalCandidates,    label: "Matches Found",  icon: "🎯", color: "var(--green)"  },
          { n: "5",                label: "Active Agents",  icon: "🤖", color: "var(--amber)"  },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div className="stat-number" style={{ color: s.color }}>{s.n}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Agent Pipeline Status */}
        <div className="card">
          <div className="section-title">Agent Pipeline</div>
          <div className="flex-col gap-8">
            {AGENTS.map((name, i) => {
              const done = agentStep > i || (allDone && agentStep === -1 && jobs.length > 0);
              const active = agentStep === i && seeding;
              return (
                <div
                  key={name}
                  className={`agent-step ${done ? "done" : ""} ${active ? "active" : ""}`}
                >
                  <div className="agent-dot" />
                  <span style={{ flex: 1, fontWeight: 500 }}>{name}</span>
                  {done && <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>}
                  {active && <span className="spin" style={{ color: "var(--accent)" }}>⟳</span>}
                </div>
              );
            })}
          </div>
          {anyRunning && (
            <p className="small muted mt-16">Pipeline running… results update automatically.</p>
          )}
          {allDone && jobs.length > 0 && (
            <p className="small mt-16" style={{ color: "var(--green)" }}>
              ✓ All agents completed successfully.
            </p>
          )}
        </div>

        {/* Jobs Summary */}
        <div className="card">
          <div className="section-title">Job Positions</div>
          {jobs.length === 0 ? (
            <div className="upload-zone" onClick={runDemo} style={{ padding: "24px" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
              <p className="fw-600" style={{ color: "var(--accent)" }}>Click "Run AI Screening"</p>
              <p className="small muted mt-8">to load sample data and start the pipeline</p>
            </div>
          ) : (
            <div className="flex-col gap-8">
              {jobs.map((job) => {
                const jStatus = status[job.job_id];
                return (
                  <Link
                    key={job.job_id}
                    href={`/jobs/${job.job_id}`}
                    className="candidate-row"
                    style={{ gridTemplateColumns: "1fr auto" }}
                  >
                    <div>
                      <div className="fw-600">{job.title}</div>
                      <div className="small muted">{job.domain} · {job.minimum_experience_months}m exp required</div>
                    </div>
                    <div className="flex items-center gap-8">
                      {job.candidate_count > 0 && (
                        <span className="badge badge-blue">{job.candidate_count} candidates</span>
                      )}
                      {jStatus === "done" && <span className="badge badge-green">Done</span>}
                      {jStatus === "running" && <span className="badge badge-amber">Running</span>}
                      {jStatus === "pending" && <span className="badge badge-gray">Pending</span>}
                      <span style={{ color: "var(--txt-3)" }}>→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

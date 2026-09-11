"use client";
// apps/web/src/app/jobs/page.tsx — Jobs list
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.jobs().then(({ jobs: j }) => { setJobs(j || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-32">
        <div>
          <h1 className="page-title">Job Positions</h1>
          <p className="muted small mt-8">{jobs.length} open positions</p>
        </div>
        <Link href="/screen" className="btn btn-primary">⚡ Run Screening</Link>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
          <p className="fw-600" style={{ fontSize: 16 }}>No jobs loaded yet</p>
          <p className="small muted mt-8">Run the pipeline from the Dashboard to load sample data.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 20, display: "inline-flex" }}>→ Go to Dashboard</Link>
        </div>
      ) : (
        <div className="flex-col gap-12">
          {jobs.map((job) => (
            <Link key={job.job_id} href={`/jobs/${job.job_id}`} className="card" style={{ display: "block", textDecoration: "none", color: "inherit", cursor: "pointer", transition: "all 0.15s" }}>
              <div className="flex items-center justify-between mb-16">
                <div>
                  <div className="fw-700" style={{ fontSize: 17 }}>{job.title}</div>
                  <div className="small muted mt-4">{job.job_id} · {job.domain}</div>
                </div>
                {job.candidate_count > 0 && (
                  <span className="badge badge-blue">{job.candidate_count} matched</span>
                )}
              </div>
              <div className="skill-chips">
                {(job.required_skills || []).slice(0, 6).map((s: any) => (
                  <span key={s.name} className="chip matched">{s.name}</span>
                ))}
                {(job.preferred_skills || []).slice(0, 4).map((s: any) => (
                  <span key={s.name} className="chip">{s.name}</span>
                ))}
              </div>
              <div className="small muted mt-16">Min experience: {job.minimum_experience_months} months</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

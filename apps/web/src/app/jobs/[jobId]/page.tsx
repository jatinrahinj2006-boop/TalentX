"use client";
// apps/web/src/app/jobs/[jobId]/page.tsx — Ranked Candidates
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

function scoreClass(s: number) {
  if (s >= 75) return "high";
  if (s >= 50) return "mid";
  return "low";
}
function rankClass(r: number) {
  if (r === 1) return "gold";
  if (r === 2) return "silver";
  if (r === 3) return "bronze";
  return "";
}
function recommendation(s: number) {
  if (s >= 80) return { label: "Strong Recommend", cls: "badge-green" };
  if (s >= 65) return { label: "Recommend",        cls: "badge-blue" };
  if (s >= 50) return { label: "Conditional",      cls: "badge-amber" };
  return           { label: "Not Recommended",      cls: "badge-red" };
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [maskPii, setMaskPii] = useState(false);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const load = async () => {
    try {
      const [j, c] = await Promise.all([api.job(jobId), api.candidates(jobId, maskPii)]);
      setJob(j);
      setCandidates(c.candidates || []);
      if (c.status === "running" || c.status === "pending") setPolling(true);
      else setPolling(false);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [jobId, maskPii]);
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [polling, maskPii]);

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-12 mb-8">
        <Link href="/jobs" className="btn btn-ghost" style={{ padding: "6px 12px" }}>← Jobs</Link>
        <div className="flex-col">
          <h1 className="page-title">{job?.title || jobId}</h1>
          <p className="small muted">{job?.domain} · Min {job?.minimum_experience_months}m experience</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-24 mt-24">
        <div className="flex items-center gap-12">
          <span className="badge badge-blue">{candidates.length} Candidates</span>
          {polling && <span className="badge badge-amber spin">⟳ Processing…</span>}
        </div>
        <div
          className="toggle-wrap"
          onClick={() => setMaskPii(!maskPii)}
          title="Toggle PII masking"
        >
          <div className={`toggle ${maskPii ? "on" : ""}`} />
          <span className="small" style={{ color: maskPii ? "var(--accent)" : "var(--txt-2)", userSelect: "none" }}>
            🛡 PII Masked {maskPii ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {/* Required skills strip */}
      {job?.required_skills?.length > 0 && (
        <div className="card card-sm mb-24">
          <div className="label mb-8">Required Skills</div>
          <div className="skill-chips">
            {job.required_skills.map((s: any) => (
              <span key={s.name} className="chip matched">{s.name}</span>
            ))}
            {job.preferred_skills?.map((s: any) => (
              <span key={s.name} className="chip">{s.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Candidate list */}
      {candidates.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 36 }}>⏳</div>
          <p className="fw-600 mt-16">No results yet</p>
          <p className="small muted mt-8">Run the screening pipeline from the Dashboard first.</p>
        </div>
      ) : (
        <div className="flex-col gap-10">
          {candidates.map((c: any) => {
            const rec = recommendation(c.overall_score);
            const sc  = scoreClass(c.overall_score);
            const rc  = rankClass(c.rank);
            const highGaps = (c.skill_gaps || []).filter((g: any) => g.severity === "HIGH");

            return (
              <Link
                key={c.candidate_id}
                href={`/jobs/${jobId}/candidates/${c.candidate_id}${maskPii ? "?mask_pii=true" : ""}`}
                className="candidate-row"
                style={{ gridTemplateColumns: "48px 1fr auto auto" }}
              >
                {/* Rank badge */}
                <div className={`rank-badge ${rc}`}>{c.rank}</div>

                {/* Info */}
                <div>
                  <div className="fw-600">{c.candidate_id}</div>
                  <div className="small muted mt-4">
                    {highGaps.length > 0
                      ? `⚠ ${highGaps.length} critical gap${highGaps.length > 1 ? "s" : ""}: ${highGaps.slice(0,2).map((g: any) => g.skill_name).join(", ")}`
                      : "✓ No critical gaps"}
                  </div>
                  {/* mini score bar */}
                  <div className="progress-bar w-full mt-8" style={{ maxWidth: 200 }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${c.overall_score}%`,
                        background: sc === "high" ? "var(--green)" : sc === "mid" ? "var(--amber)" : "var(--red)",
                      }}
                    />
                  </div>
                </div>

                {/* Score ring */}
                <div
                  className={`score-ring ${sc}`}
                  style={{ "--ring-pct": `${c.overall_score * 3.6}deg` } as any}
                >
                  {c.overall_score}
                </div>

                {/* Recommendation */}
                <span className={`badge ${rec.cls}`}>{rec.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

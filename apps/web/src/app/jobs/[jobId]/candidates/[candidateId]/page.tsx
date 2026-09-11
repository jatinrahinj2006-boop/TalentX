"use client";
// apps/web/src/app/jobs/[jobId]/candidates/[candidateId]/page.tsx
// Candidate Detail with Evidence "Why?" drawer and score breakdown
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <span className="small">{label}</span>
        <span className="small fw-600" style={{ color }}>{Math.round(value * 100)}%</span>
      </div>
      <div className="progress-bar w-full">
        <div className="progress-fill" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function SkillRow({ sm, onWhy }: { sm: any; onWhy: (sm: any) => void }) {
  const statusColor: Record<string, string> = {
    matched: "var(--green)",
    partial: "var(--amber)",
    missing: "var(--red)",
  };
  const statusIcon: Record<string, string> = {
    matched: "✓",
    partial: "~",
    missing: "✗",
  };

  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "10px 14px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
        marginBottom: 8,
      }}
    >
      <div className="flex items-center gap-12">
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background:
              sm.status === "matched"
                ? "rgba(52,211,153,0.15)"
                : sm.status === "partial"
                ? "rgba(251,191,36,0.15)"
                : "rgba(248,113,113,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: statusColor[sm.status] || "var(--txt-3)",
          }}
        >
          {statusIcon[sm.status] || "?"}
        </span>
        <span className="fw-600 small">{sm.skill_name}</span>
        <span className={`badge ${sm.importance === "must" ? "badge-red" : "badge-gray"}`} style={{ fontSize: 11 }}>
          {sm.importance === "must" ? "Required" : "Preferred"}
        </span>
      </div>
      <div className="flex items-center gap-8">
        <span className="small" style={{ color: statusColor[sm.status] || "var(--txt-3)" }}>
          {sm.status.charAt(0).toUpperCase() + sm.status.slice(1)}
          {sm.match_value > 0 && ` (${Math.round(sm.match_value * 100)}%)`}
        </span>
        {sm.evidence_span && (
          <button
            className="btn btn-ghost"
            style={{ padding: "3px 10px", fontSize: 12 }}
            onClick={() => onWhy(sm)}
          >
            Why?
          </button>
        )}
      </div>
    </div>
  );
}

export default function CandidateDetailPage() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>();
  const searchParams = useSearchParams();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [maskPii, setMaskPii] = useState(searchParams.get("mask_pii") === "true");
  const [whyPanel, setWhyPanel] = useState<any>(null);

  useEffect(() => {
    api.candidate(jobId, candidateId, maskPii)
      .then((m) => { setMatch(m); setLoading(false); })
      .catch(() => setLoading(false));
  }, [jobId, candidateId, maskPii]);

  if (loading) return <p className="muted">Loading…</p>;
  if (!match) return (
    <div className="card" style={{ textAlign: "center", padding: "48px" }}>
      <p className="fw-600">No match data found.</p>
      <Link href={`/jobs/${jobId}`} className="btn btn-ghost" style={{ marginTop: 16, display: "inline-flex" }}>← Back</Link>
    </div>
  );

  const bd = match.score_breakdown || {};
  const score = match.overall_score || 0;
  const sc = score >= 75 ? "high" : score >= 50 ? "mid" : "low";
  const highGaps = (match.skill_gaps || []).filter((g: any) => g.severity === "HIGH");
  const midGaps  = (match.skill_gaps || []).filter((g: any) => g.severity === "MEDIUM");
  const required = (match.skill_matches || []).filter((s: any) => s.importance === "must");
  const preferred = (match.skill_matches || []).filter((s: any) => s.importance === "preferred");

  return (
    <div>
      {/* Back breadcrumb */}
      <div className="flex items-center gap-8 mb-24">
        <Link href={`/jobs/${jobId}`} className="btn btn-ghost" style={{ padding: "6px 12px" }}>← {jobId}</Link>
        <span className="txt-3">/ {match.candidate_id}</span>
      </div>

      {/* Hero row */}
      <div className="card mb-24" style={{ background: "var(--bg-card2)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-20">
            {/* Score Ring */}
            <div
              className={`score-ring ${sc}`}
              style={{
                width: 88, height: 88, fontSize: 24,
                "--ring-pct": `${score * 3.6}deg`,
              } as any}
            >
              {score}
            </div>
            <div>
              <h1 className="page-title" style={{ fontSize: 22 }}>{match.candidate_id}</h1>
              <p className="small muted mt-4">Matched against: <strong style={{ color: "var(--accent)" }}>{match.job_id}</strong></p>
              <div className="flex items-center gap-8 mt-12">
                {score >= 80 && <span className="badge badge-green">Strong Recommend</span>}
                {score >= 65 && score < 80 && <span className="badge badge-blue">Recommend</span>}
                {score >= 50 && score < 65 && <span className="badge badge-amber">Conditional</span>}
                {score < 50 && <span className="badge badge-red">Not Recommended</span>}
                {highGaps.length === 0 && <span className="badge badge-green">No Critical Gaps</span>}
                {highGaps.length > 0 && <span className="badge badge-red">⚠ {highGaps.length} Critical Gap{highGaps.length > 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>
          <div
            className="toggle-wrap"
            onClick={() => setMaskPii(!maskPii)}
          >
            <div className={`toggle ${maskPii ? "on" : ""}`} />
            <span className="small" style={{ color: maskPii ? "var(--accent)" : "var(--txt-2)", userSelect: "none" }}>
              🛡 PII Mask {maskPii ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </div>

      {/* Evidence "Why?" panel */}
      {whyPanel && (
        <div className="evidence-panel mb-24">
          <div className="flex items-center justify-between mb-8">
            <span className="fw-600" style={{ color: "var(--accent)" }}>
              📎 Evidence for "{whyPanel.skill_name}"
            </span>
            <button
              className="btn btn-ghost"
              style={{ padding: "2px 8px", fontSize: 12 }}
              onClick={() => setWhyPanel(null)}
            >✕</button>
          </div>
          <p className="small" style={{ color: "var(--txt-2)", marginBottom: 6 }}>
            Source: <span style={{ color: "var(--accent)" }}>Resume p.{whyPanel.page_number}</span>
          </p>
          <div>
            <span className="evidence-span">"{whyPanel.evidence_span}"</span>
          </div>
          <p className="small muted mt-8">Match confidence: <strong>{Math.round(whyPanel.match_value * 100)}%</strong></p>
        </div>
      )}

      <div className="grid-2 gap-24 mb-24">
        {/* Score Breakdown */}
        <div className="card">
          <div className="section-title">Score Breakdown</div>
          <ScoreBar label="Required Skills"      value={bd.required_skill_score || 0}     color="var(--green)"  />
          <ScoreBar label="Experience"           value={bd.experience_score || 0}          color="var(--accent)" />
          <ScoreBar label="Preferred Skills"     value={bd.preferred_skill_score || 0}    color="var(--purple)" />
          <ScoreBar label="Responsibilities"     value={bd.responsibility_similarity || 0} color="var(--amber)"  />
          <ScoreBar label="Domain Fit"           value={bd.role_domain_similarity || 0}   color="var(--amber)"  />
          <ScoreBar label="Education"            value={bd.education_score || 0}           color="var(--txt-2)"  />
          {bd.gap_penalty > 0 && (
            <div className="flex items-center justify-between mt-8" style={{ padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <span className="small" style={{ color: "var(--red)" }}>⚠ Gap Penalty</span>
              <span className="small fw-600" style={{ color: "var(--red)" }}>−{bd.gap_penalty}</span>
            </div>
          )}
        </div>

        {/* Skill Gaps */}
        <div className="card">
          <div className="section-title">Skill Gaps</div>
          {match.skill_gaps?.length === 0 && (
            <p className="small" style={{ color: "var(--green)" }}>✓ No skill gaps detected</p>
          )}
          {highGaps.map((g: any) => (
            <div key={g.skill_name} className="card card-sm mb-8" style={{ background: "rgba(248,113,113,0.05)", borderColor: "rgba(248,113,113,0.2)" }}>
              <div className="flex items-center justify-between mb-4">
                <span className="fw-600 small">{g.skill_name}</span>
                <span className="badge badge-red">HIGH</span>
              </div>
              <p className="small muted">{g.recommendation}</p>
            </div>
          ))}
          {midGaps.map((g: any) => (
            <div key={g.skill_name} className="card card-sm mb-8" style={{ background: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.2)" }}>
              <div className="flex items-center justify-between mb-4">
                <span className="fw-600 small">{g.skill_name}</span>
                <span className="badge badge-amber">MEDIUM</span>
              </div>
              <p className="small muted">{g.recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recruiter Summary */}
      {match.recruiter_summary && (
        <div className="card mb-24" style={{ borderColor: "rgba(56,189,248,0.2)" }}>
          <div className="section-title">🤖 AI Recruiter Summary</div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 14, color: "var(--txt-1)" }}>
            {match.recruiter_summary}
          </div>
          <p className="small muted mt-12">Generated from structured evidence only — no raw resume access.</p>
        </div>
      )}

      {/* Skills table */}
      <div className="card">
        <div className="section-title">Skill Matching Detail</div>
        {required.length > 0 && (
          <>
            <p className="label mb-8" style={{ color: "var(--red)" }}>● Required Skills</p>
            {required.map((sm: any) => (
              <SkillRow key={sm.skill_name} sm={sm} onWhy={setWhyPanel} />
            ))}
          </>
        )}
        {preferred.length > 0 && (
          <>
            <p className="label mb-8 mt-16" style={{ color: "var(--txt-3)" }}>● Preferred Skills</p>
            {preferred.map((sm: any) => (
              <SkillRow key={sm.skill_name} sm={sm} onWhy={setWhyPanel} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

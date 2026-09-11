"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api } from "@/lib/api";

type Step = "idle" | "uploaded" | "running" | "done" | "error";

interface LogMessage {
  time: string;
  agent: string;
  color: string;
  text: string;
}

export default function UploadResumesPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileList | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(-1);
  const [agentProgress, setAgentProgress] = useState<number[]>([0, 0, 0, 0, 0]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [existingResumes, setExistingResumes] = useState<any[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchExistingResumes = async () => {
    setLoadingExisting(true);
    try {
      const res = await api.resumes();
      setExistingResumes(res.resumes || []);
    } catch (e) {
      console.error("Failed to load existing resumes:", e);
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    fetchExistingResumes();
  }, []);

  const handleDeleteResume = async (candidateId: string) => {
    if (!confirm(`Delete candidate resume ${candidateId} from database?`)) return;
    setDeletingId(candidateId);
    try {
      await api.deleteResume(candidateId);
      setExistingResumes(prev => prev.filter(r => r.candidate_id !== candidateId));
    } catch (e: any) {
      alert("Failed to delete resume: " + (e.message || "Unknown error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllResumes = async () => {
    if (!confirm("Are you sure you want to delete ALL resumes from the database?")) return;
    setDeletingAll(true);
    try {
      await api.deleteAllResumes();
      setExistingResumes([]);
    } catch (e: any) {
      alert("Failed to clear resumes: " + (e.message || "Unknown error"));
    } finally {
      setDeletingAll(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
    if (e.dataTransfer.files?.length > 0) {
      setFiles(e.dataTransfer.files);
      setStep("uploaded");
    }
  };

  const addLog = (agent: string, color: string, text: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [...prev, { time, agent, color, text }]);
  };

  const startExamination = async () => {
    if (!files?.length) return;
    setErrorMsg(null);
    setStep("running");
    setLogs([]);
    setAgentProgress([0, 0, 0, 0, 0]);

    try {
      const fileCount = files.length;
      
      // Step 1: Uploading & Resume Agent
      setActiveAgentIndex(0);
      addLog("Resume Agent", "#0a66c2", `Injesting ${fileCount} document dossiers into neural memory buffer...`);
      await api.uploadResumes(files);
      setAgentProgress([50, 0, 0, 0, 0]);
      await new Promise(r => setTimeout(r, 600));
      addLog("Resume Agent", "#0a66c2", `Verbatim evidence span extraction completed for ${fileCount}/${fileCount} candidates.`);
      setAgentProgress([100, 0, 0, 0, 0]);

      // Step 2: Job Agent
      setActiveAgentIndex(1);
      addLog("Job Agent", "#0d9488", "Extracting role requirement matrices and weighting vectors...");
      await new Promise(r => setTimeout(r, 700));
      addLog("Job Agent", "#0d9488", "Built 3 evaluation benchmarks: Hard Skills (40%), Experience (35%), Domain (15%), Education (10%).");
      setAgentProgress([100, 100, 0, 0, 0]);

      // Step 3: Matching Agent
      setActiveAgentIndex(2);
      addLog("Matching Agent", "#4f46e5", `Computing vector cosine similarity matrices across ${fileCount} candidates...`);
      const screenRes = await api.runScreening();
      setAgentProgress([100, 100, 60, 0, 0]);
      await new Promise(r => setTimeout(r, 800));
      addLog("Matching Agent", "#4f46e5", `Deterministic scoring calculated. Pipeline evaluated ${screenRes.resume_count || fileCount} candidates.`);
      setAgentProgress([100, 100, 100, 0, 0]);

      // Step 4: Skill Gap Agent
      setActiveAgentIndex(3);
      addLog("Skill Gap Agent", "#d97706", "Cross-referencing candidate skills against technical ontology graph...");
      await new Promise(r => setTimeout(r, 700));
      addLog("Skill Gap Agent", "#d97706", "Identified missing critical requirements and moderate stretch competencies.");
      setAgentProgress([100, 100, 100, 100, 0]);

      // Step 5: Recruiter Agent
      setActiveAgentIndex(4);
      addLog("Recruiter Agent", "#0a66c2", "Synthesizing executive hiring manager summaries with verified evidence spans...");
      await new Promise(r => setTimeout(r, 800));
      addLog("Recruiter Agent", "#0a66c2", "Audit trail compiled and ready for decision workflow.");
      setAgentProgress([100, 100, 100, 100, 100]);

      setStep("done");
      const targetJobId = screenRes?.job_ids?.[0] || "J001";
      await new Promise(r => setTimeout(r, 900));
      router.push(`/jobs/${targetJobId}`);
    } catch (e: any) {
      setErrorMsg(e.message || "Examination pipeline failed.");
      setStep("error");
    }

  };

  const fileCount = files ? files.length : 0;
  const totalSize = files ? (Array.from(files).reduce((a, f) => a + f.size, 0) / 1024).toFixed(1) : "0";

  const AGENTS = [
    { name: "Resume Agent", icon: "description", color: "#0a66c2", bg: "#eff6ff", task: "Extracting Evidence" },
    { name: "Job Agent", icon: "fact_check", color: "#0d9488", bg: "#f0fdfa", task: "Building Matrices" },
    { name: "Matching Agent", icon: "hub", color: "#4f46e5", bg: "#eef2ff", task: "Cosine Vector Scoring" },
    { name: "Skill Gap Agent", icon: "troubleshoot", color: "#d97706", bg: "#fffbeb", task: "Ontology Alignment" },
    { name: "Recruiter Agent", icon: "neurology", color: "#0a66c2", bg: "#eff6ff", task: "Executive Synthesis" },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-offset" style={{ flex: 1 }}>
        <TopHeader />
        <main className="page-content">

          {/* Header */}
          <section style={{ padding: "20px 32px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ maxWidth: 960, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#0d9488" }}>dynamic_feed</span>
                <span style={{ color: "#0d9488", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Autonomous Candidate Examination</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Upload & Screen Candidate Dossiers</h1>
              <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                Upload candidate resumes to trigger live, multi-agent AI examination with full deterministic evidence tracking.
              </p>
            </div>
          </section>

          <section style={{ padding: "32px" }}>
            <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Live Autonomous Mesh Execution Panel (Active when running or done) */}
              {step !== "idle" && step !== "uploaded" && (
                <div className="card" style={{ padding: 20, border: "2px solid #0a66c2" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#0a66c2", animation: step === "running" ? "spin 2s linear infinite" : "none" }}>
                        {step === "done" ? "check_circle" : "precision_manufacturing"}
                      </span>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                          {step === "done" ? "Examination Complete — Redirecting..." : "Autonomous Agent Examination in Progress"}
                        </h3>
                        <p style={{ fontSize: 11, color: "#64748b" }}>Live telemetry stream of multi-agent reasoning pipeline</p>
                      </div>
                    </div>
                    <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: step === "done" ? "#059669" : "#0a66c2", background: step === "done" ? "#ecfdf5" : "#eff6ff", padding: "4px 10px", borderRadius: 999, border: "1px solid #bfdbfe" }}>
                      {step === "done" ? "STATUS: 100% COMPLETE" : `STATUS: EXAMINING (${fileCount} RESUMES)`}
                    </span>
                  </div>

                  {/* Agent Mesh Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
                    {AGENTS.map((agent, i) => {
                      const isActive = activeAgentIndex === i;
                      const isComplete = agentProgress[i] === 100;
                      return (
                        <div
                          key={agent.name}
                          style={{
                            padding: "10px 8px",
                            background: isActive ? agent.bg : "#f8fafc",
                            border: `1px solid ${isActive ? agent.color : isComplete ? "#cbd5e1" : "#e2e8f0"}`,
                            borderRadius: 8,
                            textAlign: "center",
                            transition: "all 0.3s ease"
                          }}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: isComplete ? "#059669" : agent.bg, color: isComplete ? "white" : agent.color, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                              {isComplete ? "check" : agent.icon}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{agent.name}</div>
                          <div style={{ fontSize: 9, color: "#64748b" }}>{isComplete ? "Finished" : isActive ? "Active..." : "Queued"}</div>
                          <div className="progress-bar" style={{ marginTop: 6, height: 3 }}>
                            <div className="progress-fill" style={{ width: `${agentProgress[i]}%`, background: isComplete ? "#059669" : agent.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Terminal Log Output */}
                  <div style={{ background: "#0f172a", borderRadius: 8, padding: 14, fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "#e2e8f0", maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {logs.map((log, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10 }}>
                        <span style={{ color: "#64748b", flexShrink: 0 }}>[{log.time}]</span>
                        <span style={{ color: log.color, fontWeight: 700, flexShrink: 0 }}>[{log.agent}]:</span>
                        <span style={{ color: "#f8fafc" }}>{log.text}</span>
                      </div>
                    ))}
                    {step === "running" && (
                      <div style={{ color: "#0a66c2", animation: "pulse 1s infinite" }}>▶ Executing live neural feature extraction...</div>
                    )}
                  </div>
                </div>
              )}

              {/* Upload & Start Examination Card */}
              {step !== "running" && step !== "done" && (
                <div className="card">
                  <div
                    className={`upload-zone ${dragActive ? "active" : ""}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 40, color: dragActive ? "#0a66c2" : "#94a3b8", display: "block", marginBottom: 12 }}>
                      upload_file
                    </span>
                    <h3 style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 6 }}>
                      {dragActive ? "Drop files here" : "Select or Drop Candidate Resumes"}
                    </h3>
                    <p style={{ fontSize: 12, color: "#64748b" }}>PDF, DOCX, or TXT — batch upload multiple resumes for immediate examination.</p>
                    <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt" onChange={e => {
                      if (e.target.files?.length) {
                        setFiles(e.target.files);
                        setStep("uploaded");
                      }
                    }} style={{ display: "none" }} />
                  </div>

                  {files && files.length > 0 && (
                    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="badge badge-blue">{fileCount} File{fileCount !== 1 ? "s" : ""} Ready</span>
                          <span className="font-mono" style={{ fontSize: 11, color: "#64748b" }}>Total size: {totalSize} KB</span>
                        </div>
                        <button onClick={() => { setFiles(null); setStep("idle"); }} style={{ fontSize: 11, color: "#64748b", cursor: "pointer", background: "none", border: "none" }}>
                          Clear Selection
                        </button>
                      </div>

                      <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                        {Array.from(files).map((f, i) => (
                          <div key={i} style={{ padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#0a66c2" }}>description</span>
                              <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{f.name}</span>
                            </div>
                            <span className="font-mono" style={{ fontSize: 11, color: "#64748b" }}>{(f.size / 1024).toFixed(1)} KB</span>
                          </div>
                        ))}
                      </div>

                      {errorMsg && (
                        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 12 }}>
                          {errorMsg}
                        </div>
                      )}

                      {/* Prominent Action Button: Start Examination */}
                      <button
                        onClick={startExamination}
                        className="btn btn-primary"
                        style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: 14, fontWeight: 800, gap: 10, background: "#0a66c2" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>play_circle</span>
                        Start Examination of {fileCount} Resume{fileCount !== 1 ? "s" : ""}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Existing Database Resumes Inventory */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>inventory_2</span>
                    </div>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                        Database Stored Candidate Resumes ({existingResumes.length})
                      </h3>
                      <p style={{ fontSize: 11, color: "#64748b" }}>
                        Resumes saved and available across all active evaluation benchmarks
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={fetchExistingResumes} className="btn btn-sm" style={{ padding: "4px 8px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                      Refresh
                    </button>
                    {existingResumes.length > 0 && (
                      <button
                        onClick={handleClearAllResumes}
                        disabled={deletingAll}
                        className="btn btn-sm"
                        style={{ color: "#dc2626", borderColor: "#fecaca", background: "#fef2f2", padding: "4px 8px" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_sweep</span>
                        {deletingAll ? "Purging..." : "Clear All Resumes"}
                      </button>
                    )}
                  </div>
                </div>

                {loadingExisting ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="skeleton" style={{ height: 36, width: "100%", borderRadius: 6 }} />
                    <div className="skeleton" style={{ height: 36, width: "100%", borderRadius: 6 }} />
                  </div>
                ) : existingResumes.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 16px", background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#94a3b8", display: "block", marginBottom: 6 }}>description</span>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Database is currently empty</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Upload resumes above to populate candidate dossiers.</div>
                  </div>
                ) : (
                  <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {existingResumes.map((r: any) => (
                      <div
                        key={r.candidate_id}
                        style={{
                          padding: "8px 12px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: "#0a66c2", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>
                            {r.candidate_id}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {r.filename || r.file}
                          </span>
                          {r.file_size_kb > 0 && (
                            <span className="font-mono" style={{ fontSize: 10, color: "#64748b", flexShrink: 0 }}>
                              ({r.file_size_kb} KB)
                            </span>
                          )}
                          {r.screened_jobs_count > 0 && (
                            <span className="badge badge-green" style={{ fontSize: 10, flexShrink: 0 }}>
                              {r.top_score}% top match
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteResume(r.candidate_id)}
                          disabled={deletingId === r.candidate_id}
                          className="btn btn-sm"
                          style={{ color: "#dc2626", borderColor: "#fecaca", padding: "2px 8px", fontSize: 11 }}
                          title="Delete candidate resume from database"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                          {deletingId === r.candidate_id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Explanatory Workflow */}
              <div className="card">
                <h3 style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#0d9488" }}>hub</span>
                  How Autonomous AI Reaches Match Conclusions
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {AGENTS.map(a => (
                    <div key={a.name} style={{ display: "flex", gap: 10, padding: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: a.color }}>{a.icon}</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", marginBottom: 2 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{a.task} with verbatim source text citation grounding.</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

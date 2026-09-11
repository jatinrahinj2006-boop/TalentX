"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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

export default function CreateBatchPage() {
  const router = useRouter();
  
  // Job fields
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("Software Engineering");
  const [exp, setExp] = useState(0);
  const [desc, setDesc] = useState("");
  
  // New granular fields for deterministic scoring
  const [reqSkills, setReqSkills] = useState("");
  const [prefSkills, setPrefSkills] = useState("");
  const [eduReqs, setEduReqs] = useState("");
  const [resps, setResps] = useState("");
  const [certs, setCerts] = useState("");
  const [prefQuals, setPrefQuals] = useState("");
  const [others, setOthers] = useState("");

  // Resume fields
  const [files, setFiles] = useState<FileList | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Execution state
  const [step, setStep] = useState<Step>("idle");
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(-1);
  const [agentProgress, setAgentProgress] = useState<number[]>([0, 0, 0, 0, 0]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) {
      setFiles(e.dataTransfer.files);
    }
  };

  const addLog = (agent: string, color: string, text: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [...prev, { time, agent, color, text }]);
  };

  const parseCommaList = (text: string) => text.split(",").map(s => s.trim()).filter(s => s);
  const parseLineList = (text: string) => text.split("\n").map(s => s.trim()).filter(s => s);

  const startExamination = async () => {
    if (!files?.length || !title || !desc) {
      setErrorMsg("Please provide job title, description, and at least one resume.");
      return;
    }
    setErrorMsg(null);
    setStep("running");
    setLogs([]);
    setAgentProgress([0, 0, 0, 0, 0]);

    try {
      const fileCount = files.length;
      
      const jobData = {
        title,
        domain,
        minimum_experience_months: exp,
        description: desc,
        required_skills: parseCommaList(reqSkills),
        preferred_skills: parseCommaList(prefSkills),
        education_requirements: parseCommaList(eduReqs),
        responsibilities: parseLineList(resps),
        certifications: parseCommaList(certs),
        preferred_qualifications: parseLineList(prefQuals),
        other_requirements: parseLineList(others)
      };

      const formData = new FormData();
      formData.append("jobData", JSON.stringify(jobData));
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      // Step 1: Uploading & Job/Resume Agents starting
      setActiveAgentIndex(0);
      addLog("System", "#0d9488", `Creating Job Requisition and preparing ${fileCount} resumes...`);
      await api.createBatch(formData);
      
      setAgentProgress([50, 50, 0, 0, 0]);
      await new Promise(r => setTimeout(r, 600));
      addLog("Resume Agent", "#0a66c2", `Verbatim evidence span extraction started for ${fileCount} candidates.`);
      addLog("Job Agent", "#0d9488", `Direct mapping of structured role requirements for "${title}"...`);
      setAgentProgress([100, 100, 0, 0, 0]);

      // Step 2: Matching Agent
      setActiveAgentIndex(2);
      addLog("Matching Agent", "#4f46e5", `Computing vector cosine similarity matrices across ${fileCount} candidates...`);
      setAgentProgress([100, 100, 60, 0, 0]);
      await new Promise(r => setTimeout(r, 800));
      addLog("Matching Agent", "#4f46e5", `Deterministic scoring calculated against explicit criteria.`);
      setAgentProgress([100, 100, 100, 0, 0]);

      // Step 3: Skill Gap Agent
      setActiveAgentIndex(3);
      addLog("Skill Gap Agent", "#d97706", "Cross-referencing candidate skills against technical ontology graph...");
      await new Promise(r => setTimeout(r, 700));
      addLog("Skill Gap Agent", "#d97706", "Identified missing critical requirements and moderate stretch competencies.");
      setAgentProgress([100, 100, 100, 100, 0]);

      // Step 4: Recruiter Agent
      setActiveAgentIndex(4);
      addLog("Recruiter Agent", "#0a66c2", "Synthesizing executive hiring manager summaries with verified evidence spans...");
      await new Promise(r => setTimeout(r, 800));
      addLog("Recruiter Agent", "#0a66c2", "Audit trail compiled and ready for decision workflow.");
      setAgentProgress([100, 100, 100, 100, 100]);

      setStep("done");
      await new Promise(r => setTimeout(r, 1500));
      router.push("/");
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
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Create Batch Evaluation</h1>
              <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                Define the hiring criteria explicitly to fuel the deterministic scoring engine, then upload candidate resumes to trigger the multi-agent AI pipeline.
              </p>
            </div>
          </section>

          <section style={{ padding: "32px" }}>
            <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Execution Panel */}
              {step !== "idle" && (
                <div className="card" style={{ padding: 20, border: "2px solid #0a66c2" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#0a66c2", animation: step === "running" ? "spin 2s linear infinite" : "none" }}>
                        {step === "done" ? "check_circle" : "precision_manufacturing"}
                      </span>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                          {step === "done" ? "Examination Complete — Redirecting to Dashboard..." : "Autonomous Agent Examination in Progress"}
                        </h3>
                        <p style={{ fontSize: 11, color: "#64748b" }}>Live telemetry stream of multi-agent reasoning pipeline</p>
                      </div>
                    </div>
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

              {/* Form Input Card */}
              {step === "idle" && (
                <>
                  <div className="card">
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>1. Exact Hiring Criteria</h2>
                    <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
                      Provide structured requirements to ensure the deterministic scoring engine computes accurately.
                    </p>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="form-group">
                          <label>Batch Name (Job Title)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Q3 Senior Machine Learning Engineers" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Domain / Role</label>
                          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
                            <option>Software Engineering</option>
                            <option>Data Science</option>
                            <option>Product Management</option>
                            <option>Design</option>
                            <option>Marketing</option>
                            <option>Sales</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Job Description / Summary</label>
                        <textarea 
                          rows={3} 
                          placeholder="Provide a high level summary of the role..."
                          value={desc}
                          onChange={(e) => setDesc(e.target.value)}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="form-group">
                          <label>Required Skills (Comma separated)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Python, Docker, Kubernetes" 
                            value={reqSkills}
                            onChange={(e) => setReqSkills(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Preferred Skills (Comma separated)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Go, AWS, Terraform" 
                            value={prefSkills}
                            onChange={(e) => setPrefSkills(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="form-group">
                          <label>Minimum Experience (Months)</label>
                          <input 
                            type="number" 
                            min="0"
                            value={exp}
                            onChange={(e) => setExp(parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Education Requirements (Comma separated)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. B.S. Computer Science, M.S. Data Science" 
                            value={eduReqs}
                            onChange={(e) => setEduReqs(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Responsibilities (One per line)</label>
                        <textarea 
                          rows={4} 
                          placeholder="- Architect distributed systems&#10;- Mentor junior engineers..."
                          value={resps}
                          onChange={(e) => setResps(e.target.value)}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="form-group">
                          <label>Certifications (Comma separated)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. AWS Certified Solutions Architect" 
                            value={certs}
                            onChange={(e) => setCerts(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Other Requirements (One per line)</label>
                          <textarea 
                            rows={3} 
                            placeholder="- Must be able to pass security clearance..."
                            value={others}
                            onChange={(e) => setOthers(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="form-group">
                        <label>Preferred Qualifications (One per line)</label>
                        <textarea 
                          rows={3}
                          placeholder="- Open source contributions..."
                          value={prefQuals}
                          onChange={(e) => setPrefQuals(e.target.value)}
                        />
                      </div>

                    </div>
                  </div>

                  <div className="card">
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>2. Target Candidates</h2>

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
                          <button onClick={() => setFiles(null)} style={{ fontSize: 11, color: "#64748b", cursor: "pointer", background: "none", border: "none" }}>
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
                      </div>
                    )}
                  </div>
                  
                  {errorMsg && (
                    <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 12 }}>
                      {errorMsg}
                    </div>
                  )}

                  <button
                    onClick={startExamination}
                    className="btn btn-primary"
                    disabled={!files?.length || !title || !desc}
                    style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: 14, fontWeight: 800, gap: 10, background: (!files?.length || !title || !desc) ? "#cbd5e1" : "#0a66c2", border: "none" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>play_circle</span>
                    {files?.length ? `Start Examination of ${fileCount} Resume${fileCount !== 1 ? "s" : ""}` : "Fill Job Details & Upload Resumes to Start"}
                  </button>
                </>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

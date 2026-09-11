// apps/web/src/app/resumes/upload/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api, Job } from "@/lib/api";

type Step = "idle" | "running" | "done" | "error";

interface LogMessage {
  time: string;
  agent: string;
  color: string;
  text: string;
}

const DOMAIN_OPTIONS = [
  "Software Engineering",
  "Data Science & Machine Learning",
  "DevOps & Cloud Infrastructure",
  "Full Stack Web Development",
  "Frontend Engineering",
  "Backend Systems",
  "Product Management",
  "Cybersecurity & Systems",
  "Artificial Intelligence / NLP",
];

export default function BatchEvaluationPage() {
  const router = useRouter();

  // Form criteria state
  const [formData, setFormData] = useState({
    title: "",
    domain: "Software Engineering",
    description: "",
    required_skills: "",
    preferred_skills: "",
    minimum_experience_months: 0,
    education_requirements: "",
    responsibilities: "",
    certifications: "",
    other_requirements: "",
    preferred_qualifications: "",
  });

  // Files & Pipeline state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(-1);
  const [agentProgress, setAgentProgress] = useState<number[]>([0, 0, 0, 0, 0]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  // Existing jobs for auto-fill option
  const [existingJobs, setExistingJobs] = useState<Job[]>([]);

  // Existing resumes in DB
  const [existingResumes, setExistingResumes] = useState<any[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load existing jobs and resumes
    api.jobs()
      .then((res) => setExistingJobs(res.jobs || []))
      .catch((err) => console.error("Could not fetch jobs:", err));

    fetchExistingResumes();
  }, []);

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

  const handleSelectExistingJob = (jobId: string) => {
    const found = existingJobs.find((j) => j.job_id === jobId);
    if (!found) return;

    setFormData({
      title: found.title || "",
      domain: found.domain || "Software Engineering",
      description: found.description || "",
      required_skills: (found.required_skills || []).map((s) => s.name).join(", "),
      preferred_skills: (found.preferred_skills || []).map((s) => s.name).join(", "),
      minimum_experience_months: found.minimum_experience_months || 0,
      education_requirements: (found.education_requirements || []).join(", "),
      responsibilities: (found.responsibilities || []).map((r) => `- ${r}`).join("\n"),
      certifications: (found.certifications || []).join(", "),
      other_requirements: (found.other_requirements || []).map((o) => `- ${o}`).join("\n"),
      preferred_qualifications: (found.preferred_qualifications || []).map((p) => `- ${p}`).join("\n"),
    });
  };

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setSelectedFiles((prev) => {
      // deduplicate by filename
      const existingNames = new Set(prev.map((f) => f.name));
      const filtered = newFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAllSelected = () => {
    setSelectedFiles([]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const addLog = (agent: string, color: string, text: string) => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, { time, agent, color, text }]);
  };

  const parseCommaList = (str: string) =>
    str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const parseLinesList = (str: string) =>
    str
      .split("\n")
      .map((s) => s.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);

  const isFormValid = formData.title.trim().length > 0 && selectedFiles.length > 0;

  const startExamination = async () => {
    if (!isFormValid) return;
    setErrorMsg(null);
    setStep("running");
    setLogs([]);
    setAgentProgress([0, 0, 0, 0, 0]);

    try {
      const fileCount = selectedFiles.length;

      // Step 1: Uploading Resumes & Resume Agent
      setActiveAgentIndex(0);
      addLog("Resume Agent", "#0a66c2", `Injesting ${fileCount} document dossiers into neural memory buffer...`);
      await api.uploadResumes(selectedFiles);
      setAgentProgress([50, 0, 0, 0, 0]);
      await new Promise((r) => setTimeout(r, 500));
      addLog("Resume Agent", "#0a66c2", `Verbatim evidence span extraction completed for ${fileCount}/${fileCount} candidates.`);
      setAgentProgress([100, 0, 0, 0, 0]);

      // Step 2: Create Requisition / Job Agent
      setActiveAgentIndex(1);
      addLog("Job Agent", "#0d9488", `Creating position matrix for '${formData.title}'...`);
      const jobRes = await api.createJobText({
        title: formData.title,
        domain: formData.domain || "Software Engineering",
        description: formData.description,
        minimum_experience_months: Number(formData.minimum_experience_months) || 0,
        required_skills: parseCommaList(formData.required_skills),
        preferred_skills: parseCommaList(formData.preferred_skills),
        education_requirements: parseCommaList(formData.education_requirements),
        responsibilities: parseLinesList(formData.responsibilities),
        certifications: parseCommaList(formData.certifications),
        other_requirements: parseLinesList(formData.other_requirements),
        preferred_qualifications: parseLinesList(formData.preferred_qualifications),
      });

      const newJobId = jobRes.job?.job_id || "J001";
      setCreatedJobId(newJobId);
      await new Promise((r) => setTimeout(r, 600));
      addLog("Job Agent", "#0d9488", `Built structured role matrix (${newJobId}) with required & preferred competencies.`);
      setAgentProgress([100, 100, 0, 0, 0]);

      // Step 3: Matching Agent
      setActiveAgentIndex(2);
      addLog("Matching Agent", "#4f46e5", `Computing vector cosine similarity matrices across candidate pool...`);
      const screenRes = await api.runScreening([newJobId]);
      setAgentProgress([100, 100, 60, 0, 0]);
      await new Promise((r) => setTimeout(r, 700));
      addLog(
        "Matching Agent",
        "#4f46e5",
        `Deterministic scoring calculated. Evaluated candidates with isolated scoring engine.`
      );
      setAgentProgress([100, 100, 100, 0, 0]);

      // Step 4: Skill Gap Agent
      setActiveAgentIndex(3);
      addLog("Skill Gap Agent", "#d97706", "Cross-referencing candidate skills against technical ontology graph...");
      await new Promise((r) => setTimeout(r, 600));
      addLog("Skill Gap Agent", "#d97706", "Identified missing critical requirements and categorized gap severity.");
      setAgentProgress([100, 100, 100, 100, 0]);

      // Step 5: Recruiter Agent
      setActiveAgentIndex(4);
      addLog("Recruiter Agent", "#0a66c2", "Synthesizing executive hiring manager summaries with verified evidence spans...");
      await new Promise((r) => setTimeout(r, 700));
      addLog("Recruiter Agent", "#0a66c2", "Audit trail compiled and ready for decision workflow.");
      setAgentProgress([100, 100, 100, 100, 100]);

      setStep("done");
      // Refresh resume database list in background
      fetchExistingResumes();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Examination pipeline failed.");
      setStep("error");
    }
  };

  const handleDeleteResume = async (candidateId: string) => {
    if (!confirm(`Delete candidate resume ${candidateId} from database?`)) return;
    setDeletingId(candidateId);
    try {
      await api.deleteResume(candidateId);
      setExistingResumes((prev) => prev.filter((r) => r.candidate_id !== candidateId));
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

  const AGENTS = [
    { name: "Resume Agent", icon: "description", color: "#0a66c2", bg: "#eff6ff", task: "Extracting Evidence" },
    { name: "Job Agent", icon: "fact_check", color: "#0d9488", bg: "#f0fdfa", task: "Building Position Matrix" },
    { name: "Matching Agent", icon: "hub", color: "#4f46e5", bg: "#eef2ff", task: "Vector Cosine Scoring" },
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
          <section style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ maxWidth: 920, margin: "0 auto" }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                Create Batch Evaluation
              </h1>
              <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                Define the hiring criteria explicitly to fuel the deterministic scoring engine, then upload candidate resumes to trigger the multi-agent AI pipeline.
              </p>
            </div>
          </section>

          <section style={{ padding: "32px 24px" }}>
            <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
              
              {/* Optional Quick Pre-fill Dropdown */}
              {existingJobs.length > 0 && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "12px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#475569", fontWeight: 600 }}>
                    💡 Tip: Auto-fill criteria from an existing requisition:
                  </span>
                  <select
                    onChange={(e) => handleSelectExistingJob(e.target.value)}
                    defaultValue=""
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "white",
                      fontSize: 12,
                      color: "#0f172a",
                      cursor: "pointer",
                      maxWidth: 320,
                    }}
                  >
                    <option value="" disabled>
                      Select an existing requisition...
                    </option>
                    {existingJobs.map((j) => (
                      <option key={j.job_id} value={j.job_id}>
                        {j.job_id} — {j.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 1. Exact Hiring Criteria Card */}
              <div
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 28,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                    1. Exact Hiring Criteria
                  </h2>
                  <p style={{ fontSize: 12, color: "#64748b" }}>
                    Provide structured requirements to ensure the deterministic scoring engine computes accurately.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Row 1: Batch Name & Domain */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      Batch Name (Job Title)*
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          fontSize: 13,
                          color: "#0f172a",
                          outline: "none",
                        }}
                        placeholder="e.g. Q3 Senior Machine Learning Engineers"
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      Domain / Role
                      <select
                        value={formData.domain}
                        onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          fontSize: 13,
                          color: "#0f172a",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        {DOMAIN_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Row 2: Job Description / Summary */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                    Job Description / Summary
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "white",
                        fontSize: 13,
                        color: "#0f172a",
                        minHeight: 88,
                        resize: "vertical",
                        outline: "none",
                        lineHeight: 1.5,
                      }}
                      placeholder="Provide a high level summary of the role..."
                    />
                  </label>

                  {/* Row 3: Required Skills & Preferred Skills */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      Required Skills (Comma separated)
                      <input
                        type="text"
                        value={formData.required_skills}
                        onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          fontSize: 13,
                          color: "#0f172a",
                          outline: "none",
                        }}
                        placeholder="e.g. Python, Docker, Kubernetes"
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      Preferred Skills (Comma separated)
                      <input
                        type="text"
                        value={formData.preferred_skills}
                        onChange={(e) => setFormData({ ...formData, preferred_skills: e.target.value })}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          fontSize: 13,
                          color: "#0f172a",
                          outline: "none",
                        }}
                        placeholder="e.g. Go, AWS, Terraform"
                      />
                    </label>
                  </div>

                  {/* Row 4: Minimum Experience & Education Requirements */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      Minimum Experience (Months)
                      <input
                        type="number"
                        min={0}
                        value={formData.minimum_experience_months}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            minimum_experience_months: parseInt(e.target.value) || 0,
                          })
                        }
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          fontSize: 13,
                          color: "#0f172a",
                          outline: "none",
                        }}
                        placeholder="0"
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      Education Requirements (Comma separated)
                      <input
                        type="text"
                        value={formData.education_requirements}
                        onChange={(e) => setFormData({ ...formData, education_requirements: e.target.value })}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          fontSize: 13,
                          color: "#0f172a",
                          outline: "none",
                        }}
                        placeholder="e.g. B.S. Computer Science, M.S. Data Science"
                      />
                    </label>
                  </div>

                  {/* Row 5: Responsibilities */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                    Responsibilities (One per line)
                    <textarea
                      value={formData.responsibilities}
                      onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "white",
                        fontSize: 13,
                        color: "#0f172a",
                        minHeight: 88,
                        resize: "vertical",
                        outline: "none",
                        lineHeight: 1.5,
                      }}
                      placeholder="- Architect distributed systems&#10;- Mentor junior engineers..."
                    />
                  </label>

                  {/* Row 6: Certifications & Other Requirements */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      Certifications (Comma separated)
                      <input
                        type="text"
                        value={formData.certifications}
                        onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          fontSize: 13,
                          color: "#0f172a",
                          outline: "none",
                        }}
                        placeholder="e.g. AWS Certified Solutions Architect"
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      Other Requirements (One per line)
                      <textarea
                        value={formData.other_requirements}
                        onChange={(e) => setFormData({ ...formData, other_requirements: e.target.value })}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          fontSize: 13,
                          color: "#0f172a",
                          minHeight: 70,
                          resize: "vertical",
                          outline: "none",
                          lineHeight: 1.5,
                        }}
                        placeholder="- Must be able to pass security clearance..."
                      />
                    </label>
                  </div>

                  {/* Row 7: Preferred Qualifications */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                    Preferred Qualifications (One per line)
                    <textarea
                      value={formData.preferred_qualifications}
                      onChange={(e) => setFormData({ ...formData, preferred_qualifications: e.target.value })}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "white",
                        fontSize: 13,
                        color: "#0f172a",
                        minHeight: 70,
                        resize: "vertical",
                        outline: "none",
                        lineHeight: 1.5,
                      }}
                      placeholder="- Open source contributions..."
                    />
                  </label>
                </div>
              </div>

              {/* 2. Target Candidates Card */}
              <div
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 28,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                    2. Target Candidates
                  </h2>
                </div>

                {/* Dropzone */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  style={{
                    padding: "36px 20px",
                    border: dragActive ? "2px dashed #0a66c2" : "2px dashed #cbd5e1",
                    borderRadius: 10,
                    background: dragActive ? "#eff6ff" : "#f8fafc",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => handleFilesAdded(e.target.files)}
                    style={{ display: "none" }}
                  />
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "#e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 12px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 26, color: "#64748b" }}>
                      file_upload
                    </span>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                    Select or Drop Candidate Resumes
                  </h3>
                  <p style={{ fontSize: 12, color: "#64748b" }}>
                    PDF, DOCX, or TXT — batch upload multiple resumes for immediate examination.
                  </p>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                        Selected Resumes ({selectedFiles.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleClearAllSelected}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Clear all
                      </button>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 160, overflowY: "auto" }}>
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: "#f1f5f9",
                            border: "1px solid #e2e8f0",
                            fontSize: 12,
                            color: "#334155",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#0a66c2" }}>
                            description
                          </span>
                          <span
                            style={{
                              maxWidth: 160,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontWeight: 500,
                            }}
                          >
                            {file.name}
                          </span>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>
                            ({(file.size / 1024).toFixed(0)} KB)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(idx);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#94a3b8",
                              display: "flex",
                              alignItems: "center",
                              padding: 0,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                              close
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button matching Image 1 */}
              <div>
                <button
                  type="button"
                  disabled={!isFormValid || step === "running"}
                  onClick={startExamination}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "16px 24px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 800,
                    border: "none",
                    cursor: !isFormValid || step === "running" ? "not-allowed" : "pointer",
                    background:
                      !isFormValid || step === "running"
                        ? "#e2e8f0"
                        : "linear-gradient(135deg, #0a66c2 0%, #004182 100%)",
                    color: !isFormValid || step === "running" ? "#94a3b8" : "#ffffff",
                    boxShadow: isFormValid && step !== "running" ? "0 4px 12px rgba(10, 102, 194, 0.25)" : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {step === "running" ? "sync" : "play_circle"}
                  </span>
                  {!isFormValid
                    ? "Fill Job Details & Upload Resumes to Start"
                    : step === "running"
                    ? "Running Autonomous Multi-Agent Screening..."
                    : "Start Autonomous Examination"}
                </button>
              </div>

              {/* Live Mesh Execution Panel (when running or done) */}
              {(step === "running" || step === "done" || step === "error") && (
                <div
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 24,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 18,
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: 14,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 22,
                          color: step === "done" ? "#059669" : step === "error" ? "#dc2626" : "#0a66c2",
                        }}
                      >
                        {step === "done" ? "check_circle" : step === "error" ? "error" : "smart_toy"}
                      </span>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                          {step === "done"
                            ? "Evaluation Pipeline Completed"
                            : step === "error"
                            ? "Examination Encountered Error"
                            : "Autonomous Mesh Screening in Progress"}
                        </h3>
                        <p style={{ fontSize: 12, color: "#64748b" }}>
                          Role: <strong style={{ color: "#0f172a" }}>{formData.title}</strong> • Candidates:{" "}
                          <strong style={{ color: "#0f172a" }}>{selectedFiles.length}</strong>
                        </p>
                      </div>
                    </div>

                    {step === "done" && createdJobId && (
                      <Link
                        href={`/jobs/${createdJobId}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#0a66c2",
                          color: "white",
                          padding: "8px 16px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        <span>View Ranked Candidates</span>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          arrow_forward
                        </span>
                      </Link>
                    )}
                  </div>

                  {errorMsg && (
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 8,
                        color: "#b91c1c",
                        fontSize: 13,
                        marginBottom: 16,
                      }}
                    >
                      {errorMsg}
                    </div>
                  )}

                  {/* 5-Agent Status Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
                    {AGENTS.map((agent, i) => {
                      const prog = agentProgress[i];
                      const isActive = activeAgentIndex === i && step === "running";
                      const isComplete = prog === 100;
                      return (
                        <div
                          key={agent.name}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: isActive ? agent.bg : isComplete ? "#f8fafc" : "#fafafa",
                            border: isActive
                              ? `1.5px solid ${agent.color}`
                              : isComplete
                              ? "1px solid #e2e8f0"
                              : "1px dashed #e2e8f0",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 16, color: isComplete ? "#059669" : agent.color }}
                            >
                              {isComplete ? "check_circle" : agent.icon}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
                              {agent.name.split(" ")[0]}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>{agent.task}</div>
                          <div style={{ height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${prog}%`,
                                background: isComplete ? "#059669" : agent.color,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Real-time Agent Log Stream */}
                  <div
                    style={{
                      background: "#0f172a",
                      color: "#e2e8f0",
                      borderRadius: 8,
                      padding: "12px 16px",
                      fontFamily: "monospace",
                      fontSize: 11,
                      maxHeight: 180,
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {logs.length === 0 ? (
                      <span style={{ color: "#64748b" }}>Waiting for pipeline initialization...</span>
                    ) : (
                      logs.map((l, i) => (
                        <div key={i} style={{ display: "flex", gap: 8 }}>
                          <span style={{ color: "#64748b" }}>[{l.time}]</span>
                          <span style={{ color: l.color, fontWeight: 600 }}>{l.agent}:</span>
                          <span>{l.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Candidate Resume Database Repository (Below Batch Form) */}
              <div
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: "#0a66c2", fontSize: 20 }}>
                      folder_shared
                    </span>
                    <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                      Resume Repository ({existingResumes.length} Candidate Dossiers in Memory)
                    </h2>
                  </div>

                  {existingResumes.length > 0 && (
                    <button
                      type="button"
                      disabled={deletingAll}
                      onClick={handleClearAllResumes}
                      style={{
                        background: "none",
                        border: "1px solid #fecaca",
                        color: "#dc2626",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: deletingAll ? "not-allowed" : "pointer",
                      }}
                    >
                      {deletingAll ? "Purging..." : "Clear All Resumes"}
                    </button>
                  )}
                </div>

                {loadingExisting ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    Loading resumes...
                  </div>
                ) : existingResumes.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    No resumes in database yet. Drop candidate resumes above to start screening.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "left" }}>
                          <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 700 }}>Candidate</th>
                          <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 700 }}>ID</th>
                          <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 700 }}>Filename</th>
                          <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 700 }}>Size</th>
                          <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 700 }}>Screened Jobs</th>
                          <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 700 }}>Top Score</th>
                          <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 700, textAlign: "right" }}>
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {existingResumes.map((r) => (
                          <tr key={r.candidate_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0f172a" }}>
                              {r.candidate_name || r.name || r.candidate_id}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#64748b", fontFamily: "monospace" }}>
                              {r.candidate_id}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#475569" }}>{r.filename || r.file}</td>
                            <td style={{ padding: "10px 14px", color: "#64748b" }}>
                              {r.file_size_kb ? `${r.file_size_kb} KB` : "—"}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#0a66c2", fontWeight: 600 }}>
                              {r.screened_jobs_count || 0}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: r.top_score >= 80 ? "#059669" : r.top_score >= 60 ? "#d97706" : "#475569",
                                }}
                              >
                                {r.top_score ? `${r.top_score}%` : "—"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right" }}>
                              <button
                                type="button"
                                disabled={deletingId === r.candidate_id}
                                onClick={() => handleDeleteResume(r.candidate_id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#dc2626",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {deletingId === r.candidate_id ? "..." : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

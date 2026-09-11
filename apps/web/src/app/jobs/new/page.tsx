// apps/web/src/app/jobs/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api } from "@/lib/api";

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

export default function PostJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (file) {
        await api.uploadJob(file);
      } else {
        await api.createJobText({
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
      }
      router.push("/jobs");
    } catch (err: any) {
      console.error(err);
      alert("Failed to post job: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-offset" style={{ flex: 1 }}>
        <TopHeader />
        <main className="page-content">
          {/* Header */}
          <section style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ maxWidth: 880, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#0d9488" }}>
                  fact_check
                </span>
                <span style={{ color: "#0d9488", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Job Requisition Setup
                </span>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                Post a New Job Requisition
              </h1>
              <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                Create a position matrix by uploading a Job Description file or entering details manually.
              </p>
            </div>
          </section>

          <section style={{ padding: "32px 24px" }}>
            <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* JD Upload Dropzone */}
                <div
                  style={{
                    padding: 24,
                    border: "2px dashed #cbd5e1",
                    borderRadius: 12,
                    background: "#f8fafc",
                    textAlign: "center",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: "#0a66c2", marginBottom: 8 }}>
                    upload_file
                  </span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                    Upload Job Description File (PDF/TXT/DOCX)
                  </h3>
                  <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
                    The Job Agent will automatically extract required skills and weighting matrix.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.txt,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 12 }}
                  />
                  {file && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#059669" }}>
                        check_circle
                      </span>
                      <p style={{ fontSize: 12, color: "#0a66c2", fontWeight: 700 }}>Selected: {file.name}</p>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          fontSize: 12,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
                  — OR ENTER REQUISITION DETAILS MANUALLY —
                </div>

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
                    {/* Row 1: Title & Domain */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                        Batch Name (Job Title)*
                        <input
                          required={!file}
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

                    {/* Row 5: Responsibilities (One per line) */}
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

                    {/* Row 7: Preferred Qualifications (One per line) */}
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

                <button
                  type="submit"
                  disabled={loading || (!file && !formData.title.trim())}
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    padding: "14px",
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 10,
                    cursor: loading || (!file && !formData.title.trim()) ? "not-allowed" : "pointer",
                    opacity: loading || (!file && !formData.title.trim()) ? 0.7 : 1,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {loading ? "sync" : "publish"}
                  </span>
                  {loading ? "Publishing Job Requisition..." : "Publish Job Requisition"}
                </button>
              </form>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

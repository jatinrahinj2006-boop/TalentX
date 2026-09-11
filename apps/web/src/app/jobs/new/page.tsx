// apps/web/src/app/jobs/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import { api } from "@/lib/api";

export default function PostJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    domain: "",
    minimum_experience_months: 0,
    description: "",
  });

  const [file, setFile] = useState<File | null>(null);

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
          minimum_experience_months: formData.minimum_experience_months || 0,
          description: formData.description,
        });
      }
      router.push("/");
    } catch (err) {
      console.error(err);
      alert("Failed to post job");
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
          <section style={{ padding: "20px 32px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#0d9488" }}>fact_check</span>
                <span style={{ color: "#0d9488", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Job Requisition Setup</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Post a New Job Requisition</h1>
              <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                Create a position matrix by uploading a Job Description file or entering details manually.
              </p>
            </div>
          </section>

          <section style={{ padding: "32px" }}>
            <div className="card" style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                
                {/* JD Upload Dropzone */}
                <div style={{ padding: 20, border: "2px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc", textAlign: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#0a66c2", marginBottom: 8 }}>upload_file</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Upload Job Description File (PDF/TXT/DOCX)</h3>
                  <p style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>The Job Agent will automatically extract required skills and weighting matrix.</p>
                  <input 
                    type="file" 
                    accept=".pdf,.txt,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 12 }}
                  />
                  {file && <p style={{ fontSize: 12, color: "#0a66c2", fontWeight: 700, marginTop: 8 }}>Selected: {file.name}</p>}
                </div>

                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>— OR ENTER REQUISITION DETAILS MANUALLY —</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                    Job Title*
                    <input 
                      required={!file}
                      type="text" 
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", fontSize: 13, color: "#0f172a" }}
                      placeholder="e.g. Senior Machine Learning Engineer"
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                    Domain
                    <input 
                      type="text" 
                      value={formData.domain}
                      onChange={(e) => setFormData({...formData, domain: e.target.value})}
                      style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", fontSize: 13, color: "#0f172a" }}
                      placeholder="e.g. Artificial Intelligence"
                    />
                  </label>
                </div>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                  Minimum Experience (Months)
                  <input 
                    type="number" 
                    value={formData.minimum_experience_months}
                    onChange={(e) => setFormData({...formData, minimum_experience_months: parseInt(e.target.value) || 0})}
                    style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", fontSize: 13, color: "#0f172a" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                  Job Description Text*
                  <textarea 
                    required={!file}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", fontSize: 13, color: "#0f172a", minHeight: 160, resize: "vertical" }}
                    placeholder="Paste the full job description text..."
                  />
                </label>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 14, fontWeight: 700 }}
                >
                  {loading ? "Building Position Matrix..." : "Publish Job Requisition"}
                </button>
              </form>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}


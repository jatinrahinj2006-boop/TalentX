// apps/web/src/app/jobs/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      router.push("/jobs");
    } catch (err) {
      console.error(err);
      alert("Failed to post job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-layout fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Post a New Job</h1>
          <p className="page-sub">Create a job by filling out the details or uploading a JD file.</p>
        </div>
      </header>

      <div className="card" style={{ maxWidth: 800 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          <div style={{ padding: "1rem", border: "1px dashed var(--border)", borderRadius: "12px", background: "var(--bg-elevated)" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>Upload Job Description (PDF/TXT)</h3>
            <input 
              type="file" 
              accept=".pdf,.txt,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ color: "var(--txt-1)" }}
            />
            {file && <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", marginTop: "0.5rem" }}>Selected: {file.name}</p>}
          </div>

          <div style={{ textAlign: "center", color: "var(--txt-3)" }}>— OR Enter Details Manually —</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--txt-2)" }}>
              Job Title*
              <input 
                required={!file}
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--txt-1)" }}
                placeholder="e.g. Senior Frontend Engineer"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--txt-2)" }}>
              Domain
              <input 
                type="text" 
                value={formData.domain}
                onChange={(e) => setFormData({...formData, domain: e.target.value})}
                style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--txt-1)" }}
                placeholder="e.g. Software Engineering"
              />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--txt-2)" }}>
            Minimum Experience (Months)
            <input 
              type="number" 
              value={formData.minimum_experience_months}
              onChange={(e) => setFormData({...formData, minimum_experience_months: parseInt(e.target.value) || 0})}
              style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--txt-1)" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--txt-2)" }}>
            Job Description*
            <textarea 
              required={!file}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--txt-1)", minHeight: "200px", resize: "vertical" }}
              placeholder="Paste the full job description here..."
            />
          </label>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              padding: "1rem", 
              background: "var(--color-primary)", 
              color: "white", 
              border: "none", 
              borderRadius: "8px", 
              fontWeight: 600, 
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              marginTop: "1rem"
            }}
          >
            {loading ? "Processing..." : "Post Job"}
          </button>
        </form>
      </div>
    </div>
  );
}

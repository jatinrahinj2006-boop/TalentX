// apps/web/src/app/resumes/upload/page.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function UploadResumesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      setFiles(e.target.files);
    }
  };

  const handleUpload = async () => {
    if (!files) return;
    setLoading(true);
    try {
      await api.uploadResumes(files);
      alert(`${files.length} resumes uploaded successfully!`);
      router.push("/");
    } catch (err) {
      console.error(err);
      alert("Failed to upload resumes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-layout fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Upload Candidate Resumes</h1>
          <p className="page-sub">Add resumes to the system for AI screening.</p>
        </div>
      </header>

      <div className="card" style={{ maxWidth: 800 }}>
        <div 
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? "var(--color-primary)" : "var(--border)"}`,
            borderRadius: "16px",
            padding: "4rem 2rem",
            textAlign: "center",
            background: dragActive ? "rgba(11, 214, 161, 0.05)" : "var(--bg-elevated)",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📥</div>
          <h3 style={{ marginBottom: "0.5rem" }}>Drag & Drop Resumes Here</h3>
          <p style={{ color: "var(--txt-3)" }}>or click to browse files (PDF, DOCX, TXT)</p>
          <input 
            ref={inputRef}
            type="file" 
            multiple
            accept=".pdf,.docx,.txt"
            onChange={handleChange}
            style={{ display: "none" }}
          />
        </div>

        {files && files.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h4>Selected Files ({files.length}):</h4>
            <ul style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--txt-2)" }}>
              {Array.from(files).map((f, i) => (
                <li key={i} style={{ padding: "0.75rem", background: "var(--bg-base)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  {f.name} <span style={{ color: "var(--txt-3)", fontSize: "0.85rem" }}>({(f.size / 1024).toFixed(1)} KB)</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={handleUpload}
              disabled={loading}
              style={{ 
                width: "100%",
                padding: "1rem", 
                background: "var(--color-primary)", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                fontWeight: 600, 
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                marginTop: "1.5rem"
              }}
            >
              {loading ? "Uploading..." : `Upload ${files.length} Resumes`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// apps/web/src/components/OutreachModal.tsx
"use client";

import { useState } from "react";

interface ContactDetail {
  value: string;
  evidence_span?: string;
  page_number?: number;
}

interface ContactInfo {
  email?: ContactDetail;
  phone?: ContactDetail;
  linkedin_url?: ContactDetail;
  github_url?: ContactDetail;
  portfolio_url?: ContactDetail;
}

interface OutreachModalProps {
  jobId: string;
  candidateId: string;
  candidateName?: string;
  initialSubject: string;
  initialBody: string;
  contactInfo?: ContactInfo;
  onClose: () => void;
}

export default function OutreachModal({
  jobId,
  candidateId,
  candidateName = "Candidate",
  initialSubject,
  initialBody,
  contactInfo,
  onClose,
}: OutreachModalProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [copied, setCopied] = useState(false);

  const emailVal = contactInfo?.email?.value || "";
  const phoneVal = contactInfo?.phone?.value || "";
  const linkedinVal = contactInfo?.linkedin_url?.value || "";
  const githubVal = contactInfo?.github_url?.value || "";

  const handleOpenMail = () => {
    const mailto = `mailto:${encodeURIComponent(emailVal)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_self");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`To: ${emailVal}\nSubject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        className="card fade-in"
        style={{
          width: "100%",
          maxWidth: 680,
          background: "white",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          padding: 24,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Modal Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a66c2", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
              Evidence-Grounded Candidate Outreach
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
              Draft Email for {candidateName} ({candidateId})
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-sm" style={{ border: "none", background: "#f1f5f9", cursor: "pointer" }}>
            ✕
          </button>
        </div>

        {/* Extracted Contact Info Panel with Evidence Spans */}
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            Extracted Socials & Contact Credentials
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* Email */}
            <div style={{ fontSize: 12 }}>
              <div style={{ color: "#64748b", fontSize: 11 }}>Email Address:</div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>{emailVal || "Not found on resume"}</div>
              {contactInfo?.email?.evidence_span && (
                <div className="font-mono" style={{ fontSize: 10, color: "#0a66c2", marginTop: 2 }}>
                  [Page {contactInfo.email.page_number || 1}] "{contactInfo.email.evidence_span.slice(0, 50)}..."
                </div>
              )}
            </div>

            {/* Phone */}
            <div style={{ fontSize: 12 }}>
              <div style={{ color: "#64748b", fontSize: 11 }}>Phone Number:</div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>{phoneVal || "Not found"}</div>
            </div>

            {/* LinkedIn */}
            {linkedinVal && (
              <div style={{ fontSize: 12 }}>
                <div style={{ color: "#64748b", fontSize: 11 }}>LinkedIn:</div>
                <a href={linkedinVal} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "#0a66c2", textDecoration: "none" }}>
                  {linkedinVal}
                </a>
              </div>
            )}

            {/* GitHub */}
            {githubVal && (
              <div style={{ fontSize: 12 }}>
                <div style={{ color: "#64748b", fontSize: 11 }}>GitHub:</div>
                <a href={githubVal} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "#0a66c2", textDecoration: "none" }}>
                  {githubVal}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Editable Form Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "#334155" }}>
            Subject Line
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                fontWeight: 600,
                color: "#0f172a",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "#334155" }}>
            Email Body (Editable)
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              style={{
                padding: "12px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                color: "#0f172a",
                lineHeight: 1.5,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </label>
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button onClick={handleCopy} className="btn btn-sm" style={{ background: "#f1f5f9", borderColor: "#cbd5e1" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} className="btn btn-sm">Cancel</button>
            <button
              onClick={handleOpenMail}
              className="btn btn-primary"
              style={{ background: "#0a66c2", padding: "10px 20px", fontWeight: 700 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
              Open in Mail Client
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

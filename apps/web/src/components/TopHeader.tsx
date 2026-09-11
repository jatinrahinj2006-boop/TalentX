// apps/web/src/components/TopHeader.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TopHeaderProps {
  maskPii?: boolean;
  onToggleMaskPii?: () => void;
}

export default function TopHeader({ maskPii, onToggleMaskPii }: TopHeaderProps) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDarkMode(true);
    }
  };

  return (
    <header className="top-header">
      {/* Search + Agent Live */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, maxWidth: 640 }}>
        <div className="search-bar">
          <span className="material-symbols-outlined search-icon">search</span>
          <input placeholder="Search candidates, skills, requisitions (Cmd+K)..." />
        </div>
        <div className="agents-live-pill">
          <span className="ping-dot" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, color: "#134e4a", fontSize: 11 }}>5 Agents Live:</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Resume, Job, Matching, Skill Gap, Recruiter</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="header-actions">
        {/* Dark Mode Toggle Button */}
        <button
          onClick={toggleDarkMode}
          className="btn-icon"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{ gap: 6, padding: "6px 10px", fontSize: 12, fontWeight: 600 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: darkMode ? "#f59e0b" : "#64748b" }}>
            {darkMode ? "light_mode" : "dark_mode"}
          </span>
          <span>{darkMode ? "Light" : "Dark"}</span>
        </button>

        {onToggleMaskPii && (
          <div
            className={`toggle-wrap`}
            onClick={onToggleMaskPii}
            title="Anonymize candidate PII for bias-free evaluation"
            style={{ gap: 8 }}
          >
            <div className={`toggle ${maskPii ? "on" : ""}`} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>Mask Identity</div>
              <div style={{ fontSize: 10, color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                {maskPii ? "PII HIDDEN" : "PII VISIBLE"}
              </div>
            </div>
          </div>
        )}

        <Link href="/resumes/upload" className="btn btn-primary btn-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cloud_upload</span>
          Batch Run
        </Link>

        <button className="btn-icon" title="Notifications" style={{ position: "relative" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--text-subtle)" }}>notifications</span>
          <span style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: "50%", background: "#0d9488", border: "2px solid white" }} />
        </button>

        <div style={{ width: 1, height: 24, background: "var(--border-subtle)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #0a66c2, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13, color: "#fff",
            border: "2px solid var(--border-subtle)",
            flexShrink: 0,
          }}>
            R
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>Recruiter</span>
            <span style={{ fontSize: 10, color: "var(--text-subtle)", fontWeight: 500 }}>Lead Talent Partner</span>
          </div>
        </div>
      </div>
    </header>
  );
}


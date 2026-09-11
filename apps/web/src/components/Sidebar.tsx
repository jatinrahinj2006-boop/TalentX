// apps/web/src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { icon: "smart_toy",     label: "Batch Results",       href: "/" },
  { icon: "dynamic_feed",  label: "Create Batch",        href: "/batches/new" },
  { icon: "badge",         label: "Candidate Bench",     href: "/candidates" },
  { icon: "account_tree",  label: "Skill Ontologies",    href: "/ontologies" },
  { icon: "terminal",      label: "Explainability Logs", href: "/logs" },
];

export default function Sidebar() {
  const path = usePathname();

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <aside className="sidebar">
      <div className="sidebar-body">
        {/* Brand header */}
        <div className="sidebar-brand">
          <div className="brand-logomark">T</div>
          <div>
            <div className="brand-name">
              TalentX
              <span className="brand-badge">AI</span>
            </div>
            <div className="brand-sub">Enterprise Recruiter</div>
          </div>
        </div>

        {/* Mesh status pill */}
        <div className="mesh-pill">
          <div className="mesh-pill-label">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hub</span>
            TalentX Mesh
          </div>
          <span className="ping-dot" />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navLinks.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-link ${isActive(n.href) ? "active" : ""}`}
            >
              <span className="material-symbols-outlined nav-icon" style={{ fontSize: 18 }}>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <nav style={{ marginBottom: 4 }}>
          <Link href="/settings" className="nav-link" style={{ fontSize: 12 }}>
            <span className="material-symbols-outlined nav-icon" style={{ fontSize: 16 }}>tune</span>
            System Settings
          </Link>
        </nav>
        <div className="sidebar-footer-meta">
          <span>CLUSTER: <strong className="font-mono" style={{ color: "#334155" }}>SYN-904</strong></span>
          <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, color: "#0d9488", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 4, padding: "2px 6px" }}>v4.8-ea</span>
        </div>
      </div>
    </aside>
  );
}

// apps/web/src/components/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "⚡", label: "Dashboard",  href: "/" },
  { icon: "💼", label: "Jobs",       href: "/jobs" },
  { icon: "➕", label: "Post Job",   href: "/jobs/new" },
  { icon: "📤", label: "Upload Resumes", href: "/resumes/upload" },
  { icon: "👥", label: "Candidates", href: "/candidates" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">T</div>
        <div>
          <div className="logo-text">TalentX</div>
          <div className="logo-sub">AI Screening</div>
        </div>
      </div>
      {navItems.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`nav-item ${path === n.href || (n.href !== "/" && path.startsWith(n.href)) ? "active" : ""}`}
        >
          <span className="nav-icon">{n.icon}</span>
          {n.label}
        </Link>
      ))}
      <div style={{ flexGrow: 1 }} />
      <div className="nav-item" style={{ fontSize: 12, color: "var(--txt-3)", cursor: "default" }}>
        <span className="nav-icon">🛡</span>
        PII Guard Active
      </div>
    </aside>
  );
}

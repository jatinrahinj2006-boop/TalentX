// apps/web/src/components/TopBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TopBarProps {
  maskPii?: boolean;
  onToggleMaskPii?: () => void;
  breadcrumbs?: { label: string; href?: string }[];
}

export default function TopBar({ maskPii, onToggleMaskPii, breadcrumbs }: TopBarProps) {
  const pathname = usePathname();

  // Generate fallback breadcrumbs if not explicitly provided
  const pathSegments = pathname.split("/").filter(Boolean);
  const autoBreadcrumbs = breadcrumbs || [
    { label: "Dashboard", href: "/" },
    ...pathSegments.map((segment, index) => {
      const href = "/" + pathSegments.slice(0, index + 1).join("/");
      let label = segment;
      if (segment === "jobs") label = "Jobs";
      else if (segment === "resumes") label = "Resumes";
      else if (segment === "upload") label = "Upload Batch";
      else if (segment === "compare") label = "Candidate Comparison";
      return { label, href };
    }),
  ];

  return (
    <header className="w-full border-b border-[var(--color-hairline)] bg-[#FFFFFF] px-6 py-3 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Brand Wordmark & Breadcrumbs */}
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 pr-4 border-r border-[var(--color-hairline)]">
          <span className="font-sans font-bold text-base tracking-tight text-[var(--color-ink)]">
            TalentX
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-hairline)] text-[var(--color-muted)] bg-[var(--color-paper)]">
            AUDIT v1.0
          </span>
        </Link>

        <nav className="flex items-center gap-2 text-xs font-sans text-[var(--color-muted)]">
          {autoBreadcrumbs.map((crumb, idx) => {
            const isLast = idx === autoBreadcrumbs.length - 1;
            return (
              <div key={idx} className="flex items-center gap-2">
                {idx > 0 && <span className="text-[var(--color-hairline)]">/</span>}
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} className="hover:text-[var(--color-ink)] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? "font-semibold text-[var(--color-ink)]" : ""}>
                    {crumb.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Right: Actions & Fairness PII Toggle */}
      <div className="flex items-center gap-4">
        {onToggleMaskPii !== undefined && (
          <div 
            onClick={onToggleMaskPii}
            className="toggle-control py-1 px-2.5 rounded border border-[var(--color-hairline)] bg-[var(--color-paper)] hover:bg-[#EAEBE6] transition-colors"
            title="Mask personally identifiable information (Name, Gender, Photo) to avoid evaluation bias"
          >
            <div className={`toggle-switch ${maskPii ? "active" : ""}`} />
            <div className="flex flex-col text-left">
              <span className="font-sans text-[11px] font-semibold leading-tight text-[var(--color-ink)]">
                Mask Candidate Identity
              </span>
              <span className="font-mono text-[9px] leading-tight text-[var(--color-muted)]">
                {maskPii ? "PII HIDDEN (ANONYMIZED)" : "PII VISIBLE"}
              </span>
            </div>
          </div>
        )}

        <Link href="/resumes/upload" className="btn btn-sm">
          <span>Upload Resumes</span>
        </Link>
      </div>
    </header>
  );
}

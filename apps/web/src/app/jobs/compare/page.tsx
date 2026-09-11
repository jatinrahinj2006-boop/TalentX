// apps/web/src/app/jobs/compare/page.tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CandidateComparisonView from "@/components/CandidateComparisonView";

function CompareContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || searchParams.get("job_id") || "";
  const c1Id = searchParams.get("c1") || "";
  const c2Id = searchParams.get("c2") || "";
  const maskPii = searchParams.get("mask_pii") === "true";

  return (
    <CandidateComparisonView
      initialJobId={jobId}
      initialC1Id={c1Id}
      initialC2Id={c2Id}
      initialMaskPii={maskPii}
    />
  );
}

export default function GlobalComparePage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Loading Comparison Matrix...</div>}>
      <CompareContent />
    </Suspense>
  );
}

// apps/web/src/lib/api.ts

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = `HTTP error ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") {
        errorMessage = data.detail;
      } else if (data.message) {
        errorMessage = data.message;
      } else {
        errorMessage = JSON.stringify(data);
      }
    } catch {
      const text = await res.text().catch(() => "");
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  return res.json() as Promise<T>;
}

export interface SkillItem {
  name: string;
  category?: string;
  weight?: number;
  importance?: string;
}

export interface JobCreateInput {
  title: string;
  description?: string;
  domain?: string;
  minimum_experience_months?: number;
  required_skills?: string[];
  preferred_skills?: string[];
  education_requirements?: string[];
  responsibilities?: string[];
  certifications?: string[];
  other_requirements?: string[];
  preferred_qualifications?: string[];
}

export interface Job {
  job_id: string;
  title: string;
  domain?: string;
  minimum_experience_months?: number;
  required_skills?: SkillItem[];
  preferred_skills?: SkillItem[];
  education_requirements?: string[];
  responsibilities?: string[];
  certifications?: string[];
  other_requirements?: string[];
  preferred_qualifications?: string[];
  description?: string;
  file_path?: string;
  candidate_count?: number;
  top_score?: number;
  top_match_percent?: number;
}

export interface ResumeItem {
  candidate_id: string;
  candidate_name?: string;
  name?: string;
  filename?: string;
  file?: string;
  file_path?: string;
  file_size_kb?: number;
  created_at?: string;
  screened_jobs_count?: number;
  top_score?: number;
}

export interface ScoreBreakdown {
  required_skill_score?: number;
  preferred_skill_score?: number;
  experience_score?: number;
  responsibility_similarity?: number;
  role_domain_similarity?: number;
  education_score?: number;
  project_relevance?: number;
  certification_relevance?: number;
  gap_penalty?: number;
  semantic_score?: number;
  penalties?: number;
}

export interface EvidenceItem {
  claim_type?: string;
  claim_text?: string;
  evidence_span?: string;
  page_number?: number;
  confidence?: number;
}

export interface SkillMatch {
  skill_name?: string;
  skill?: string;
  importance?: "must" | "preferred" | string;
  status?: "matched" | "partial" | "missing" | string;
  match_value?: number;
  category?: string;
  evidence_span?: string;
  page_number?: number;
  confidence?: number;
}

export interface SkillGap {
  skill_name?: string;
  skill?: string;
  importance?: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | string;
  recommendation?: string;
  category?: string;
  reason?: string;
}

export interface CandidateMatch {
  match_id?: string;
  candidate_id: string;
  candidate_name?: string;
  job_id?: string;
  overall_score: number;
  rank?: number;
  recruiter_summary?: string;
  score_breakdown?: ScoreBreakdown;
  contact_info?: {
    email?: { value: string };
    phone?: { value: string };
    linkedin?: { value: string };
    github?: { value: string };
  };
  skill_matches?: SkillMatch[];
  skill_gaps?: SkillGap[];
  evidence_list?: EvidenceItem[];
}

export interface OutreachData {
  candidate_id: string;
  candidate_name: string;
  job_id: string;
  job_title: string;
  contact_info?: Record<string, any>;
  subject: string;
  body: string;
  mailto_url: string;
}

export const api = {
  /**
   * Health check
   */
  async health(): Promise<{ status: string; service: string; version: string; jobs_loaded: number; resumes_loaded: number }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },

  /**
   * Jobs API
   */
  async jobs(): Promise<{ jobs: Job[] }> {
    const res = await fetch(`${API_BASE}/jobs`);
    return handleResponse(res);
  },

  async job(jobId: string): Promise<Job> {
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`);
    return handleResponse(res);
  },

  async uploadJob(file: File): Promise<{ message: string; job: Job }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/jobs`, {
      method: "POST",
      body: formData,
    });
    return handleResponse(res);
  },

  async createJobText(data: JobCreateInput): Promise<{ message: string; job: Job }> {
    const res = await fetch(`${API_BASE}/jobs/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  /**
   * Resumes API
   */
  async resumes(): Promise<{ resumes: ResumeItem[]; total: number }> {
    const res = await fetch(`${API_BASE}/resumes`);
    return handleResponse(res);
  },

  async uploadResume(file: File): Promise<{ message: string; candidate_id: string; candidate_name?: string; filename: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/resumes`, {
      method: "POST",
      body: formData,
    });
    return handleResponse(res);
  },

  async uploadResumes(files: FileList | File[]): Promise<{ message: string; resumes: Array<{ candidate_id: string; candidate_name?: string; filename: string }> }> {
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    const res = await fetch(`${API_BASE}/resumes/bulk`, {
      method: "POST",
      body: formData,
    });
    return handleResponse(res);
  },

  async deleteResume(candidateId: string): Promise<{ message: string; candidate_id: string }> {
    const res = await fetch(`${API_BASE}/resumes/${encodeURIComponent(candidateId)}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  async deleteAllResumes(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/resumes`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  /**
   * Screening Pipeline
   */
  async runScreening(jobIds?: string[], sync: boolean = true): Promise<{
    message: string;
    job_ids: string[];
    resume_count: number;
    results: Record<string, any[]>;
  }> {
    const params = new URLSearchParams();
    if (sync !== undefined) params.append("sync", String(sync));
    if (jobIds && jobIds.length > 0) {
      jobIds.forEach((id) => params.append("job_ids", id));
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE}/run-screening${qs}`, {
      method: "POST",
    });
    return handleResponse(res);
  },

  async screeningStatus(): Promise<{ status: Record<string, string> }> {
    const res = await fetch(`${API_BASE}/screening-status`);
    return handleResponse(res);
  },

  /**
   * Candidate Results & Outreach
   */
  async candidates(
    jobId: string,
    maskPii: boolean = false
  ): Promise<{ job_id: string; job_title: string; candidates: CandidateMatch[]; total: number; status: string }> {
    const query = maskPii ? "?mask_pii=true" : "";
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/candidates${query}`);
    return handleResponse(res);
  },

  async candidate(
    jobId: string,
    candidateId: string,
    maskPii: boolean = false
  ): Promise<CandidateMatch> {
    const query = maskPii ? "?mask_pii=true" : "";
    const res = await fetch(
      `${API_BASE}/jobs/${encodeURIComponent(jobId)}/candidates/${encodeURIComponent(candidateId)}${query}`
    );
    return handleResponse(res);
  },

  async candidateOutreach(jobId: string, candidateId: string): Promise<OutreachData> {
    const res = await fetch(
      `${API_BASE}/jobs/${encodeURIComponent(jobId)}/candidates/${encodeURIComponent(candidateId)}/outreach`,
      { method: "POST" }
    );
    return handleResponse(res);
  },

  /**
   * Demo Data Seeding
   */
  async seedDemo(): Promise<{ message: string; resumes: number; jobs: number; job_ids: string[] }> {
    const res = await fetch(`${API_BASE}/seed-demo-data`, {
      method: "POST",
    });
    return handleResponse(res);
  },
};

export default api;

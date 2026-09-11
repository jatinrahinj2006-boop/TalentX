# packages/schemas/match.py
from pydantic import BaseModel, Field
from typing import List, Optional
from packages.schemas.evidence import EvidenceItem
from packages.schemas.resume import ContactInfo

class SkillMatch(BaseModel):
    skill_name: str
    importance: str = Field(..., description="'must' or 'preferred'")
    status: str = Field(..., description="'matched', 'partial', or 'missing'")
    match_value: float = Field(..., ge=0.0, le=1.0, description="1.0 exact/synonym, ~0.7 semantic, ~0.4 related, 0 missing")
    evidence_span: Optional[str] = None
    page_number: Optional[int] = 1

class SkillGapItem(BaseModel):
    skill_name: str
    importance: str
    severity: str = Field(..., description="'HIGH' (missing required), 'MEDIUM' (missing preferred/partial required), 'LOW'")
    recommendation: Optional[str] = None

class ScoreBreakdown(BaseModel):
    required_skill_score: float
    preferred_skill_score: float
    experience_score: float
    responsibility_similarity: float
    role_domain_similarity: float
    education_score: float
    project_relevance: float
    certification_relevance: float
    gap_penalty: float

class MatchResult(BaseModel):
    match_id: str
    candidate_id: str
    job_id: str
    candidate_name: Optional[str] = None
    overall_score: float = Field(..., ge=0.0, le=100.0)
    score_breakdown: ScoreBreakdown
    contact_info: Optional[ContactInfo] = None
    skill_matches: List[SkillMatch] = Field(default_factory=list)
    skill_gaps: List[SkillGapItem] = Field(default_factory=list)
    evidence_list: List[EvidenceItem] = Field(default_factory=list)
    recruiter_summary: Optional[str] = None
    rank: Optional[int] = None

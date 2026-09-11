# packages/schemas/resume.py
from pydantic import BaseModel, Field
from typing import List, Optional

class ContactDetail(BaseModel):
    value: str = Field(..., description="Extracted contact value (e.g. email, phone, URL)")
    evidence_span: Optional[str] = Field(None, description="Source text snippet proving this contact detail")
    page_number: int = Field(default=1, description="Page number where detail was found")

class ContactInfo(BaseModel):
    email: Optional[ContactDetail] = None
    phone: Optional[ContactDetail] = None
    linkedin_url: Optional[ContactDetail] = None
    github_url: Optional[ContactDetail] = None
    portfolio_url: Optional[ContactDetail] = None

class ExtractedSkill(BaseModel):
    name: str = Field(..., description="Canonical or raw name of the skill")
    evidence_span: str = Field(..., description="Exact textual span from resume proving this skill")
    page_number: int = Field(default=1, description="Page number where skill is referenced")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    category: Optional[str] = Field(None, description="e.g. Programming, Database, Cloud, Soft Skill")

class EducationEntry(BaseModel):
    degree: str = Field(..., description="Degree title (e.g. B.Tech, M.S., B.S.)")
    field: Optional[str] = Field(None, description="Field of study / Major")
    institution: Optional[str] = Field(None, description="University or Institution name")
    year: Optional[int] = Field(None, description="Graduation year")
    evidence_span: Optional[str] = Field(None, description="Source text snippet")

class ExperienceEntry(BaseModel):
    role: str = Field(..., description="Job title / Role")
    company: Optional[str] = Field(None, description="Company name")
    duration_months: int = Field(default=0, description="Duration in months")
    responsibilities: List[str] = Field(default_factory=list, description="Key duties and achievements")
    evidence_span: Optional[str] = Field(None, description="Source text snippet")

class ProjectEntry(BaseModel):
    title: str = Field(..., description="Project title")
    description: Optional[str] = Field(None, description="Brief description")
    technologies: List[str] = Field(default_factory=list, description="Tech stack used")

class CertificationEntry(BaseModel):
    name: str = Field(..., description="Certification name")
    issuer: Optional[str] = Field(None, description="Issuing organization")
    year: Optional[int] = Field(None, description="Year obtained")

class ExtractedResume(BaseModel):
    candidate_id: str = Field(..., description="Unique candidate ID (e.g., C001)")
    name: str = Field(..., description="Candidate full name (kept separate from scoring)")
    contact_info: ContactInfo = Field(default_factory=ContactInfo)
    education: List[EducationEntry] = Field(default_factory=list)
    experience: List[ExperienceEntry] = Field(default_factory=list)
    skills: List[ExtractedSkill] = Field(default_factory=list)
    projects: List[ProjectEntry] = Field(default_factory=list)
    certifications: List[CertificationEntry] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)

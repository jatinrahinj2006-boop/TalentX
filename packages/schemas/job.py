# packages/schemas/job.py
from pydantic import BaseModel, Field
from typing import List, Optional

class RequiredSkill(BaseModel):
    name: str = Field(..., description="Skill name")
    importance: str = Field(default="must", description="'must' or 'preferred'")
    weight: float = Field(default=1.0, ge=0.0, le=2.0)

class PreferredSkill(BaseModel):
    name: str = Field(..., description="Skill name")
    importance: str = Field(default="preferred", description="Always 'preferred'")
    weight: float = Field(default=0.5, ge=0.0, le=1.0)

class ExtractedJob(BaseModel):
    job_id: str = Field(..., description="Unique Job ID (e.g., J001)")
    title: str = Field(..., description="Job Title")
    domain: str = Field(default="Software Engineering", description="Industry domain")
    minimum_experience_months: int = Field(default=0, description="Minimum experience required in months")
    required_skills: List[RequiredSkill] = Field(default_factory=list)
    preferred_skills: List[PreferredSkill] = Field(default_factory=list)
    education_requirements: List[str] = Field(default_factory=list)
    responsibilities: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    preferred_qualifications: List[str] = Field(default_factory=list)
    other_requirements: List[str] = Field(default_factory=list)

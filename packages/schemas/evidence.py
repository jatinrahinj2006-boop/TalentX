# packages/schemas/evidence.py
from pydantic import BaseModel, Field
from typing import Optional

class EvidenceItem(BaseModel):
    claim: str = Field(..., description="The skill or qualification claim being evidenced")
    source_document: str = Field(..., description="Filename or identifier of source document")
    page: int = Field(default=1, description="1-indexed page number where claim appears")
    text_span: str = Field(..., description="Exact textual excerpt from resume backing the claim")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Extraction confidence score")

# packages/agents/resume_agent.py
"""
Agent 1: Resume Agent
Role: PDF/DOCX/TXT Resume parsing -> structured ExtractedResume schema with per-skill evidence spans.
Rules:
- Every extracted skill must include evidence_span and page_number.
- Validates output against ExtractedResume Pydantic model.
"""

import os
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Tuple, Dict, Any
from packages.schemas.resume import (
    ExtractedResume,
    ExtractedSkill,
    EducationEntry,
    ExperienceEntry,
    ProjectEntry,
    CertificationEntry,
)
from packages.agents.llm_client import generate_structured

def _extract_text_from_docx(file_path: str) -> List[Tuple[int, str]]:
    """
    Extracts text from DOCX files using Python standard library (zipfile + xml).
    No external pip dependencies required.
    """
    try:
        with zipfile.ZipFile(file_path) as z:
            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            # Namespace for Word processing ML
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            for p in tree.iter(f"{{{ns['w']}}}p"):
                texts = [node.text for node in p.iter(f"{{{ns['w']}}}t") if node.text]
                if texts:
                    paragraphs.append("".join(texts))
            return [(1, "\n".join(paragraphs))]
    except Exception as e:
        print(f"[Resume Agent] DOCX extraction error for {file_path}: {e}")
        return [(1, "")]

def extract_text_from_file(file_path: str) -> List[Tuple[int, str]]:
    """
    Extracts text page-by-page from PDF, DOCX, or TXT files.
    Returns list of (page_number, text_content).
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Resume file not found: {file_path}")

    pages = []
    ext = os.path.splitext(file_path)[1].lower()

    if ext in [".pdf"]:
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages, start=1):
                    txt = page.extract_text() or ""
                    pages.append((i, txt))
        except Exception:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            for i, page in enumerate(reader.pages, start=1):
                pages.append((i, page.extract_text() or ""))
    elif ext in [".docx"]:
        pages = _extract_text_from_docx(file_path)
    else:
        # Fallback for plain text resume files (.txt, .md, etc.)
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            full_text = f.read()
            pages.append((1, full_text))

    return pages

def _extract_candidate_name(full_text: str, pages: List[Tuple[int, str]], file_path: str) -> str:
    """
    Extracts candidate full name accurately from resume text or contact slugs.
    """
    # 1. Explicit label (e.g., "Name: Suhani Dey", "Candidate Name: Jane Doe")
    name_match = re.search(r"(?:Candidate Name|Full Name|Name)[^\S\r\n]*[:|-][^\S\r\n]*([A-Za-zÀ-ÖØ-öø-ÿ .'-]{2,40})", full_text, re.IGNORECASE)
    if name_match:
        cand = name_match.group(1).strip()
        if not re.search(r"\b(engineer|developer|enthusiast|intern|summary|experience)\b", cand, re.I):
            return cand.title()

    # 2. Inspect top non-empty lines from the first page
    first_page_text = pages[0][1] if pages else full_text
    lines = [l.strip() for l in first_page_text.splitlines() if l.strip()]

    invalid_keywords = {
        "resume", "curriculum vitae", "cv", "summary", "profile", "contact",
        "education", "experience", "projects", "skills", "technical skills",
        "objective", "certifications", "achievements", "work experience"
    }

    for line in lines[:6]:
        # Skip lines containing email, URL, phone numbers, or page markers
        if "@" in line or "http" in line or "github" in line or "linkedin" in line or any(c.isdigit() for c in line) or "|" in line:
            continue
        if line.lower() in invalid_keywords or len(line) < 2 or len(line) > 40:
            continue
        # Skip job titles or profession taglines
        if re.search(r"\b(engineer|developer|enthusiast|intern|specialist|manager|lead|architect|analyst|student|consultant|designer)\b", line, re.I):
            continue
        # Check if line contains 1 to 4 clean alphabetical words
        words = line.split()
        if 1 <= len(words) <= 4 and re.match(r"^[A-Za-zÀ-ÖØ-öø-ÿ\s.'-]+$", line):
            return line.title()

    # 3. Fallback: LinkedIn Profile URL slug (e.g. linkedin.com/in/suhani-dey-5176aa30a -> Suhani Dey)
    linkedin_m = re.search(r"linkedin\.com/in/([a-zA-Z0-9_-]+)", full_text, re.IGNORECASE)
    if linkedin_m:
        slug_parts = linkedin_m.group(1).split("-")
        clean_words = [w.title() for w in slug_parts if not any(c.isdigit() for c in w) and len(w) > 1 and w.lower() not in {"in", "com"}]
        if clean_words:
            return " ".join(clean_words)

    # 4. Fallback: Email username (e.g. suhanidey5002@gmail.com -> Suhani Dey)
    email_m = re.search(r"([a-zA-Z0-9._%+-]+)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", full_text)
    if email_m:
        user_part = email_m.group(1)
        alpha_user = re.sub(r"\d+$", "", user_part)
        if len(alpha_user) >= 3 and not any(kw in alpha_user.lower() for kw in ["info", "contact", "admin", "hello", "mail"]):
            if "." in alpha_user or "_" in alpha_user:
                return " ".join([p.title() for p in re.split(r"[._]", alpha_user) if p])

    # 5. Fallback: Filename (e.g., "Suhani_Dey_Resume.pdf" -> "Suhani Dey")
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    base_clean = re.sub(r"(?i)(resume|cv|dossier|document|candidate|\bC\d+\b)", "", base_name)
    base_clean = re.sub(r"[_\-\.]+", " ", base_clean).strip()
    if 2 <= len(base_clean.split()) <= 4 and re.match(r"^[A-Za-z\s]+$", base_clean):
        return base_clean.title()

    return "Candidate"


def _heuristic_resume_parse(file_path: str, candidate_id: str, pages: List[Tuple[int, str]]) -> Dict[str, Any]:
    """
    Robust heuristic parser that extracts candidate data and matches exact source lines as evidence spans.
    """
    full_text = "\n".join([txt for _, txt in pages])
    source_filename = os.path.basename(file_path)

    # Extract Name with multi-strategy accuracy
    name = _extract_candidate_name(full_text, pages, file_path)

    # Comprehensive skill taxonomy list for evidence matching
    known_skills = [
        "Python", "PyTorch", "TensorFlow", "Scikit-Learn", "Pandas", "NumPy", "Keras",
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "SQL", "NoSQL",
        "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Cloud", "DevOps", "CI/CD",
        "Git", "GitHub", "Linux", "Unix", "Bash", "Shell",
        "C++", "C#", "C", "Java", "Go", "Golang", "Rust", "Scala", "R",
        "FastAPI", "Flask", "Django", "Spring", "Node.js", "Express",
        "React", "Next.js", "TypeScript", "JavaScript", "Vue", "Angular", "HTML", "CSS", "Tailwind CSS",
        "Machine Learning", "Deep Learning", "Artificial Intelligence", "NLP", "Computer Vision",
        "Data Science", "Data Engineering", "Big Data", "Spark", "PySpark", "Kafka", "Hadoop",
        "REST API", "GraphQL", "Microservices", "System Design", "Agile", "Scrum",
        "Software Engineering", "Backend", "Frontend", "Full Stack", "Testing", "QA", "Security"
    ]

    extracted_skills = []
    seen_skills = set()

    for page_num, page_text in pages:
        lines = page_text.splitlines()
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
            for skill in known_skills:
                if skill.lower() not in seen_skills and re.search(r"\b" + re.escape(skill) + r"\b", line_str, re.IGNORECASE):
                    seen_skills.add(skill.lower())
                    extracted_skills.append({
                        "name": skill,
                        "evidence_span": line_str[:250],
                        "page_number": page_num,
                        "confidence": 0.95
                    })

    # Fallback skill extraction: if no specific tech skills matched, extract key noun phrases or default competency
    if not extracted_skills:
        first_line = next((line.strip() for _, page_text in pages for line in page_text.splitlines() if len(line.strip()) > 10), "Candidate technical qualifications")
        extracted_skills.append({
            "name": "General Technical Competency",
            "evidence_span": first_line[:250],
            "page_number": 1,
            "confidence": 0.85
        })


    # ── Extract Experience ──────────────────────────────────────────────────
    # Patterns: "Role at/@ Company", "Role | Company", "Role — Company", "Role, Company"
    exp_entries = []
    seen_exp = set()

    # Pattern 1: Role | Company  — single-line only (no \n in character classes)
    for m in re.finditer(
        r"([\w /+.#-]{3,50}(?:Engineer|Developer|Lead|Manager|Intern|Analyst|Designer|Scientist|Architect|Consultant|Specialist|Director|Officer|Head)[\w /+.#-]{0,30})"
        r"[ \t]*[\|–—][ \t]*([\w .,&]{2,60})(?:[ \t]*[\|–—(]|[ \t]*$)",
        full_text, re.IGNORECASE | re.MULTILINE
    ):
        role = m.group(1).strip().rstrip("–—|-").strip()
        company = m.group(2).strip().rstrip("–—|-,").strip()
        # Avoid picking up contact/skills/URL lines as experience
        if (len(role) < 3 or len(company) < 2
                or "\n" in role
                or any(bad in role.lower() for bad in ["github.com", "linkedin.com", "http", "@"])
                or any(bad in company.lower() for bad in ["@", "http", "skill", "python", "java", "github", "linkedin"])):
            continue
        key = (role.lower(), company.lower())
        if key in seen_exp:
            continue
        seen_exp.add(key)

        # Try to extract duration: look for year ranges like 2019-2022 or "3 years"
        duration_months = 0
        year_range = re.search(r"(\d{4})\s*[-–—]\s*(\d{4}|present|current)", full_text[max(0, m.start()-80):m.start()+200], re.I)
        if year_range:
            try:
                y1 = int(year_range.group(1))
                y2_raw = year_range.group(2).lower()
                y2 = 2024 if y2_raw in ("present", "current") else int(y2_raw)
                duration_months = max(1, (y2 - y1) * 12)
            except ValueError:
                pass
        months_m = re.search(r"(\d+)\s*(?:months?|mos?)\b", full_text[max(0, m.start()-80):m.start()+200], re.I)
        if months_m and not duration_months:
            duration_months = int(months_m.group(1))

        evidence_line = next(
            (l.strip() for l in full_text.splitlines() if role[:20].lower() in l.lower() and len(l.strip()) > 5),
            f"{role} at {company}"
        )
        exp_entries.append({
            "role": role,
            "company": company,
            "duration_months": duration_months or 12,
            "responsibilities": [],
            "evidence_span": evidence_line[:250]
        })

    # Pattern 2: "at <Company>" near a title keyword (e.g. "Software Engineer at Google")
    if not exp_entries:
        for m in re.finditer(
            r"([\w /+.#-]{3,50}(?:Engineer|Developer|Lead|Manager|Intern|Analyst|Designer|Scientist|Architect|Consultant|Specialist))"
            r"[ \t]+at[ \t]+([\w .,&]{2,60})(?:[ \t]*[\n(,]|[ \t]*$)",
            full_text, re.IGNORECASE | re.MULTILINE
        ):
            role = m.group(1).strip()
            company = m.group(2).strip().rstrip(",")
            key = (role.lower(), company.lower())
            if key in seen_exp or any(bad in company.lower() for bad in ["@", "http"]):
                continue
            seen_exp.add(key)
            evidence_line = next(
                (l.strip() for l in full_text.splitlines() if role[:20].lower() in l.lower()),
                f"{role} at {company}"
            )
            exp_entries.append({
                "role": role,
                "company": company,
                "duration_months": 12,
                "responsibilities": [],
                "evidence_span": evidence_line[:250]
            })

    # ── Extract Education ───────────────────────────────────────────────────
    edu_entries = []
    seen_edu = set()

    degree_pattern = re.compile(
        # Degree abbreviations (no trailing \b since abbreviations end with '.')
        # or full words (Bachelor, Master, Doctorate) with word boundary
        r"(?:\b(B\.Tech|B\.E\.|B\.S\.|B\.Sc\.|M\.Tech|M\.E\.|M\.S\.|M\.Sc\.|MBA|Ph\.D\.)"
        r"|(?=\b)(Bachelor(?:'?s)?|Master(?:'?s)?|Doctorate?)(?=[\s,]))"
        # optional field: "in/of <field>" — stops before "from"/"at" or comma
        r"(?:[^\n]{0,60}?\b(?:in|of)\b[ \t]+([\w ]+?)(?=[ \t]+(?:from|at)\b|[,;\n]))?"
        # optional institution: "from/at <institution>" — stops before year or comma
        r"(?:[^\n]{0,60}?\b(?:from|at)\b[\s,\u2013]+([\w ,&'.-]+?)(?=[ ,;(]?\d{4}|[;\n]|$))?"
        # optional year
        r"(?:[^\n]{0,20}?\b(\d{4})\b)?",
        re.IGNORECASE
    )
    for m in degree_pattern.finditer(full_text):
        # group 1 = abbreviation (B.Tech, B.S., etc.), group 2 = full word (Bachelor, Master, Doctorate)
        degree = (m.group(1) or m.group(2) or "").strip()
        if not degree:
            continue
        field = (m.group(3) or "").strip().rstrip(",–- ").strip() or None
        institution = (m.group(4) or "").strip().rstrip(",–- ").strip() or None
        year_str = m.group(5)
        year = int(year_str) if year_str and 1970 < int(year_str) < 2030 else None

        # Skip degenerate matches (too short institution/field, or repeated)
        key = (degree.lower(), (institution or "").lower()[:30])
        if key in seen_edu:
            continue
        seen_edu.add(key)
        if institution and len(institution) < 2:
            institution = None

        evidence_line = full_text[m.start():m.start() + 200].splitlines()[0].strip()
        edu_entries.append({
            "degree": degree,
            "field": field or "Not specified",
            "institution": institution or "Not specified",
            "year": year,
            "evidence_span": evidence_line[:250]
        })


    # Extract Contact Info (email, phone, linkedin, github, portfolio) with evidence spans
    contact_info = {}
    
    # 1. Email Regex
    email_m = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", full_text)
    if email_m:
        val = email_m.group(1).strip()
        line = next((l.strip() for _, pt in pages for l in pt.splitlines() if val in l), val)
        page_num = next((p_num for p_num, pt in pages if val in pt), 1)
        contact_info["email"] = {"value": val, "evidence_span": line[:250], "page_number": page_num}

    # 2. Phone Regex
    phone_m = re.search(r"((?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})", full_text)
    if phone_m:
        val = phone_m.group(1).strip()
        line = next((l.strip() for _, pt in pages for l in pt.splitlines() if val in l), val)
        page_num = next((p_num for p_num, pt in pages if val in pt), 1)
        contact_info["phone"] = {"value": val, "evidence_span": line[:250], "page_number": page_num}

    # 3. LinkedIn Regex
    linkedin_m = re.search(r"((?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+)", full_text, re.IGNORECASE)
    if linkedin_m:
        val = linkedin_m.group(1).strip()
        if not val.startswith("http"): val = "https://" + val
        line = next((l.strip() for _, pt in pages for l in pt.splitlines() if val in l or "linkedin" in l.lower()), val)
        page_num = next((p_num for p_num, pt in pages if "linkedin" in pt.lower()), 1)
        contact_info["linkedin_url"] = {"value": val, "evidence_span": line[:250], "page_number": page_num}

    # 4. GitHub Regex
    github_m = re.search(r"((?:https?://)?(?:www\.)?github\.com/[a-zA-Z0-9_-]+)", full_text, re.IGNORECASE)
    if github_m:
        val = github_m.group(1).strip()
        if not val.startswith("http"): val = "https://" + val
        line = next((l.strip() for _, pt in pages for l in pt.splitlines() if val in l or "github" in l.lower()), val)
        page_num = next((p_num for p_num, pt in pages if "github" in pt.lower()), 1)
        contact_info["github_url"] = {"value": val, "evidence_span": line[:250], "page_number": page_num}

    return {
        "candidate_id": candidate_id,
        "name": name,
        "contact_info": contact_info,
        "education": edu_entries,
        "experience": exp_entries,
        "skills": extracted_skills,
        "projects": [],
        "certifications": [],
        "achievements": []
    }


def parse_resume(file_path: str, candidate_id: str = "C001") -> ExtractedResume:
    """
    Parses PDF/DOCX/TXT resume into a validated ExtractedResume Pydantic model with grounded evidence spans.
    """
    pages = extract_text_from_file(file_path)
    full_text = "\n".join([f"--- Page {num} ---\n{txt}" for num, txt in pages])

    prompt = f"""You are an expert HR Resume Parser. Your task is to extract ALL structured information from the resume text below.

CRITICAL RULES — VIOLATIONS WILL CAUSE REJECTION:
1. NEVER invent, hallucinate, or fabricate any information. Only output what is explicitly present in the text.
2. Every extracted skill MUST have an `evidence_span` that is an EXACT verbatim snippet from the resume text, and the 1-indexed `page_number` where it appears.
3. For experience entries: only include roles/companies that are explicitly stated. If duration is not stated, omit `duration_months` or set to 0.
4. For education entries: only include degrees/institutions explicitly mentioned. Do NOT guess the year if not present.
5. `candidate_id` must be exactly: "{candidate_id}"
6. `name` should be the candidate's full name as it appears at the top of the resume.

OUTPUT SCHEMA (JSON):
{{
  "candidate_id": "{candidate_id}",
  "name": "<full name from resume>",
  "contact_info": {{
    "email": {{"value": "<if present>", "evidence_span": "<exact line>", "page_number": 1}},
    "phone": {{"value": "<if present>", "evidence_span": "<exact line>", "page_number": 1}},
    "linkedin_url": {{"value": "<if present>", "evidence_span": "<exact line>", "page_number": 1}},
    "github_url": {{"value": "<if present>", "evidence_span": "<exact line>", "page_number": 1}}
  }},
  "education": [
    {{"degree": "<exact degree>", "field": "<field of study>", "institution": "<institution name>", "year": <graduation year or null>, "evidence_span": "<exact line from resume>"}}
  ],
  "experience": [
    {{"role": "<job title>", "company": "<company name>", "duration_months": <integer or 0 if unknown>, "responsibilities": ["<bullet point>", ...], "evidence_span": "<exact line from resume>"}}
  ],
  "skills": [
    {{"name": "<skill name>", "evidence_span": "<exact line from resume>", "page_number": <1-indexed>, "confidence": <0.0-1.0>}}
  ],
  "projects": [],
  "certifications": [],
  "achievements": []
}}

RESUME TEXT:
{full_text}
"""

    return generate_structured(
        prompt=prompt,
        schema_class=ExtractedResume,
        fallback_data_generator=lambda: _heuristic_resume_parse(file_path, candidate_id, pages)
    )


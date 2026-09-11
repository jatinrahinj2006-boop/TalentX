# packages/knowledge/skill_normalizer.py
"""
Knowledge Layer: Skill Normalizer & ESCO Synonym Lookup.
Phase 1: Exact string match + alias dictionary.
Phase 3: Embedding similarity fallback (when sentence-transformers available).
"""

import csv
import os
import re
from typing import Tuple, Optional, Dict, List

# ── Alias dictionary (canonical → list of raw aliases) ──────────────────────
SKILL_ALIASES: Dict[str, List[str]] = {
    "Python": ["python3", "python language", "python scripting", "py"],
    "JavaScript": ["js", "es6", "ecmascript", "vanilla js"],
    "TypeScript": ["ts", "typescript 5"],
    "PostgreSQL": ["postgres", "postgres db", "pg", "psql"],
    "Docker": ["docker containers", "containerization", "dockerfile"],
    "Kubernetes": ["k8s", "kubernetes cluster", "kubectl"],
    "PyTorch": ["torch", "pytorch framework"],
    "TensorFlow": ["tf", "tensorflow 2"],
    "Scikit-Learn": ["sklearn", "scikit learn", "scikit-learn"],
    "React": ["react.js", "reactjs", "react framework"],
    "Next.js": ["nextjs", "next js", "next framework"],
    "FastAPI": ["fast api", "fastapi framework"],
    "Machine Learning": ["ml", "deep learning", "ai/ml", "artificial intelligence"],
    "AWS": ["amazon web services", "amazon aws", "ec2", "s3"],
    "Git": ["github", "gitlab", "version control", "git workflow"],
    "SQL": ["structured query language", "mysql", "mariadb"],
    "Redis": ["redis cache", "redis db"],
    "Tailwind CSS": ["tailwind", "tailwindcss"],
    "Go": ["golang", "go language"],
    "C++": ["cpp", "c plus plus", "c++11"],
    "Pandas": ["pandas dataframe", "pd"],
    "NumPy": ["numpy", "np"],
    "Kubernetes": ["k8s", "k8", "kube"],
}

# Build reverse lookup: alias → canonical
_ALIAS_LOOKUP: Dict[str, str] = {}
for canonical, aliases in SKILL_ALIASES.items():
    _ALIAS_LOOKUP[canonical.lower()] = canonical
    for alias in aliases:
        _ALIAS_LOOKUP[alias.lower()] = canonical

# ── ESCO CSV loader ──────────────────────────────────────────────────────────
_ESCO_CACHE: Optional[Dict[str, str]] = None

def _load_esco_subset() -> Dict[str, str]:
    """Loads ESCO skills CSV and builds a label → preferred_label mapping."""
    global _ESCO_CACHE
    if _ESCO_CACHE is not None:
        return _ESCO_CACHE

    _ESCO_CACHE = {}
    csv_path = os.path.join(os.path.dirname(__file__), "esco_subset.csv")
    if not os.path.exists(csv_path):
        return _ESCO_CACHE

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            preferred = row.get("preferred_label", "").strip()
            if not preferred:
                continue
            _ESCO_CACHE[preferred.lower()] = preferred
            alt_labels = row.get("alt_labels", "")
            for alt in alt_labels.split(";"):
                alt = alt.strip()
                if alt:
                    _ESCO_CACHE[alt.lower()] = preferred

    return _ESCO_CACHE


def normalize_skill(raw_skill: str) -> Tuple[str, float]:
    """
    Maps a raw extracted skill string to (canonical_name, confidence).
    Strategy:
      1. Exact alias dict match → confidence 1.0
      2. ESCO CSV match → confidence 0.95
      3. Title-cased passthrough → confidence 0.7
    """
    cleaned = raw_skill.strip()
    lower = cleaned.lower()

    # 1. Alias dict (fastest)
    if lower in _ALIAS_LOOKUP:
        return _ALIAS_LOOKUP[lower], 1.0

    # 2. ESCO CSV lookup
    esco = _load_esco_subset()
    if lower in esco:
        return esco[lower], 0.95

    # 3. Passthrough with basic title-casing
    return cleaned.title(), 0.7

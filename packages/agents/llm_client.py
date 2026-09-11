# packages/agents/llm_client.py
"""
LLM Provider Interface for TalentX Agents.
Supports multi-key rotation and fallback across:
- 3x NVIDIA NIM API Keys (NVIDIA_NIM_API_KEY_1, _2, _3)
- 2x Groq API Keys (GROQ_API_KEY_1, _2)
- 1x Gemini API Key (GEMINI_API_KEY)
- Offline heuristic fallback (zero breakage when keys are missing or rate limited)
"""

import os
import json
import re
import itertools
from typing import Type, TypeVar, Optional, List
from pydantic import BaseModel

# Load .env file if present
def _load_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip().strip("'\"")

_load_env()

T = TypeVar("T", bound=BaseModel)

# Key pools and round-robin state
def _get_nvidia_keys() -> List[str]:
    keys = []
    for k in ["NVIDIA_NIM_API_KEY_1", "NVIDIA_NIM_API_KEY_2", "NVIDIA_NIM_API_KEY_3", "NVIDIA_NIM_API_KEY"]:
        val = os.environ.get(k, "").strip()
        if val and val not in keys and not val.startswith("your_"):
            keys.append(val)
    return keys

def _get_groq_keys() -> List[str]:
    keys = []
    for k in ["GROQ_API_KEY_1", "GROQ_API_KEY_2", "GROQ_API_KEY"]:
        val = os.environ.get(k, "").strip()
        if val and val not in keys and not val.startswith("your_"):
            keys.append(val)
    return keys

_nvidia_counter = 0
_groq_counter = 0

_dead_keys = set()

def _call_nvidia_nim(prompt: str) -> Optional[str]:
    global _nvidia_counter
    keys = [k for k in _get_nvidia_keys() if k not in _dead_keys]
    if not keys:
        return None
    
    # Round-robin starting key
    start_idx = _nvidia_counter % len(keys)
    _nvidia_counter += 1
    
    model = os.environ.get("NVIDIA_NIM_MODEL", "meta/llama-3.3-70b-instruct")
    
    # Try all keys in pool starting from index
    for i in range(len(keys)):
        key = keys[(start_idx + i) % len(keys)]
        if key in _dead_keys:
            continue
        try:
            import urllib.request
            req = urllib.request.Request(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                data=json.dumps({
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                    "max_tokens": 2048
                }).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                if content:
                    print(f"[LLM Client] Successfully responded via NVIDIA NIM key #{(start_idx + i) % len(keys) + 1}")
                    return content
        except Exception as e:
            err_str = str(e)
            if any(code in err_str for code in ["401", "403", "410"]):
                _dead_keys.add(key)
            print(f"[LLM Client] NVIDIA NIM key #{(start_idx + i) % len(keys) + 1} call failed: {e}")
            continue
    return None

def _call_groq(prompt: str) -> Optional[str]:
    global _groq_counter
    keys = [k for k in _get_groq_keys() if k not in _dead_keys]
    if not keys:
        return None

    start_idx = _groq_counter % len(keys)
    _groq_counter += 1
    
    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    for i in range(len(keys)):
        key = keys[(start_idx + i) % len(keys)]
        if key in _dead_keys:
            continue
        try:
            import urllib.request
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                data=json.dumps({
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                }).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                if content:
                    print(f"[LLM Client] Successfully responded via Groq key #{(start_idx + i) % len(keys) + 1}")
                    return content
        except Exception as e:
            err_str = str(e)
            if any(code in err_str for code in ["401", "403", "410"]):
                _dead_keys.add(key)
            print(f"[LLM Client] Groq key #{(start_idx + i) % len(keys) + 1} call failed: {e}")
            continue
    return None

def _call_gemini(prompt: str) -> Optional[str]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or api_key.startswith("your_"):
        return None
    try:
        import urllib.request
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            headers={"Content-Type": "application/json"},
            data=json.dumps({
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }).encode("utf-8")
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"[LLM Client] Gemini call failed: {e}")
        return None

def generate_structured(prompt: str, schema_class: Type[T], fallback_data_generator=None) -> T:
    """
    Executes prompt against available LLM providers in priority order:
    1. NVIDIA NIM (rotating across 3 keys)
    2. Groq (rotating across 2 keys)
    3. Gemini API
    4. Heuristic parser fallback
    """
    raw_response = _call_nvidia_nim(prompt)
    if not raw_response:
        raw_response = _call_groq(prompt)
    if not raw_response:
        raw_response = _call_gemini(prompt)

    if raw_response:
        try:
            cleaned = re.sub(r"^```json\s*", "", raw_response.strip(), flags=re.IGNORECASE)
            cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.IGNORECASE)
            data_dict = json.loads(cleaned)
            return schema_class.model_validate(data_dict)
        except Exception as err:
            print(f"[LLM Client] Validation error on raw LLM output: {err}")

    if fallback_data_generator:
        fallback_dict = fallback_data_generator()
        return schema_class.model_validate(fallback_dict)

    raise RuntimeError(f"Failed to generate structured data for {schema_class.__name__} and no fallback generator was provided.")

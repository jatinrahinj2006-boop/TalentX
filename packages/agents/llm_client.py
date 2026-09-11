# packages/agents/llm_client.py
"""
LLM Provider Interface for TalentX Agents.
Supports rate limiting, key cooldowns, and round-robin fallback across:
- 3x NVIDIA NIM API Keys (NVIDIA_NIM_API_KEY_1, _2, _3)
- 2x Groq API Keys (GROQ_API_KEY_1, _2)
- 1x Gemini API Key (GEMINI_API_KEY)
- Offline heuristic fallback (zero breakage when keys are missing or rate limited)
"""

import os
import json
import re
import time
from typing import Type, TypeVar, Optional, List, Dict
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

import ssl

def _make_ssl_context():
    try:
        return ssl._create_unverified_context()
    except Exception:
        return None

# Global rate limiting & offline tracking state
_NETWORK_DISABLED = False
_key_cooldown_until: Dict[str, float] = {}

def _is_key_rate_limited(key: str) -> bool:
    return time.time() < _key_cooldown_until.get(key, 0)

def _mark_key_cooldown(key: str, seconds: float = 60.0):
    _key_cooldown_until[key] = time.time() + seconds

def _get_nvidia_keys() -> List[str]:
    keys = []
    for k in ["NVIDIA_NIM_API_KEY_1", "NVIDIA_NIM_API_KEY_2", "NVIDIA_NIM_API_KEY_3", "NVIDIA_NIM_API_KEY"]:
        val = os.environ.get(k, "").strip()
        if val and val not in keys and not val.startswith("your_"):
            if not _is_key_rate_limited(val):
                keys.append(val)
    return keys

def _get_groq_keys() -> List[str]:
    keys = []
    for k in ["GROQ_API_KEY_1", "GROQ_API_KEY_2", "GROQ_API_KEY"]:
        val = os.environ.get(k, "").strip()
        if val and val not in keys and not val.startswith("your_"):
            if not _is_key_rate_limited(val):
                keys.append(val)
    return keys

_nvidia_counter = 0
_groq_counter = 0

def _call_nvidia_nim(prompt: str) -> Optional[str]:
    global _nvidia_counter, _NETWORK_DISABLED
    if _NETWORK_DISABLED:
        return None
    keys = _get_nvidia_keys()
    if not keys:
        return None
    
    start_idx = _nvidia_counter % len(keys)
    _nvidia_counter += 1
    model = os.environ.get("NVIDIA_NIM_MODEL", "meta/llama-3.3-70b-instruct")
    
    for i in range(len(keys)):
        key = keys[(start_idx + i) % len(keys)]
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
            with urllib.request.urlopen(req, timeout=2, context=_make_ssl_context()) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                if content:
                    return content
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "Too Many Requests" in err_str or "rate limit" in err_str.lower():
                print(f"[Rate Limiter] NVIDIA NIM key ...{key[-4:]} rate limited. Cooling down for 60s.")
                _mark_key_cooldown(key, 60.0)
            elif "nodename nor servname provided" in err_str or "Errno 8" in err_str or "CERTIFICATE_VERIFY_FAILED" in err_str or "SSL" in err_str:
                _NETWORK_DISABLED = True
            continue
    return None


def _call_groq(prompt: str) -> Optional[str]:
    global _groq_counter, _NETWORK_DISABLED
    if _NETWORK_DISABLED:
        return None
    keys = _get_groq_keys()
    if not keys:
        return None

    start_idx = _groq_counter % len(keys)
    _groq_counter += 1
    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    for i in range(len(keys)):
        key = keys[(start_idx + i) % len(keys)]
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
            with urllib.request.urlopen(req, timeout=2, context=_make_ssl_context()) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                if content:
                    return content
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "Too Many Requests" in err_str or "rate limit" in err_str.lower():
                print(f"[Rate Limiter] Groq key ...{key[-4:]} rate limited. Cooling down for 60s.")
                _mark_key_cooldown(key, 60.0)
            elif "nodename nor servname provided" in err_str or "Errno 8" in err_str or "CERTIFICATE_VERIFY_FAILED" in err_str or "SSL" in err_str:
                _NETWORK_DISABLED = True
            continue
    return None

def _call_gemini(prompt: str) -> Optional[str]:
    global _NETWORK_DISABLED
    if _NETWORK_DISABLED:
        return None
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or api_key.startswith("your_") or _is_key_rate_limited(api_key):
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
        with urllib.request.urlopen(req, timeout=2, context=_make_ssl_context()) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "rate limit" in err_str.lower():
            print("[Rate Limiter] Gemini API key rate limited. Cooling down for 60s.")
            _mark_key_cooldown(api_key, 60.0)
        elif "nodename nor servname provided" in err_str or "Errno 8" in err_str or "CERTIFICATE_VERIFY_FAILED" in err_str or "SSL" in err_str:
            _NETWORK_DISABLED = True
        return None


def generate_structured(prompt: str, schema_class: Type[T], fallback_data_generator=None) -> T:
    """
    Executes prompt against available LLM providers in priority order:
    1. NVIDIA NIM (rotating across 3 keys with rate-limit cooldown)
    2. Groq (rotating across 2 keys with rate-limit cooldown)
    3. Gemini API (with rate-limit cooldown)
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
            pass

    if fallback_data_generator:
        fallback_dict = fallback_data_generator()
        return schema_class.model_validate(fallback_dict)

    raise RuntimeError(f"Failed to generate structured data for {schema_class.__name__} and no fallback generator was provided.")

"""Thin wrapper around OpenRouter (OpenAI-compatible) shared by all nodes.

OpenRouter proxies the request to the underlying provider — for
`anthropic/claude-sonnet-4.6` that's Anthropic. The Anthropic SDK is no longer
required at runtime; we use the openai SDK pointed at openrouter.ai.
"""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.6")
BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")


@lru_cache(maxsize=1)
def client() -> OpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY not set. Add it to .env "
            "(get one at https://openrouter.ai/keys)."
        )
    return OpenAI(api_key=api_key, base_url=BASE_URL)


@lru_cache(maxsize=16)
def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.txt").read_text()


def call(
    system: str,
    user: str,
    *,
    model: str | None = None,
    max_tokens: int = 1024,
    cache_system: bool = False,  # kept for API compat; OpenRouter caches transparently
) -> str:
    """Single-shot text completion. Returns the content of the first choice."""
    del cache_system  # OpenRouter handles caching server-side for Anthropic models
    resp = client().chat.completions.create(
        model=model or DEFAULT_MODEL,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


def call_json(system: str, user: str, **kwargs) -> dict:
    """Call the model and parse the response as JSON. Tolerates code-fenced output."""
    raw = call(system, user, **kwargs)
    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)
    # Find first {...} block
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise ValueError(f"No JSON object found in model output: {raw[:200]}")
    return json.loads(m.group(0))

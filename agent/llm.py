"""Thin wrapper around the Anthropic SDK shared by all nodes."""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
DEFAULT_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")


@lru_cache(maxsize=1)
def client() -> Anthropic:
    # Supports native Anthropic (x-api-key) OR an Anthropic-compatible proxy
    # like OpenRouter (Authorization: Bearer). Set ANTHROPIC_BASE_URL +
    # ANTHROPIC_AUTH_TOKEN to route through OpenRouter.
    base_url = os.getenv("ANTHROPIC_BASE_URL")
    auth_token = os.getenv("ANTHROPIC_AUTH_TOKEN")
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not (auth_token or api_key):
        raise RuntimeError(
            "Set ANTHROPIC_API_KEY (native Anthropic) or ANTHROPIC_AUTH_TOKEN "
            "with ANTHROPIC_BASE_URL (OpenRouter). Copy .env.example to .env."
        )
    return Anthropic(
        api_key=api_key or None,
        auth_token=auth_token or None,
        base_url=base_url or None,
    )


@lru_cache(maxsize=16)
def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.txt").read_text()


def call(
    system: str,
    user: str,
    *,
    model: str | None = None,
    max_tokens: int = 1024,
    cache_system: bool = False,
) -> str:
    """Single-shot text completion. Returns the text body of the first content block."""
    msg = client().messages.create(
        model=model or DEFAULT_MODEL,
        max_tokens=max_tokens,
        system=(
            [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
            if cache_system
            else system
        ),
        messages=[{"role": "user", "content": user}],
    )
    return msg.content[0].text.strip()


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

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
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key."
        )
    return Anthropic()


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

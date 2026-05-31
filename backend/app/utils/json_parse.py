"""Robust JSON extraction from LLM output — the single source of this logic (DRY)."""

from __future__ import annotations

import json
import re

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def extract_json(raw: str) -> dict:
    """Extract the first balanced JSON object from possibly-fenced/prefixed text."""
    cleaned = _FENCE_RE.sub("", raw.strip())
    start = cleaned.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in model output: {raw[:200]}")
    depth = 0
    for i in range(start, len(cleaned)):
        if cleaned[i] == "{":
            depth += 1
        elif cleaned[i] == "}":
            depth -= 1
            if depth == 0:
                return json.loads(cleaned[start : i + 1])
    return json.JSONDecoder().raw_decode(cleaned[start:])[0]

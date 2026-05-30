"""Buyer-persona registry sourced from data/08_buyer_personas.csv.

The classifier prompt was rules-only — it didn't see the literal trigger
keywords (BPA-free, MRI, dad, NATO, ...) that the brief's persona CSV
defines. That left a ~20% persona misclassification rate on the eval set.

This module:
  - Loads the persona records (id, name, trigger_keywords[], marketing_opportunity, priority)
  - Counts keyword hits per persona for a free-text message
  - Exposes the data both for prompt injection and for the post-LLM reconcile step

The reconciliation strategy itself (how to combine LLM persona vs keyword
hits) lives in `agent/nodes/classify.py` — see the `reconcile_persona`
TODO there.
"""
from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
CSV_PATH = DATA / "08_buyer_personas.csv"


@dataclass(frozen=True)
class Persona:
    id: str
    name: str
    trigger_keywords: tuple[str, ...]
    recommended_messaging: str
    marketing_opportunity: str
    priority: str


def _split_keywords(raw: str) -> tuple[str, ...]:
    return tuple(k.strip().lower() for k in raw.split(",") if k.strip())


@lru_cache(maxsize=1)
def load_personas() -> tuple[Persona, ...]:
    rows: list[Persona] = []
    with CSV_PATH.open() as f:
        for r in csv.DictReader(f):
            rows.append(
                Persona(
                    id=r["persona_id"],
                    name=r["persona_name"],
                    trigger_keywords=_split_keywords(r["trigger_keywords"]),
                    recommended_messaging=r["recommended_messaging"],
                    marketing_opportunity=r["marketing_opportunity"],
                    priority=r["priority"],
                )
            )
    return tuple(rows)


def count_keyword_hits(text: str) -> dict[str, int]:
    """For each persona, count how many of its trigger keywords appear in the text.

    Match rule: case-insensitive substring, but the matched keyword must be bounded
    by non-word characters so "kid" doesn't match inside "kidney". Multi-word
    keywords (e.g. "BPA-free", "Grade 5") are matched as substrings.
    """
    lowered = text.lower()
    out: dict[str, int] = {}
    for p in load_personas():
        hits = 0
        for kw in p.trigger_keywords:
            if " " in kw or "-" in kw:
                if kw in lowered:
                    hits += 1
            else:
                if re.search(rf"\b{re.escape(kw)}\b", lowered):
                    hits += 1
        out[p.id] = hits
    return out


def format_keywords_for_prompt() -> str:
    """A compact block of `persona_id: kw1, kw2, ...` lines for the classify prompt."""
    return "\n".join(
        f"- {p.id}: {', '.join(p.trigger_keywords)}"
        for p in load_personas()
    )

"""Buyer-persona registry sourced from data/08_buyer_personas.csv (5 canonical personas)."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from functools import lru_cache

from app.core.config import get_settings


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
    path = get_settings().data_path / "08_buyer_personas.csv"
    rows: list[Persona] = []
    with path.open() as f:
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
    lowered = text.lower()
    out: dict[str, int] = {}
    for p in load_personas():
        hits = 0
        for kw in p.trigger_keywords:
            if " " in kw or "-" in kw:
                if kw in lowered:
                    hits += 1
            elif re.search(rf"\b{re.escape(kw)}\b", lowered):
                hits += 1
        out[p.id] = hits
    return out


def format_keywords_for_prompt() -> str:
    return "\n".join(f"- {p.id}: {', '.join(p.trigger_keywords)}" for p in load_personas())

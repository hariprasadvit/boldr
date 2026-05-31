"""Monthly marketing brief (offline job). Writes marketing_brief.md.

Turns clusters + persona volume into "what customers ask that isn't on your product pages".
"""

from __future__ import annotations

import asyncio
import csv
import json
from collections import Counter

from app.core.config import get_settings
from app.intelligence._io import OUTPUTS, load_run_rows, write_text
from app.llm.chat import get_chat_client


def _load_clusters() -> list[dict]:
    path = OUTPUTS / "theme_clusters.json"
    return json.loads(path.read_text()) if path.exists() else []


def _load_personas() -> dict[str, dict]:
    path = get_settings().data_path / "08_buyer_personas.csv"
    with path.open() as f:
        return {r["persona_id"]: r for r in csv.DictReader(f)}


def _faq_covered(cluster: dict, faq: str) -> bool:
    summary = (cluster.get("theme_summary") or "").lower()
    keywords = [w for w in summary.split() if len(w) >= 6]
    if not keywords:
        return False
    return sum(1 for kw in keywords if kw in faq) / len(keywords) > 0.5


async def build() -> None:
    rows = await load_run_rows()
    clusters = _load_clusters()
    personas = _load_personas()
    faq = (get_settings().data_path / "04_faq_document.txt").read_text().lower()

    persona_volume = Counter(r["buyer_persona"] for r in rows)
    gap_clusters = [c for c in clusters if c["size"] >= 2 and not _faq_covered(c, faq)]

    payload = {
        "period": "Monthly intel snapshot",
        "total_tickets": len(rows),
        "persona_volume": dict(persona_volume),
        "auto_replied": sum(1 for r in rows if r["route"] == "auto_reply"),
        "human_review": sum(1 for r in rows if r["route"] == "human_review"),
        "knowledge_gaps": sum(1 for r in rows if r["route"] == "knowledge_gap"),
        "gap_clusters": [
            {
                "theme": c["theme_label"],
                "size": c["size"],
                "summary": c["theme_summary"],
                "marketing_signal": c["marketing_signal"],
                "suggested_action": c["suggested_action"],
                "personas": c["persona_breakdown"],
                "sample_questions": c["sample_questions"][:4],
            }
            for c in gap_clusters
        ],
        "persona_marketing_map": {
            pid: {"opportunity": p["marketing_opportunity"], "priority": p["priority"]}
            for pid, p in personas.items()
        },
    }

    system = (
        "You are a senior marketing strategist writing the MONTHLY CUSTOMER INTELLIGENCE BRIEF "
        "for Boldr Supply Co. (Singapore titanium watch micro-brand). Audience: founder + marketing "
        "lead with 10 minutes. Be concrete; recommend product page changes, not abstract strategy. "
        "Quote sample customer questions verbatim where it strengthens an argument."
    )
    user = (
        "Write a markdown brief with: 1. Executive summary (3 bullets). "
        "2. 'What customers are asking that isn't on your product pages' — per gap cluster: H3 theme, "
        "1-line summary, persona mix, 1-2 verbatim samples, a concrete product-page recommendation. "
        "3. Persona shift signals. 4. Operational health (auto/human/gap rates). "
        "5. Top 3 actions for next month (verb-first). Terse, no hedging, no emoji.\n\n"
        f"DATA:\n```json\n{json.dumps(payload, indent=2)}\n```"
    )
    brief = get_chat_client().complete(system, user, max_tokens=2200)
    write_text("marketing_brief.md", brief)


async def main() -> None:
    await build()
    print("[marketing_brief] wrote marketing_brief.md")


if __name__ == "__main__":
    asyncio.run(main())

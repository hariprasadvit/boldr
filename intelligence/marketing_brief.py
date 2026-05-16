"""
Monthly marketing brief: turns clusters + persona data into "what customers ask
that isn't on your product pages" — the strategic output the brief calls for.

Inputs:
  - outputs/theme_clusters.json (from cluster_themes.py)
  - outputs/drafted_replies.csv (from batch_replay.py)
  - data/08_buyer_personas.csv (persona → marketing opportunity mapping)
  - data/04_faq_document.txt   (to detect themes already covered by FAQ)

Output:
  - outputs/marketing_brief.md
"""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

from agent.llm import call

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "outputs"


def _load_clusters() -> list[dict]:
    p = OUT / "theme_clusters.json"
    if not p.exists():
        raise SystemExit("Run intelligence/cluster_themes.py first.")
    return json.loads(p.read_text())


def _load_replies() -> list[dict]:
    with (OUT / "drafted_replies.csv").open() as f:
        return list(csv.DictReader(f))


def _load_personas() -> dict[str, dict]:
    out = {}
    with (DATA / "08_buyer_personas.csv").open() as f:
        for r in csv.DictReader(f):
            out[r["persona_id"]] = r
    return out


def _faq_corpus() -> str:
    return (DATA / "04_faq_document.txt").read_text().lower()


def _cluster_already_in_faq(cluster: dict, faq: str) -> bool:
    """A simple proxy: if the theme summary's keywords mostly appear in the FAQ, treat as covered."""
    summary = (cluster.get("theme_summary") or "").lower()
    if not summary:
        return False
    keywords = [w for w in summary.split() if len(w) >= 6]
    if not keywords:
        return False
    hits = sum(1 for kw in keywords if kw in faq)
    return hits / max(1, len(keywords)) > 0.5


def build():
    clusters = _load_clusters()
    replies = _load_replies()
    personas = _load_personas()
    faq = _faq_corpus()

    persona_volume = Counter(r["buyer_persona"] for r in replies)
    gap_clusters = [c for c in clusters if c["size"] >= 2 and not _cluster_already_in_faq(c, faq)]

    # Build a structured payload for the LLM to write the brief from
    payload = {
        "period": "Monthly intel snapshot",
        "total_tickets": len(replies),
        "persona_volume": dict(persona_volume),
        "auto_replied": sum(1 for r in replies if r["route"] == "auto_reply"),
        "human_review": sum(1 for r in replies if r["route"] == "human_review"),
        "knowledge_gaps": sum(1 for r in replies if r["route"] == "knowledge_gap"),
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
        "for Boldr Supply Co. (Singapore titanium watch micro-brand). "
        "Audience: founder + marketing lead. They have 10 minutes to read this. "
        "Be concrete, not generic. Recommend product page changes, not abstract 'comms strategy'. "
        "Quote sample customer questions verbatim where it strengthens an argument."
    )

    user = (
        "Write a markdown brief with these sections, IN THIS ORDER:\n\n"
        "1. **Executive summary** — 3 bullets. Volume + the single biggest opportunity surfaced this period.\n"
        "2. **What customers are asking that isn't on your product pages** — the headline of this brief. "
        "Use the gap_clusters payload below. For each: theme name (H3), 1-line summary, the persona mix, "
        "1-2 verbatim customer-question samples, and a CONCRETE product page / marketing recommendation. "
        "Sort by combined volume + commercial value (gifter / health_conscious typically rank higher).\n"
        "3. **Persona shift signals** — read the persona_volume against the persona_marketing_map. "
        "Which persona is over-indexing this period vs the marketing opportunity assigned to it? "
        "Recommend 1 budget reallocation.\n"
        "4. **Operational health** — auto-reply rate, human-review rate, gap rate. "
        "Brief commentary: where is the agent doing well, where is it bottlenecked.\n"
        "5. **Top 3 actions for next month** — numbered, each starting with a verb. "
        "Be specific (e.g. 'Add BPA-free badge to all 4 FKM strap product pages by Mar 31').\n\n"
        "Tone: confident, terse, no hedging. No emoji. Use markdown tables only where they add density.\n\n"
        f"DATA PAYLOAD:\n```json\n{json.dumps(payload, indent=2)}\n```\n"
    )

    print("[marketing_brief] generating brief…")
    brief = call(system=system, user=user, max_tokens=2200)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "marketing_brief.md").write_text(brief)
    print("[marketing_brief] wrote outputs/marketing_brief.md")


if __name__ == "__main__":
    build()

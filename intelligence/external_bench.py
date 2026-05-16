"""
External sentiment benchmark: align internal ticket themes with external forum/review data
from data/09_external_sentiment_data.csv.

For each shared theme, output: internal frequency, external sentiment, alignment verdict
(Boldr-specific gap vs. market-wide concern), and an actionable recommendation.

Output: outputs/external_benchmark.md (+ .json for the dashboard)
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

# Map external themes (CSV) to internal question_types / keywords
THEME_MAP = {
    "bpa_free_straps":         {"keywords": ["bpa", "BPA"], "question_types": ["materials_safety"]},
    "titanium_grade_5_vs_2":   {"keywords": ["titanium", "grade"], "question_types": ["materials_safety"]},
    "nickel_allergy_straps":   {"keywords": ["nickel", "allergy"], "question_types": ["materials_safety"]},
    "vegan_strap_options":     {"keywords": ["vegan"], "question_types": ["knowledge_gap", "materials_safety"]},
    "sustainability_carbon":   {"keywords": ["sustain", "carbon", "recycl", "vegan"], "question_types": ["knowledge_gap", "product_general"]},
    "engraving_options":       {"keywords": ["engrav"], "question_types": ["engraving"]},
    "corporate_bulk_orders":   {"keywords": ["bulk", "corporate", "wholesale"], "question_types": ["product_general"]},
    "water_resistance_real_world": {"keywords": ["water resist", "swim", "diving", "100m", "50m"], "question_types": ["materials_safety", "strap_compatibility"]},
    "strap_quick_release":     {"keywords": ["quick", "release", "swap"], "question_types": ["strap_compatibility"]},
    "after_sales_service":     {"keywords": ["service", "battery", "regulation"], "question_types": ["servicing"]},
    "shipping_customs":        {"keywords": ["customs", "duties", "import"], "question_types": ["order_status"]},
    "limited_edition_availability": {"keywords": ["limited", "ember"], "question_types": ["product_general"]},
}


def _load_external() -> list[dict]:
    with (DATA / "09_external_sentiment_data.csv").open() as f:
        return list(csv.DictReader(f))


def _load_replies() -> list[dict]:
    p = OUT / "drafted_replies.csv"
    if not p.exists():
        raise SystemExit("Run batch_replay.py first.")
    with p.open() as f:
        return list(csv.DictReader(f))


def _internal_freq(replies: list[dict], spec: dict) -> tuple[int, list[str]]:
    """Count internal tickets that match a theme's keywords or question_types."""
    matches = []
    for r in replies:
        text = f"{r.get('subject','')} {r.get('reply_draft','')}".lower()
        if any(kw.lower() in text for kw in spec["keywords"]):
            matches.append(r["ticket_id"])
        elif r.get("question_type") in spec["question_types"] and spec["question_types"]:
            # weaker — only count if keyword check failed but type matches
            pass
    return len(matches), matches[:5]


def benchmark():
    external = _load_external()
    replies = _load_replies()

    # Group external by theme
    ext_by_theme: dict[str, list[dict]] = defaultdict(list)
    for row in external:
        ext_by_theme[row["theme"]].append(row)

    rows = []
    for theme, ext_rows in ext_by_theme.items():
        spec = THEME_MAP.get(theme)
        if not spec:
            continue
        internal_count, sample_ids = _internal_freq(replies, spec)
        sentiments = Counter(e["sentiment"] for e in ext_rows)
        ext_signal = max((e["signal_strength"] for e in ext_rows), default="low")
        sample_quotes = [e["sample_quote"] for e in ext_rows[:2]]
        rows.append({
            "theme": theme,
            "internal_ticket_count": internal_count,
            "internal_sample_ids": sample_ids,
            "external_mention_count": len(ext_rows),
            "external_sentiment": dict(sentiments),
            "external_signal_strength": ext_signal,
            "external_sample_quotes": sample_quotes,
            "external_relevance_notes": [e["relevance_to_boldr"] for e in ext_rows],
        })

    rows.sort(key=lambda r: -(r["internal_ticket_count"] + r["external_mention_count"]))

    # LLM writes the verdict + action per row
    payload = json.dumps(rows, indent=2)
    print("[external_bench] generating verdicts…")
    md = call(
        system=(
            "You are a market analyst comparing internal customer signals against external forum/review sentiment "
            "for Boldr Supply Co. — a Singapore titanium watch micro-brand. "
            "Your job is to call each theme as either a BOLDR-SPECIFIC gap or a MARKET-WIDE signal Boldr can capitalise on, "
            "and recommend one concrete next action."
        ),
        user=(
            "Write a markdown brief: '# External Sentiment Benchmark'. Then a short intro paragraph (2-3 sentences) "
            "explaining what was compared (X internal themes vs Y external sources from r/Watches, WatchUSeek, Trustpilot).\n\n"
            "Then a markdown table with columns: Theme | Internal volume | External signal | Verdict | Action.\n\n"
            "After the table, expand on the TOP 3 themes (by combined signal): for each, an H3 with the theme name, "
            "1-line internal vs external comparison, 1 verbatim external quote, and a CONCRETE 1-sentence action "
            "(e.g. 'Add explicit nickel-free badge to FKM and titanium-buckle product pages').\n\n"
            "Tone: terse, no hedging. End with a single 'BOTTOM LINE' sentence.\n\n"
            f"DATA:\n```json\n{payload}\n```"
        ),
        max_tokens=2000,
    )

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "external_benchmark.md").write_text(md)
    (OUT / "external_benchmark.json").write_text(json.dumps(rows, indent=2))
    print("[external_bench] wrote outputs/external_benchmark.{md,json}")


if __name__ == "__main__":
    benchmark()

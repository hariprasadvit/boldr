"""External sentiment benchmark (offline job). Writes external_benchmark.{md,json}.

Aligns internal ticket themes with external forum/review data and asks the LLM for a
verdict (Boldr-specific gap vs market-wide signal) + action per theme.
"""

from __future__ import annotations

import asyncio
import csv
import json
from collections import Counter, defaultdict

from app.core.config import get_settings
from app.intelligence._io import load_run_rows, write_json, write_text
from app.llm.chat import get_chat_client

_SIGNAL_ORDER = {"low": 0, "medium": 1, "high": 2}

THEME_MAP = {
    "bpa_free_straps": {"keywords": ["bpa"], "question_types": ["materials_safety"]},
    "titanium_grade_5_vs_2": {
        "keywords": ["titanium", "grade"],
        "question_types": ["materials_safety"],
    },
    "nickel_allergy_straps": {
        "keywords": ["nickel", "allergy"],
        "question_types": ["materials_safety"],
    },
    "vegan_strap_options": {
        "keywords": ["vegan"],
        "question_types": ["knowledge_gap", "materials_safety"],
    },
    "sustainability_carbon": {
        "keywords": ["sustain", "carbon", "recycl", "vegan"],
        "question_types": ["knowledge_gap", "product_general"],
    },
    "engraving_options": {"keywords": ["engrav"], "question_types": ["engraving"]},
    "corporate_bulk_orders": {
        "keywords": ["bulk", "corporate", "wholesale"],
        "question_types": ["product_general"],
    },
    "water_resistance_real_world": {
        "keywords": ["water resist", "swim", "diving", "100m", "50m"],
        "question_types": ["materials_safety", "strap_compatibility"],
    },
    "strap_quick_release": {
        "keywords": ["quick", "release", "swap"],
        "question_types": ["strap_compatibility"],
    },
    "after_sales_service": {
        "keywords": ["service", "battery", "regulation"],
        "question_types": ["servicing"],
    },
    "shipping_customs": {
        "keywords": ["customs", "duties", "import"],
        "question_types": ["order_status"],
    },
    "limited_edition_availability": {
        "keywords": ["limited", "ember"],
        "question_types": ["product_general"],
    },
}


def _internal_freq(rows: list[dict], spec: dict) -> tuple[int, list[str]]:
    matches = []
    for r in rows:
        text = f"{r.get('subject', '')} {r.get('reply_draft', '')}".lower()
        if any(kw.lower() in text for kw in spec["keywords"]):
            matches.append(r["ticket_id"])
        elif spec["question_types"] and r.get("question_type") in spec["question_types"]:
            matches.append(r["ticket_id"])
    return len(matches), matches[:5]


async def benchmark() -> None:
    rows = await load_run_rows()
    with (get_settings().data_path / "09_external_sentiment_data.csv").open() as f:
        external = list(csv.DictReader(f))

    by_theme: dict[str, list[dict]] = defaultdict(list)
    for row in external:
        by_theme[row["theme"]].append(row)

    records = []
    for theme, ext_rows in by_theme.items():
        spec = THEME_MAP.get(theme)
        if not spec:
            continue
        count, sample_ids = _internal_freq(rows, spec)
        ext_signal = max(ext_rows, key=lambda e: _SIGNAL_ORDER.get(e["signal_strength"], 0))[
            "signal_strength"
        ]
        records.append(
            {
                "theme": theme,
                "internal_ticket_count": count,
                "internal_sample_ids": sample_ids,
                "external_mention_count": len(ext_rows),
                "external_sentiment": dict(Counter(e["sentiment"] for e in ext_rows)),
                "external_signal_strength": ext_signal,
                "external_sample_quotes": [e["sample_quote"] for e in ext_rows[:2]],
                "external_relevance_notes": [e["relevance_to_boldr"] for e in ext_rows],
            }
        )
    records.sort(key=lambda r: -(r["internal_ticket_count"] + r["external_mention_count"]))

    md = get_chat_client().complete(
        "You are a market analyst comparing internal customer signals against external forum/review "
        "sentiment for Boldr Supply Co. Call each theme a BOLDR-SPECIFIC gap or a MARKET-WIDE signal, "
        "and recommend one concrete action.",
        "Write '# External Sentiment Benchmark', a 2-3 sentence intro, then a table "
        "(Theme | Internal volume | External signal | Verdict | Action). Then expand the TOP 3 themes "
        "(H3 each: 1-line internal vs external, 1 verbatim quote, 1 concrete action). End with a single "
        f"'BOTTOM LINE'.\n\nDATA:\n```json\n{json.dumps(records, indent=2)}\n```",
        max_tokens=2000,
    )
    write_text("external_benchmark.md", md)
    write_json("external_benchmark.json", records)


async def main() -> None:
    await benchmark()
    print("[external_bench] wrote external_benchmark.{md,json}")


if __name__ == "__main__":
    asyncio.run(main())

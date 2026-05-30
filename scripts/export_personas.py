"""Export data/08_buyer_personas.csv → web/public/data/personas.json.

Lets the deployed TS pipeline avoid the CSV fallback path (which reads from
../data/ at runtime) and gives the dashboard a typed JSON it can consume
directly for persona cards, marketing_opportunity callouts, etc.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "08_buyer_personas.csv"
DST = ROOT / "web" / "public" / "data" / "personas.json"


def main() -> None:
    DST.parent.mkdir(parents=True, exist_ok=True)
    out = []
    with SRC.open() as f:
        for r in csv.DictReader(f):
            out.append({
                "id": r["persona_id"],
                "name": r["persona_name"],
                "trigger_keywords": [k.strip().lower() for k in r["trigger_keywords"].split(",") if k.strip()],
                "recommended_messaging": r["recommended_messaging"],
                "marketing_opportunity": r["marketing_opportunity"],
                "priority": r["priority"],
            })
    DST.write_text(json.dumps(out, indent=2))
    print(f"[export_personas] Wrote {len(out)} personas -> {DST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

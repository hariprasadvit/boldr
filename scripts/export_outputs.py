"""Convert pipeline outputs into JSON files the Next.js frontend reads.

Reads:
  - outputs/drafted_replies.csv
  - outputs/gap_log_updated.csv
  - outputs/kb_drafts/<ticket>.md
  - outputs/theme_clusters.json
  - outputs/marketing_brief.md
  - outputs/external_benchmark.{md,json}
  - outputs/run_summary.json

Writes (to web/public/data/):
  - drafted_replies.json
  - gap_log.json            (gap rows + kb_entry_draft text inlined)
  - theme_clusters.json     (passthrough)
  - marketing_brief.md      (passthrough)
  - external_benchmark.md   (passthrough)
  - external_benchmark.json (passthrough)
  - run_summary.json        (passthrough)
"""
from __future__ import annotations

import csv
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_SRC = ROOT / "outputs"
WEB_DATA = ROOT / "web" / "public" / "data"


def main() -> None:
    WEB_DATA.mkdir(parents=True, exist_ok=True)

    # drafted_replies.csv -> drafted_replies.json with numeric coercion
    replies_csv = OUT_SRC / "drafted_replies.csv"
    if replies_csv.exists():
        rows = []
        with replies_csv.open() as f:
            for r in csv.DictReader(f):
                r["kb_confidence"] = float(r.get("kb_confidence", 0) or 0)
                rows.append(r)
        (WEB_DATA / "drafted_replies.json").write_text(json.dumps(rows, indent=2))
        print(f"  drafted_replies.json: {len(rows)} tickets")

    # gap_log_updated.csv -> gap_log.json with kb_entry_draft attached
    gap_csv = OUT_SRC / "gap_log_updated.csv"
    kb_drafts_dir = OUT_SRC / "kb_drafts"
    if gap_csv.exists():
        gaps = []
        with gap_csv.open() as f:
            for r in csv.DictReader(f):
                r["kb_confidence"] = float(r.get("kb_confidence", 0) or 0)
                draft_path = kb_drafts_dir / f"{r['ticket_id']}.md"
                r["kb_entry_draft"] = draft_path.read_text() if draft_path.exists() else ""
                gaps.append(r)
        (WEB_DATA / "gap_log.json").write_text(json.dumps(gaps, indent=2))
        print(f"  gap_log.json: {len(gaps)} gaps")

    # passthrough files
    for name in [
        "theme_clusters.json",
        "marketing_brief.md",
        "external_benchmark.md",
        "external_benchmark.json",
        "run_summary.json",
    ]:
        src = OUT_SRC / name
        if src.exists():
            shutil.copy2(src, WEB_DATA / name)
            print(f"  {name}: copied")


if __name__ == "__main__":
    main()

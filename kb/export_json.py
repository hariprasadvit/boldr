"""Export KB chunks as plain JSON for the Next.js BM25 retriever.

Writes web/public/data/kb.json — array of {id, text, metadata}.
"""
from __future__ import annotations

import json
from pathlib import Path

from kb.ingest import collect_chunks

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "data" / "kb.json"


def main() -> None:
    chunks = collect_chunks()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(chunks, indent=2))
    print(f"[kb.export_json] Wrote {len(chunks)} chunks -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

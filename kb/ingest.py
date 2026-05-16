"""
Knowledge base ingest: parse FAQ + product spec + rate cards into a ChromaDB collection.

Source priority (canonical > stale): rate cards override SOP prices when both mention the same service.
We mark each chunk with `source_priority` so the search node can prefer canonical sources.
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

import chromadb
from chromadb.config import Settings

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CHROMA_DIR = ROOT / "kb" / "chroma_db"
COLLECTION = "boldr_kb"


def _chunk_faq(text: str) -> list[dict]:
    """FAQ chunks: one per Q&A pair."""
    chunks = []
    current_section = "general"
    section_re = re.compile(r"^##\s+(.+)$")
    qa_re = re.compile(r"^Q:\s*(.+?)\nA:\s*(.+?)(?=\n\nQ:|\n\n##|\Z)", re.DOTALL | re.MULTILINE)

    for line in text.splitlines():
        m = section_re.match(line)
        if m:
            current_section = m.group(1).strip().lower().replace(" & ", "_").replace(" ", "_")

    for m in qa_re.finditer(text):
        question = m.group(1).strip()
        answer = m.group(2).strip()
        # Detect which section this Q is in by walking backwards
        pos = m.start()
        section_match = None
        for sm in section_re.finditer(text[:pos]):
            section_match = sm.group(1).strip().lower().replace(" & ", "_").replace(" ", "_")
        section = section_match or "general"

        chunks.append({
            "id": f"faq::{section}::{question[:60]}",
            "text": f"Q: {question}\nA: {answer}",
            "metadata": {
                "source": "faq",
                "section": section,
                "source_priority": 2,  # canonical for FAQ topics
                "question": question,
            }
        })
    return chunks


def _chunk_rate_card(path: Path, kind: str) -> list[dict]:
    """One chunk per row of a rate card."""
    chunks = []
    with path.open() as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            text_parts = [f"{k}: {v}" for k, v in row.items() if v]
            chunks.append({
                "id": f"rate::{kind}::{i}",
                "text": f"[{kind.upper()} RATE CARD] " + " | ".join(text_parts),
                "metadata": {
                    "source": f"rate_card_{kind}",
                    "source_priority": 3,  # highest - canonical pricing
                    "kind": kind,
                }
            })
    return chunks


def _chunk_product_specs(path: Path) -> list[dict]:
    """One chunk per model + one per strap SKU."""
    chunks = []
    data = json.loads(path.read_text())
    for model in data.get("models", []):
        text = (
            f"[PRODUCT] {model['name']} ({model['sku']}) - SGD {model.get('price_sgd', 'N/A')}\n"
            + json.dumps(model, indent=2)
        )
        chunks.append({
            "id": f"product::{model['sku']}",
            "text": text,
            "metadata": {
                "source": "product_specs",
                "source_priority": 3,
                "sku": model["sku"],
                "model_name": model["name"],
            }
        })
    for strap in data.get("straps", []):
        text = f"[STRAP] {strap['type']} {strap['colour']} ({strap['sku']}) - SGD {strap['price_sgd']} - BPA-free: {strap['bpa_free']} - Compatible: {strap['compatible_with']}"
        chunks.append({
            "id": f"strap::{strap['sku']}",
            "text": text,
            "metadata": {
                "source": "product_specs",
                "source_priority": 3,
                "sku": strap["sku"],
            }
        })
    return chunks


def _chunk_sop(text: str) -> list[dict]:
    """SOP chunks - lower priority because some prices are stale."""
    chunks = []
    section_re = re.compile(r"^##\s+\d+\.\s+(.+)$", re.MULTILINE)
    splits = list(section_re.finditer(text))
    for i, m in enumerate(splits):
        title = m.group(1).strip()
        start = m.end()
        end = splits[i + 1].start() if i + 1 < len(splits) else len(text)
        body = text[start:end].strip()
        if not body:
            continue
        chunks.append({
            "id": f"sop::{i}::{title[:40]}",
            "text": f"[SOP - {title}]\n{body}",
            "metadata": {
                "source": "sop",
                "section": title,
                "source_priority": 1,  # lowest - has known stale pricing
            }
        })
    return chunks


def _chunk_existing_gaps(path: Path) -> list[dict]:
    """Already-resolved knowledge gaps become KB entries."""
    chunks = []
    with path.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("kb_draft_status", "").startswith("answered"):
                chunks.append({
                    "id": f"gap_resolved::{row['gap_id']}",
                    "text": f"[RESOLVED GAP - {row['theme']}] Question: {row['question_paraphrase']}",
                    "metadata": {
                        "source": "resolved_gap_log",
                        "gap_id": row["gap_id"],
                        "theme": row["theme"],
                        "source_priority": 2,
                    }
                })
    return chunks


def collect_chunks() -> list[dict]:
    chunks = []
    chunks += _chunk_faq((DATA / "04_faq_document.txt").read_text())
    chunks += _chunk_rate_card(DATA / "03a_rate_card_engraving.csv", "engraving")
    chunks += _chunk_rate_card(DATA / "03b_rate_card_servicing.csv", "servicing")
    chunks += _chunk_product_specs(DATA / "02_product_specs.json")
    chunks += _chunk_sop((DATA / "05a_SOP.txt").read_text())
    chunks += _chunk_existing_gaps(DATA / "07_knowledge_gap_log.csv")
    return chunks


def get_client():
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=Settings(anonymized_telemetry=False),
    )


def build():
    client = get_client()
    # Reset for idempotent runs
    try:
        client.delete_collection(COLLECTION)
    except Exception:
        pass
    coll = client.create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )

    chunks = collect_chunks()
    coll.add(
        ids=[c["id"] for c in chunks],
        documents=[c["text"] for c in chunks],
        metadatas=[c["metadata"] for c in chunks],
    )
    by_source = {}
    for c in chunks:
        by_source[c["metadata"]["source"]] = by_source.get(c["metadata"]["source"], 0) + 1
    print(f"[kb.ingest] Built '{COLLECTION}' with {len(chunks)} chunks:")
    for src, count in sorted(by_source.items()):
        print(f"  - {src}: {count}")


def get_collection():
    return get_client().get_collection(COLLECTION)


if __name__ == "__main__":
    build()

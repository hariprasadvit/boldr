"""Parse source docs into KB chunks. Ported from the legacy kb/ingest.py chunkers.

Each chunk: {id, text, source, section, source_priority, metadata}. Source priority:
3 = canonical (rate cards, product specs), 2 = FAQ/resolved gaps, 1 = SOP (stale prices).
"""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

_SECTION_RE = re.compile(r"^##\s+(.+)$")
_QA_RE = re.compile(r"^Q:\s*(.+?)\nA:\s*(.+?)(?=\n\nQ:|\n\n##|\Z)", re.DOTALL | re.MULTILINE)
_SOP_SECTION_RE = re.compile(r"^##\s+\d+\.\s+(.+)$", re.MULTILINE)


@dataclass
class Chunk:
    id: str
    text: str
    source: str
    source_priority: int
    section: str | None = None
    metadata: dict = field(default_factory=dict)


def _slug(s: str) -> str:
    return s.strip().lower().replace(" & ", "_").replace(" ", "_")


def chunk_faq(text: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    for m in _QA_RE.finditer(text):
        question, answer = m.group(1).strip(), m.group(2).strip()
        section = "general"
        for sm in _SECTION_RE.finditer(text[: m.start()]):
            section = _slug(sm.group(1))
        chunks.append(
            Chunk(
                id=f"faq::{section}::{question[:60]}",
                text=f"Q: {question}\nA: {answer}",
                source="faq",
                source_priority=2,
                section=section,
                metadata={"question": question},
            )
        )
    return chunks


def chunk_rate_card(path: Path, kind: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    with path.open() as f:
        for i, row in enumerate(csv.DictReader(f)):
            parts = [f"{k}: {v}" for k, v in row.items() if v]
            chunks.append(
                Chunk(
                    id=f"rate::{kind}::{i}",
                    text=f"[{kind.upper()} RATE CARD] " + " | ".join(parts),
                    source=f"rate_card_{kind}",
                    source_priority=3,
                    metadata={"kind": kind},
                )
            )
    return chunks


def chunk_product_specs(path: Path) -> list[Chunk]:
    chunks: list[Chunk] = []
    data = json.loads(path.read_text())
    for model in data.get("models", []):
        text = (
            f"[PRODUCT] {model['name']} ({model['sku']}) - SGD {model.get('price_sgd', 'N/A')}\n"
            + json.dumps(model, indent=2)
        )
        chunks.append(
            Chunk(
                id=f"product::{model['sku']}",
                text=text,
                source="product_specs",
                source_priority=3,
                metadata={"sku": model["sku"], "model_name": model["name"]},
            )
        )
    for strap in data.get("straps", []):
        text = (
            f"[STRAP] {strap['type']} {strap['colour']} ({strap['sku']}) - "
            f"SGD {strap['price_sgd']} - BPA-free: {strap['bpa_free']} - "
            f"Compatible: {strap['compatible_with']}"
        )
        chunks.append(
            Chunk(
                id=f"strap::{strap['sku']}",
                text=text,
                source="product_specs",
                source_priority=3,
                metadata={"sku": strap["sku"]},
            )
        )
    return chunks


def chunk_sop(text: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    splits = list(_SOP_SECTION_RE.finditer(text))
    for i, m in enumerate(splits):
        title = m.group(1).strip()
        start = m.end()
        end = splits[i + 1].start() if i + 1 < len(splits) else len(text)
        body = text[start:end].strip()
        if body:
            chunks.append(
                Chunk(
                    id=f"sop::{i}::{title[:40]}",
                    text=f"[SOP - {title}]\n{body}",
                    source="sop",
                    source_priority=1,
                    section=title,
                )
            )
    return chunks


def chunk_resolved_gaps(path: Path) -> list[Chunk]:
    chunks: list[Chunk] = []
    with path.open() as f:
        for row in csv.DictReader(f):
            if row.get("kb_draft_status", "").startswith("answered"):
                chunks.append(
                    Chunk(
                        id=f"gap_resolved::{row['gap_id']}",
                        text=f"[RESOLVED GAP - {row['theme']}] Question: {row['question_paraphrase']}",
                        source="resolved_gap_log",
                        source_priority=2,
                        metadata={"gap_id": row["gap_id"], "theme": row["theme"]},
                    )
                )
    return chunks


def collect_chunks(data_dir: Path) -> list[Chunk]:
    chunks: list[Chunk] = []
    chunks += chunk_faq((data_dir / "04_faq_document.txt").read_text())
    chunks += chunk_rate_card(data_dir / "03a_rate_card_engraving.csv", "engraving")
    chunks += chunk_rate_card(data_dir / "03b_rate_card_servicing.csv", "servicing")
    chunks += chunk_product_specs(data_dir / "02_product_specs.json")
    chunks += chunk_sop((data_dir / "05a_SOP.txt").read_text())
    chunks += chunk_resolved_gaps(data_dir / "07_knowledge_gap_log.csv")
    return chunks

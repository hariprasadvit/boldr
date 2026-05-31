"""
Theme clustering over novel-question gap_log + already-resolved tickets.

Approach:
  1. Pull all tickets from outputs/drafted_replies.csv (we have persona + question_type + KB confidence).
  2. Embed the (subject + body) of each via Chroma's existing embedder (sentence-transformers).
  3. Run AgglomerativeClustering with a distance threshold to discover natural themes.
     (HDBSCAN would be ideal but adds a fragile native dep — sklearn keeps install simple.)
  4. For each cluster, ask the LLM for a label + marketing signal.

Output: outputs/theme_clusters.json
"""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from sklearn.cluster import AgglomerativeClustering

from agent.llm import call_json, load_prompt
from kb.ingest import get_collection

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "outputs"

MAX_CLUSTERS = 10          # cap so themes stay legible for the demo
TARGET_PER_CLUSTER = 6     # k ≈ n / 6, clamped to [3, MAX_CLUSTERS]
MIN_CLUSTER_SIZE = 2       # clusters smaller than this are labelled "singleton / novel"


def _load_processed_tickets() -> list[dict]:
    path = OUT / "drafted_replies.csv"
    if not path.exists():
        raise SystemExit("Run batch_replay.py first — outputs/drafted_replies.csv missing.")
    with path.open() as f:
        return list(csv.DictReader(f))


def _embed_texts(texts: list[str]) -> np.ndarray:
    """Reuse Chroma's embedding function to avoid loading another model."""
    coll = get_collection()
    ef = coll._embedding_function  # private, but stable in current chromadb
    vecs = ef(texts)
    return np.array(vecs, dtype=np.float32)


def _cosine_distance_matrix(X: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    Xn = X / np.clip(norms, 1e-9, None)
    sim = Xn @ Xn.T
    return np.clip(1.0 - sim, 0.0, 2.0)


def cluster():
    rows = _load_processed_tickets()
    # Cluster on the CUSTOMER's words (subject + message), not the agent's reply —
    # the reply is dominated by shared greeting/sign-off boilerplate, which collapses
    # everything into one giant cluster or splits it into noise singletons.
    texts = [
        f"{r.get('subject','')} — {(r.get('message_body','') or r.get('reply_draft',''))[:400]}"
        for r in rows
    ]

    print(f"[cluster] embedding {len(texts)} tickets…")
    X = _embed_texts(texts)
    D = _cosine_distance_matrix(X)

    k = max(3, min(MAX_CLUSTERS, round(len(rows) / TARGET_PER_CLUSTER)))
    print(f"[cluster] running AgglomerativeClustering (k={k})…")
    model = AgglomerativeClustering(
        n_clusters=k,
        metric="precomputed",
        linkage="average",
    )
    labels = model.fit_predict(D)

    clusters: dict[int, list[int]] = defaultdict(list)
    for i, lbl in enumerate(labels):
        clusters[int(lbl)].append(i)

    cluster_records = []
    for cid, idxs in sorted(clusters.items(), key=lambda kv: -len(kv[1])):
        size = len(idxs)
        member_rows = [rows[i] for i in idxs]
        persona_counts = Counter(r["buyer_persona"] for r in member_rows)
        qtype_counts = Counter(r["question_type"] for r in member_rows)
        sample_questions = [r["subject"] for r in member_rows[:6]]

        if size >= MIN_CLUSTER_SIZE:
            try:
                meta = call_json(
                    system="You label clusters of customer questions for a CS analytics tool.",
                    user=load_prompt("theme_label").format(
                        questions="\n".join(f"- {q}" for q in sample_questions),
                        persona_counts=", ".join(f"{p}={c}" for p, c in persona_counts.most_common()),
                    ),
                    max_tokens=350,
                )
            except Exception as e:
                meta = {
                    "theme_label": f"Cluster {cid}",
                    "theme_summary": f"(LLM label failed: {e})",
                    "marketing_signal": "",
                    "suggested_action": "",
                }
        else:
            meta = {
                "theme_label": "Singleton / Novel",
                "theme_summary": sample_questions[0] if sample_questions else "",
                "marketing_signal": "Single occurrence — monitor for recurrence",
                "suggested_action": "",
            }

        cluster_records.append({
            "cluster_id": int(cid),
            "size": size,
            "theme_label": meta.get("theme_label", ""),
            "theme_summary": meta.get("theme_summary", ""),
            "marketing_signal": meta.get("marketing_signal", ""),
            "suggested_action": meta.get("suggested_action", ""),
            "persona_breakdown": dict(persona_counts),
            "question_type_breakdown": dict(qtype_counts),
            "sample_questions": sample_questions,
            "ticket_ids": [r["ticket_id"] for r in member_rows],
        })

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "theme_clusters.json").write_text(json.dumps(cluster_records, indent=2))
    print(f"[cluster] wrote {len(cluster_records)} clusters → outputs/theme_clusters.json")


if __name__ == "__main__":
    cluster()

"""Search KB node: vector retrieval + source-priority boost + confidence scoring."""
from __future__ import annotations

from kb.ingest import get_collection
from agent.state import TicketState

TOP_K = 5
# How much to boost canonical sources (rate cards, product specs) over stale SOP
PRIORITY_BOOST = {1: 0.0, 2: 0.05, 3: 0.10}


def run(state: TicketState) -> TicketState:
    coll = get_collection()
    query = f"{state.get('subject', '')} — {state.get('message_body', '')}"

    res = coll.query(
        query_texts=[query],
        n_results=TOP_K,
        include=["documents", "metadatas", "distances"],
    )

    docs = res["documents"][0] if res["documents"] else []
    metas = res["metadatas"][0] if res["metadatas"] else []
    dists = res["distances"][0] if res["distances"] else []

    hits = []
    for doc, meta, dist in zip(docs, metas, dists):
        # Cosine distance → similarity in [0, 1]
        sim = max(0.0, 1.0 - float(dist))
        priority = int(meta.get("source_priority", 1))
        adjusted = min(1.0, sim + PRIORITY_BOOST.get(priority, 0.0))
        hits.append({
            "id": meta.get("id") or f"{meta.get('source')}::{meta.get('section', '')}",
            "text": doc,
            "metadata": dict(meta),
            "similarity": round(sim, 3),
            "adjusted_score": round(adjusted, 3),
        })

    # Sort by adjusted score (priority-weighted)
    hits.sort(key=lambda h: h["adjusted_score"], reverse=True)

    state["kb_hits"] = hits
    state["kb_confidence"] = hits[0]["adjusted_score"] if hits else 0.0
    state["kb_top_source"] = hits[0]["metadata"].get("source", "") if hits else ""
    return state

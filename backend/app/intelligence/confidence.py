"""Confidence decomposition (explainable-AI layer).

The pipeline ROUTES on the raw ``kb_confidence`` (see agent/nodes/decide_route.py)
— that is not changed here. This module produces a *display* breakdown that
explains a ticket's confidence as a weighted sum of four signals:

    composite = 0.50·kb_similarity + 0.20·citation_coverage
              + 0.20·historical_match + 0.10·intent_certainty

Each component is tagged measured | derived so the UI can be honest: the live
pipeline measures all four; the historical batch persisted only some, so two are
reconstructed from stored signals.
"""

from __future__ import annotations

WEIGHTS: dict[str, float] = {
    "kb_similarity": 0.50,
    "citation_coverage": 0.20,
    "historical_match": 0.20,
    "intent_certainty": 0.10,
}

_LABELS = {
    "kb_similarity": "KB similarity",
    "citation_coverage": "Citation coverage",
    "historical_match": "Historical match",
    "intent_certainty": "Intent certainty",
}


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _assemble(raw: dict[str, float], measured: dict[str, bool]) -> dict:
    components = []
    for key, weight in WEIGHTS.items():
        value = _clamp01(raw.get(key, 0.0))
        components.append(
            {
                "key": key,
                "label": _LABELS[key],
                "value": round(value, 3),
                "weight": weight,
                "contribution": round(value * weight, 4),
                "measured": measured.get(key, True),
            }
        )
    composite = round(sum(c["contribution"] for c in components), 3)
    return {"components": components, "composite": composite}


def _historical_from_hits(kb_hits: list[dict]) -> float:
    """Best similarity to a learned/FAQ entry — 'have we answered this before?'"""
    learned = [
        h
        for h in kb_hits
        if "faq" in (h.get("source") or "").lower() or h.get("kind") == "gap" or h.get("gap_id")
    ]
    return max((h.get("adjusted_score", 0.0) for h in learned), default=0.0)


def from_state(final: dict) -> dict:
    """LIVE pipeline: every component measured from the final graph state."""
    kb_hits = final.get("kb_hits", []) or []
    kb_similarity = kb_hits[0].get("adjusted_score", 0.0) if kb_hits else final.get("kb_confidence", 0.0)
    citation_coverage = _clamp01(len(final.get("reply_citations", []) or []) / 2)
    historical_match = _historical_from_hits(kb_hits)
    intent_certainty = final.get("classification_confidence", 0.0) or 0.0
    return _assemble(
        {
            "kb_similarity": kb_similarity,
            "citation_coverage": citation_coverage,
            "historical_match": historical_match,
            "intent_certainty": intent_certainty,
        },
        {k: True for k in WEIGHTS},
    )


def from_run(
    *,
    kb_confidence: float | None,
    kb_top_source: str | None,
    classification_confidence: float | None,
    citation_count: int,
    escalation_flags: list[str] | None,
) -> dict:
    """HISTORICAL: KB similarity + citations are stored (measured); historical +
    intent are reconstructed from stored signals (derived)."""
    kb_sim = kb_confidence or 0.0
    citation_coverage = _clamp01(citation_count / 2)
    historical_match = kb_sim if "faq" in (kb_top_source or "").lower() else kb_sim * 0.6
    if classification_confidence is not None:
        intent_certainty = classification_confidence
        intent_measured = True
    else:
        intent_certainty = 0.3 if "classification_error" in (escalation_flags or []) else 0.85
        intent_measured = False
    return _assemble(
        {
            "kb_similarity": kb_sim,
            "citation_coverage": citation_coverage,
            "historical_match": historical_match,
            "intent_certainty": intent_certainty,
        },
        {
            "kb_similarity": True,
            "citation_coverage": True,
            "historical_match": False,
            "intent_certainty": intent_measured,
        },
    )

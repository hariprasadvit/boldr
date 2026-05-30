"""Route node: decide auto_reply vs human_review vs knowledge_gap.

This is the most consequential business-logic node. The thresholds and gating
rules below encode Boldr's risk appetite (premium brand, 3-person team).

Tweak HIGH_CONFIDENCE / GAP_THRESHOLD to change how often the agent auto-sends.
"""
from __future__ import annotations

from agent.state import TicketState

HIGH_CONFIDENCE = 0.72   # auto-reply allowed at-or-above
GAP_THRESHOLD   = 0.50   # below = treat as knowledge gap
MIN_CLASSIFICATION_CONFIDENCE = 0.55

# Flags that ALWAYS force a human (regardless of KB confidence)
HARD_HUMAN_FLAGS = {
    "angry",
    "refund_overdue",
    "fulfilment_error",
    "corporate_bulk",
    "press_media",
    "high_liability",
    "order_id_mismatch",
    "older_model",
    "classification_error",
}

# Question types that always need a human (per SOP)
HARD_HUMAN_TYPES = {
    "order_status",  # SOP: always check Shopify first
}

# Persona × question_type combinations where we tighten the bar
LIABILITY_PAIRS = {
    ("health_conscious", "materials_safety"),  # safety claims to safety-sensitive buyers
}


def run(state: TicketState) -> TicketState:
    flags = set(state.get("escalation_flags", []))
    qtype = state.get("question_type", "")
    persona = state.get("buyer_persona", "")
    confidence = state.get("kb_confidence", 0.0)
    classification_confidence = state.get("classification_confidence", 1.0)

    # Hardest gates first
    hard_flag_hit = flags & HARD_HUMAN_FLAGS
    if hard_flag_hit:
        state["route"] = "human_review"
        state["route_reason"] = f"hard escalation flag(s): {', '.join(sorted(hard_flag_hit))}"
        return state

    if qtype in HARD_HUMAN_TYPES:
        state["route"] = "human_review"
        state["route_reason"] = f"question type '{qtype}' always needs a human (SOP §5)"
        return state

    if (persona, qtype) in LIABILITY_PAIRS:
        state["route"] = "human_review"
        state["route_reason"] = f"liability pair: {persona} asking {qtype} — human-reviewed"
        return state

    if classification_confidence < MIN_CLASSIFICATION_CONFIDENCE:
        state["route"] = "human_review"
        state["route_reason"] = (
            f"classification confidence {classification_confidence:.2f} < "
            f"{MIN_CLASSIFICATION_CONFIDENCE} — draft for human"
        )
        return state

    # Confidence-based routing
    if confidence < GAP_THRESHOLD:
        state["route"] = "knowledge_gap"
        state["route_reason"] = f"KB confidence {confidence:.2f} < {GAP_THRESHOLD} — novel question"
        return state

    if confidence >= HIGH_CONFIDENCE:
        state["route"] = "auto_reply"
        state["route_reason"] = f"KB confidence {confidence:.2f} ≥ {HIGH_CONFIDENCE} — high confidence"
        return state

    # Mid-confidence: draft for human review
    state["route"] = "human_review"
    state["route_reason"] = (
        f"KB confidence {confidence:.2f} in soft band [{GAP_THRESHOLD}, {HIGH_CONFIDENCE}) — draft for human"
    )
    return state

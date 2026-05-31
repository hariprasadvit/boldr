"""Route node: auto_reply vs human_review vs knowledge_gap. Pure business logic (no I/O)."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from app.agent.state import TicketState

HIGH_CONFIDENCE = 0.72
GAP_THRESHOLD = 0.50
MIN_CLASSIFICATION_CONFIDENCE = 0.55

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
HARD_HUMAN_TYPES = {"order_status"}  # SOP: always check Shopify first
LIABILITY_PAIRS = {("health_conscious", "materials_safety")}


def run(state: TicketState, config: RunnableConfig | None = None) -> TicketState:
    flags = set(state.get("escalation_flags", []))
    qtype = state.get("question_type", "")
    persona = state.get("buyer_persona", "")
    confidence = state.get("kb_confidence", 0.0)
    cls_conf = state.get("classification_confidence", 1.0)

    if hit := flags & HARD_HUMAN_FLAGS:
        return _route(state, "human_review", f"hard escalation flag(s): {', '.join(sorted(hit))}")
    if qtype in HARD_HUMAN_TYPES:
        return _route(
            state, "human_review", f"question type '{qtype}' always needs a human (SOP §5)"
        )
    if (persona, qtype) in LIABILITY_PAIRS:
        return _route(state, "human_review", f"liability pair: {persona} asking {qtype}")
    if cls_conf < MIN_CLASSIFICATION_CONFIDENCE:
        return _route(state, "human_review", f"classification confidence {cls_conf:.2f} too low")
    if confidence < GAP_THRESHOLD:
        return _route(state, "knowledge_gap", f"KB confidence {confidence:.2f} < {GAP_THRESHOLD}")
    if confidence >= HIGH_CONFIDENCE:
        return _route(state, "auto_reply", f"KB confidence {confidence:.2f} ≥ {HIGH_CONFIDENCE}")
    return _route(
        state, "human_review", f"KB confidence {confidence:.2f} in soft band — draft for human"
    )


def _route(state: TicketState, route: str, reason: str) -> TicketState:
    state["route"] = route
    state["route_reason"] = reason
    return state

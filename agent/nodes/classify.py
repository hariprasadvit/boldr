"""Classify node: extract question_type, buyer_persona, escalation_flags."""
from __future__ import annotations

import re

from agent.llm import call_json, load_prompt
from agent.state import TicketState


def _detect_order_id_mismatch(order_id_field: str, message_body: str) -> bool:
    """Catch the gotcha tickets where the field's order_id ≠ the body's order_id."""
    if not order_id_field:
        return False
    body_ids = re.findall(r"\bBLD-\d{4,}\b", message_body)
    if not body_ids:
        return False
    return any(bid != order_id_field for bid in body_ids)


def run(state: TicketState) -> TicketState:
    prompt = load_prompt("classify").format(
        order_id=state.get("order_id", "") or "(none provided)",
        channel=state.get("channel", "email"),
        subject=state.get("subject", ""),
        message_body=state.get("message_body", ""),
    )
    try:
        result = call_json(
            system="You are a precise customer service triage classifier. Output only valid JSON.",
            user=prompt,
            max_tokens=400,
        )
    except Exception as e:
        # Fail safe: route to human review
        state["question_type"] = "product_general"
        state["buyer_persona"] = "prospect"
        state["escalation_flags"] = ["classification_error"]
        state["classification_confidence"] = 0.0
        state.setdefault("notes", []).append(f"classify error: {e}")
        return state

    state["question_type"] = result.get("question_type", "product_general")
    state["buyer_persona"] = result.get("buyer_persona", "prospect")
    flags = list(result.get("escalation_flags", []))

    # Deterministic check — don't trust the LLM to spot order-ID mismatch reliably.
    if _detect_order_id_mismatch(state.get("order_id", ""), state.get("message_body", "")):
        if "order_id_mismatch" not in flags:
            flags.append("order_id_mismatch")

    state["escalation_flags"] = flags
    state["classification_confidence"] = float(result.get("confidence", 0.7))
    return state

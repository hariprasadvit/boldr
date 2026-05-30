"""Classify node: extract question_type, buyer_persona, escalation_flags."""
from __future__ import annotations

import re
from typing import Any

from agent.llm import call_json, load_prompt
from agent.personas import count_keyword_hits, format_keywords_for_prompt
from agent.state import TicketState

VALID_QUESTION_TYPES = {
    "order_status",
    "engraving",
    "servicing",
    "strap_compatibility",
    "materials_safety",
    "product_general",
    "knowledge_gap",
}

VALID_BUYER_PERSONAS = {
    "health_conscious",
    "gifter",
    "enthusiast",
    "active",
    "sustainable",
}

VALID_ESCALATION_FLAGS = {
    "angry",
    "refund_overdue",
    "fulfilment_error",
    "corporate_bulk",
    "press_media",
    "high_liability",
    "order_id_mismatch",
    "older_model",
}


def _detect_order_id_mismatch(order_id_field: str, message_body: str) -> bool:
    """Catch the gotcha tickets where the field's order_id ≠ the body's order_id."""
    if not order_id_field:
        return False
    body_ids = re.findall(r"\bBLD-\d{4,}\b", message_body)
    if not body_ids:
        return False
    return any(bid != order_id_field for bid in body_ids)


def _clamp_confidence(value: Any) -> tuple[float, bool]:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0, False
    if confidence < 0 or confidence > 1:
        return min(1.0, max(0.0, confidence)), False
    return confidence, True


def _validate_result(result: dict[str, Any]) -> tuple[str, str, list[str], float, list[str]]:
    errors = []

    question_type = result.get("question_type")
    if question_type not in VALID_QUESTION_TYPES:
        errors.append(f"invalid question_type: {question_type!r}")
        question_type = "product_general"

    buyer_persona = result.get("buyer_persona")
    if buyer_persona not in VALID_BUYER_PERSONAS:
        errors.append(f"invalid buyer_persona: {buyer_persona!r}")
        buyer_persona = "active"

    raw_flags = result.get("escalation_flags", [])
    if not isinstance(raw_flags, list):
        errors.append("escalation_flags was not a list")
        raw_flags = []

    flags = []
    for flag in raw_flags:
        if flag in VALID_ESCALATION_FLAGS:
            flags.append(flag)
        else:
            errors.append(f"invalid escalation flag: {flag!r}")

    confidence, confidence_valid = _clamp_confidence(result.get("confidence", 0.0))
    if not confidence_valid:
        errors.append(f"invalid confidence: {result.get('confidence')!r}")

    if errors and "classification_error" not in flags:
        flags.append("classification_error")

    return question_type, buyer_persona, flags, confidence, errors


def reconcile_persona(
    llm_persona: str,
    llm_confidence: float,
    keyword_hits: dict[str, int],
    _message_body: str,
) -> tuple[str, str]:
    """Combine the LLM's persona pick with deterministic trigger-keyword hits.

    The classify prompt now sees the trigger keywords in-context (so the LLM has
    the signal), but the LLM can still go off on subtle cases. The persona CSV
    gives us a deterministic second opinion. This function decides how to merge.

    Args:
        llm_persona: persona_id the LLM picked (already validated against the enum)
        llm_confidence: LLM's self-reported confidence in [0, 1]
        keyword_hits: {persona_id: number_of_trigger_keywords_matched_in_body}
        message_body: the original ticket text (in case the strategy wants context)

    Returns:
        (final_persona_id, reason)
            final_persona_id: the persona to use downstream
            reason: short audit-trail string (goes into state.notes)

    TODO ──────────────────────────────────────────────────────────────────────
    Pick a strategy and implement the body. Three options to consider — each has
    different failure modes. The default below is a NO-OP that trusts the LLM.

    Strategy A — "Hint only" (current default):
        Trust the LLM. The keywords are already in the prompt; the LLM has the
        signal. Just return what the LLM said. Simplest, no surprises.

    Strategy B — "Hard override on dominant keyword evidence":
        If exactly one persona has hits >= 2 AND it differs from llm_persona,
        override. Catches the case where the LLM ignored the keywords.
        Risk: a single "BPA" mention could override correct persona on a
        gifter ticket. Tune the threshold.

    Strategy C — "Confidence-weighted vote":
        Score each persona as (keyword_hits[p] * 0.4) + (1.0 if p == llm_persona else 0.0) * llm_confidence.
        Pick the argmax. Soft blend — both signals matter, neither dominates.

    Whichever you pick, set `reason` so the audit trail explains the decision.
    ───────────────────────────────────────────────────────────────────────────
    """
    # Strategy C — confidence-weighted vote
    # Each persona scores: (keyword_hits * 0.4) + (llm_confidence if it is the LLM's pick else 0)
    # Ties favour the LLM's pick for stability.
    scores: dict[str, float] = {}
    for persona_id, hits in keyword_hits.items():
        score = hits * 0.4
        if persona_id == llm_persona:
            score += llm_confidence
        scores[persona_id] = score

    best = max(scores, key=lambda p: (scores[p], p == llm_persona))
    if best == llm_persona:
        return llm_persona, f"vote kept LLM (top score {scores[best]:.2f})"
    return (
        best,
        f"vote override: {best} ({scores[best]:.2f}) > LLM={llm_persona} ({scores[llm_persona]:.2f})",
    )


def run(state: TicketState) -> TicketState:
    prompt = load_prompt("classify").format(
        order_id=state.get("order_id", "") or "(none provided)",
        channel=state.get("channel", "email"),
        subject=state.get("subject", ""),
        message_body=state.get("message_body", ""),
        persona_keywords=format_keywords_for_prompt(),
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
        state["buyer_persona"] = "active"
        state["escalation_flags"] = ["classification_error"]
        state["classification_confidence"] = 0.0
        state.setdefault("notes", []).append(f"classify error: {e}")
        return state

    question_type, buyer_persona, flags, confidence, validation_errors = _validate_result(result)

    # Deterministic check — don't trust the LLM to spot order-ID mismatch reliably.
    if _detect_order_id_mismatch(state.get("order_id", ""), state.get("message_body", "")):
        if "order_id_mismatch" not in flags:
            flags.append("order_id_mismatch")

    # Reconcile the LLM's persona pick against trigger-keyword hits from the CSV.
    body_text = f"{state.get('subject', '')} {state.get('message_body', '')}"
    keyword_hits = count_keyword_hits(body_text)
    final_persona, reconcile_reason = reconcile_persona(
        buyer_persona,
        confidence,
        keyword_hits,
        body_text,
    )
    if final_persona != buyer_persona:
        state.setdefault("notes", []).append(
            f"persona reconcile: LLM={buyer_persona} → {final_persona} ({reconcile_reason})"
        )

    if validation_errors:
        state.setdefault("notes", []).append("classify validation: " + "; ".join(validation_errors))

    state["question_type"] = question_type
    state["buyer_persona"] = final_persona
    state["escalation_flags"] = flags
    state["classification_confidence"] = confidence
    state["persona_keyword_hits"] = keyword_hits  # for audit/debug + reasoning panel
    return state

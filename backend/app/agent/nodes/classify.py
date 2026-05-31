"""Classify node: question_type + persona (LLM + keyword reconcile) + escalation flags.

This is an EXTRACTION task (map a ticket onto fixed enums), not free-form
generation. It therefore uses deterministic structured output (tool-calling
via ``complete_structured``) with a Pydantic schema, falling back to the
regex-JSON path only if structured output errors. Deterministic safety nets
(persona keyword reconcile, order-id mismatch) are applied on top.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from langchain_core.runnables import RunnableConfig
from app.agent.personas import count_keyword_hits, format_keywords_for_prompt
from app.agent.runtime import deps_from_config, load_prompt
from app.agent.state import TicketState
from app.utils.ids import has_order_id_mismatch

QuestionType = Literal[
    "order_status",
    "engraving",
    "servicing",
    "strap_compatibility",
    "materials_safety",
    "product_general",
    "knowledge_gap",
]
BuyerPersona = Literal["health_conscious", "gifter", "enthusiast", "active", "sustainable"]
EscalationFlag = Literal[
    "angry",
    "refund_overdue",
    "fulfilment_error",
    "corporate_bulk",
    "press_media",
    "high_liability",
    "order_id_mismatch",
    "older_model",
]


class Classification(BaseModel):
    """Structured-output schema for ticket triage."""

    question_type: QuestionType = Field(description="The single best question category.")
    buyer_persona: BuyerPersona = Field(description="The single most likely buyer persona.")
    escalation_flags: list[EscalationFlag] = Field(
        default_factory=list,
        description="Zero or more flags that apply; empty list if none.",
    )
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in buyer_persona, from 0.0 to 1.0."
    )


VALID_QUESTION_TYPES = {
    "order_status",
    "engraving",
    "servicing",
    "strap_compatibility",
    "materials_safety",
    "product_general",
    "knowledge_gap",
}
VALID_BUYER_PERSONAS = {"health_conscious", "gifter", "enthusiast", "active", "sustainable"}
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


def _clamp_confidence(value: Any) -> tuple[float, bool]:
    try:
        c = float(value)
    except (TypeError, ValueError):
        return 0.0, False
    return (min(1.0, max(0.0, c)), False) if not 0 <= c <= 1 else (c, True)


def _validate(result: dict[str, Any]) -> tuple[str, str, list[str], float, list[str]]:
    errors: list[str] = []
    qtype = result.get("question_type")
    if qtype not in VALID_QUESTION_TYPES:
        errors.append(f"invalid question_type: {qtype!r}")
        qtype = "product_general"
    persona = result.get("buyer_persona")
    if persona not in VALID_BUYER_PERSONAS:
        errors.append(f"invalid buyer_persona: {persona!r}")
        persona = "active"
    raw_flags = result.get("escalation_flags", [])
    if not isinstance(raw_flags, list):
        errors.append("escalation_flags was not a list")
        raw_flags = []
    flags = [f for f in raw_flags if f in VALID_ESCALATION_FLAGS]
    errors += [
        f"invalid escalation flag: {f!r}" for f in raw_flags if f not in VALID_ESCALATION_FLAGS
    ]
    confidence, ok = _clamp_confidence(result.get("confidence", 0.0))
    if not ok:
        errors.append(f"invalid confidence: {result.get('confidence')!r}")
    if errors and "classification_error" not in flags:
        flags.append("classification_error")
    return qtype, persona, flags, confidence, errors


def reconcile_persona(
    llm_persona: str, llm_confidence: float, keyword_hits: dict[str, int]
) -> tuple[str, str]:
    """Confidence-weighted vote: keyword_hits*0.4 + (llm_confidence if LLM's pick). Ties favour LLM."""
    scores = {
        pid: hits * 0.4 + (llm_confidence if pid == llm_persona else 0.0)
        for pid, hits in keyword_hits.items()
    }
    if not scores:
        return llm_persona, "no keyword data — kept LLM"
    best = max(scores, key=lambda p: (scores[p], p == llm_persona))
    if best == llm_persona:
        return llm_persona, f"vote kept LLM (top {scores[best]:.2f})"
    return (
        best,
        f"vote override: {best} ({scores[best]:.2f}) > LLM={llm_persona} ({scores[llm_persona]:.2f})",
    )


_SYSTEM = "You are a precise customer service triage classifier."


def _extract(deps: Any, prompt: str) -> tuple[dict[str, Any] | None, str | None]:
    """Return (result_dict, note). Prefer structured output; fall back to JSON.

    ``note`` records when the deterministic fallback was used so it surfaces in
    the ticket's audit trail.
    """
    try:
        obj = deps.chat.complete_structured(_SYSTEM, prompt, Classification, max_tokens=400)
        return obj.model_dump(), None
    except Exception as structured_err:
        try:
            result = deps.chat.complete_json(
                _SYSTEM + " Output only valid JSON.", prompt, max_tokens=400
            )
            return result, f"classify: structured output failed ({structured_err}); used JSON"
        except Exception:
            return None, None


async def run(state: TicketState, config: RunnableConfig) -> TicketState:
    deps = deps_from_config(config)
    prompt = load_prompt("classify").format(
        order_id=state.get("order_id", "") or "(none provided)",
        channel=state.get("channel", "email"),
        subject=state.get("subject", ""),
        message_body=state.get("message_body", ""),
        persona_keywords=format_keywords_for_prompt(),
    )
    result, fallback_note = _extract(deps, prompt)
    if result is None:
        state.update(
            question_type="product_general",
            buyer_persona="active",
            escalation_flags=["classification_error"],
            classification_confidence=0.0,
        )
        state.setdefault("notes", []).append("classify error: extraction failed")
        return state
    if fallback_note:
        state.setdefault("notes", []).append(fallback_note)

    qtype, persona, flags, confidence, errs = _validate(result)
    if has_order_id_mismatch(state.get("order_id", ""), state.get("message_body", "")):
        if "order_id_mismatch" not in flags:
            flags.append("order_id_mismatch")

    body_text = f"{state.get('subject', '')} {state.get('message_body', '')}"
    hits = count_keyword_hits(body_text)
    final_persona, reason = reconcile_persona(persona, confidence, hits)
    if final_persona != persona:
        state.setdefault("notes", []).append(
            f"persona reconcile: LLM={persona} -> {final_persona} ({reason})"
        )
    if errs:
        state.setdefault("notes", []).append("classify validation: " + "; ".join(errs))

    state.update(
        question_type=qtype,
        buyer_persona=final_persona,
        escalation_flags=flags,
        classification_confidence=confidence,
        persona_keyword_hits=hits,
    )
    return state

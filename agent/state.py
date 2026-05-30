"""Shared state schema for the LangGraph pipeline."""
from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict


class TicketState(TypedDict, total=False):
    # Input
    ticket_id: str
    customer_name: str
    customer_email: str
    order_id: str
    channel: str
    subject: str
    message_body: str
    date_received: str

    # Classification (from classify node)
    question_type: str
    buyer_persona: str
    escalation_flags: list[str]
    classification_confidence: float
    persona_keyword_hits: dict[str, int]

    # KB search (from search_kb node)
    kb_hits: list[dict[str, Any]]
    kb_confidence: float
    kb_top_source: str

    # Routing (from decide_route node)
    route: Literal["auto_reply", "human_review", "knowledge_gap"]
    route_reason: str

    # Reply (from draft_reply node)
    reply_draft: str
    reply_citations: list[str]

    # Gap (from flag_gap + auto_draft_kb nodes)
    gap_paraphrase: str
    gap_theme: str
    kb_entry_draft: str

    # Diagnostic
    notes: list[str]


def make_initial_state(ticket: dict) -> TicketState:
    """Convert a CSV ticket row into a TicketState."""
    return TicketState(
        ticket_id=ticket["ticket_id"],
        customer_name=ticket.get("customer_name", ""),
        customer_email=ticket.get("customer_email", ""),
        order_id=ticket.get("order_id", "") or "",
        channel=ticket.get("channel", "email"),
        subject=ticket.get("subject", ""),
        message_body=ticket.get("message_body", ""),
        date_received=ticket.get("date_received", ""),
        notes=[],
    )

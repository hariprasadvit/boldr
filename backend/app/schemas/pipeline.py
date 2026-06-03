"""Pipeline request/response DTOs."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TicketInput(BaseModel):
    ticket_id: str | None = None
    customer_name: str = "Sample Customer"
    customer_email: str = "live@example.com"
    order_id: str = ""
    channel: str = "email"
    subject: str = ""
    message_body: str = Field(..., min_length=1)
    date_received: str = "live"


class KbHitOut(BaseModel):
    id: str
    source: str
    similarity: float
    adjusted_score: float
    text: str


class ConfidenceComponentOut(BaseModel):
    key: str
    label: str
    value: float
    weight: float
    contribution: float
    measured: bool


class ConfidenceBreakdownOut(BaseModel):
    components: list[ConfidenceComponentOut] = []
    composite: float = 0.0


class TicketCostOut(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    usd: float = 0.0
    llm_calls: int = 0


class PipelineResult(BaseModel):
    ticket_id: str
    question_type: str | None = None
    buyer_persona: str | None = None
    escalation_flags: list[str] = []
    classification_confidence: float | None = None
    kb_confidence: float | None = None
    kb_top_source: str | None = None
    route: str | None = None
    route_reason: str | None = None
    reply_draft: str | None = None
    reply_citations: list[str] = []
    open_items: list[dict] = []
    gap_paraphrase: str | None = None
    gap_theme: str | None = None
    kb_entry_draft: str | None = None
    kb_hits: list[KbHitOut] = []
    confidence_breakdown: ConfidenceBreakdownOut | None = None
    cost: TicketCostOut | None = None
    notes: list[str] = []

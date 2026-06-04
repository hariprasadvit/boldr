"""Read DTOs for tickets, runs, replies, gaps, approvals, personas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TicketOut(_ORM):
    id: uuid.UUID
    ticket_id: str
    channel: str
    subject: str
    message_body: str
    order_id: str | None = None
    date_received: str | None = None


class ReplyOut(_ORM):
    id: uuid.UUID
    run_id: uuid.UUID
    body: str
    citations: list[str]
    status: str
    created_at: datetime


class InboxReplyOut(BaseModel):
    """Flat inbox row: a drafted reply joined to its ticket + run (route/confidence/flags)."""

    id: uuid.UUID
    ticket_id: str
    subject: str
    channel: str
    body: str
    citations: list[str]
    status: str
    route: str | None = None
    route_reason: str | None = None
    buyer_persona: str | None = None
    question_type: str | None = None
    kb_confidence: float | None = None
    kb_top_source: str | None = None
    escalation_flags: list[str] = []
    open_items: list[dict] = []
    edited: bool = False
    rating: str | None = None


class GapOut(_ORM):
    id: uuid.UUID
    ticket_id: uuid.UUID
    paraphrase: str
    theme: str | None = None
    buyer_persona: str | None = None
    status: str
    kb_entry_draft: str | None = None
    kb_confidence: float | None = None
    date_first_seen: str | None = None


class RunSummaryOut(BaseModel):
    """Live run roll-up — same shape as OLD run_summary.json."""

    tickets_processed: int
    elapsed_seconds: float
    by_route: dict[str, int]
    by_persona: dict[str, int]
    by_question_type: dict[str, int]
    knowledge_gaps_detected: int


class PersonaOut(_ORM):
    persona_id: str
    name: str
    trigger_keywords: list[str]
    marketing_opportunity: str
    priority: str


class ApprovalIn(BaseModel):
    decision: str  # approved | rejected | edited
    actor: str | None = None
    comment: str | None = None


class GapResolveIn(BaseModel):
    resolution: str
    resolved_by: str | None = None


class GapPublishIn(BaseModel):
    # Optional human answer; if omitted, the gap's auto-drafted FAQ entry is published.
    answer: str | None = None
    resolved_by: str | None = None


class GapPublishOut(BaseModel):
    gap: GapOut
    published: bool
    chunk_key: str | None = None


class ReplyAnswerIn(BaseModel):
    question: str
    answer: str
    teach: bool = True  # publish this answer into the KB


class ReplyResolveIn(BaseModel):
    final_body: str  # the composed/edited final email sent to the customer
    answers: list[ReplyAnswerIn] = []  # filled-in open items
    rating: str | None = None  # "useful" | "not_useful"
    edited: bool = False  # was the draft edited before sending


class ReplyResolveOut(BaseModel):
    reply_id: uuid.UUID
    status: str
    taught: list[str] = []  # chunk_keys published to the KB


class ComposeAnswerIn(BaseModel):
    question: str
    answer: str


class ComposeReplyIn(BaseModel):
    draft: str
    answers: list[ComposeAnswerIn] = []
    channel: str = "email"


class ComposeReplyOut(BaseModel):
    body: str

"""Ticket + run/reply read endpoints (the inbox)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.api.deps import ApprovalServiceDep, SessionDep
from app.llm.chat import get_chat_client
from app.repositories.run_repo import ReplyRepository, RunRepository
from app.repositories.ticket_repo import TicketRepository
from app.schemas.resources import (
    ComposeReplyIn,
    ComposeReplyOut,
    InboxReplyOut,
    ReplyResolveIn,
    ReplyResolveOut,
    TicketOut,
)
from app.services.kb_service import KbService

router = APIRouter(prefix="/tickets", tags=["tickets"])

_COMPOSE_SYSTEM = (
    "You are a Boldr CS agent. You are given a partial drafted reply and a few "
    "additional answers the human reviewer supplied for parts the draft left open. "
    "Rewrite everything into ONE cohesive, brand-voice email that weaves the answers "
    "in naturally where they belong — do not just append them. Friendly but premium, "
    "direct, no padding. Keep the 'Hi ...' greeting and the '— Team Boldr' sign-off. "
    "Use ONLY facts from the draft and the provided answers; invent nothing. Output "
    "only the email body."
)


@router.get("", response_model=list[TicketOut])
async def list_tickets(session: SessionDep, limit: int = 200) -> list[TicketOut]:
    rows = await TicketRepository(session).list(limit=limit)
    return [TicketOut.model_validate(r) for r in rows]


@router.get("/replies", response_model=list[InboxReplyOut])
async def list_replies(
    session: SessionDep, status: str | None = None, limit: int = 200
) -> list[InboxReplyOut]:
    """Drafted replies enriched with their run (route/confidence/flags) + ticket."""
    rows = await ReplyRepository(session).list_inbox(status, limit)
    return [
        InboxReplyOut(
            id=reply.id,
            ticket_id=ticket.ticket_id,
            subject=ticket.subject,
            channel=ticket.channel,
            body=reply.body,
            citations=reply.citations,
            status=reply.status,
            route=run.route,
            route_reason=run.route_reason,
            buyer_persona=run.buyer_persona,
            question_type=run.question_type,
            kb_confidence=run.kb_confidence,
            kb_top_source=run.kb_top_source,
            escalation_flags=run.escalation_flags or [],
            open_items=reply.open_items or [],
            edited=reply.edited,
            rating=reply.rating,
        )
        for reply, run, ticket in rows
    ]


@router.post("/replies/{reply_id}/resolve", response_model=ReplyResolveOut)
async def resolve_reply(
    reply_id: uuid.UUID,
    body: ReplyResolveIn,
    service: ApprovalServiceDep,
    session: SessionDep,
) -> ReplyResolveOut:
    """Close a reviewed ticket: send the final email, record feedback, and teach the
    KB any answers the reviewer marked 'teach' — closure + learning in one action."""
    reply = await service.resolve_and_send(
        reply_id, body.final_body, rating=body.rating, edited=body.edited
    )
    kb = KbService(session)
    taught: list[str] = []
    for i, ans in enumerate(body.answers):
        if ans.teach:
            ck = await kb.publish_qa(
                ans.question, ans.answer, chunk_key=f"faq::learned::reply::{reply_id}::{i}"
            )
            if ck:
                taught.append(ck)
    return ReplyResolveOut(reply_id=reply_id, status=reply.status, taught=taught)


@router.post("/compose-reply", response_model=ComposeReplyOut)
async def compose_reply(body: ComposeReplyIn) -> ComposeReplyOut:
    """Redraft: rewrite the grounded draft + the reviewer's answers into one clean
    brand-voice email (so answers are woven in, not appended raw)."""
    if not body.answers:
        return ComposeReplyOut(body=body.draft)
    answers = "\n".join(f"- Q: {a.question}\n  A: {a.answer}" for a in body.answers)
    user = (
        f"Channel: {body.channel}\n\n"
        f"<current_draft>\n{body.draft}\n</current_draft>\n\n"
        f"<reviewer_answers>\n{answers}\n</reviewer_answers>\n\n"
        "Rewrite into one cohesive email incorporating the answers."
    )
    text = get_chat_client().complete(_COMPOSE_SYSTEM, user, max_tokens=600)
    return ComposeReplyOut(body=text.strip())


@router.get("/runs/count")
async def runs_count(session: SessionDep) -> dict:
    return {"runs": await RunRepository(session).count()}

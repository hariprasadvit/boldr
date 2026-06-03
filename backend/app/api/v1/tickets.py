"""Ticket + run/reply read endpoints (the inbox)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.api.deps import ApprovalServiceDep, SessionDep
from app.repositories.run_repo import ReplyRepository, RunRepository
from app.repositories.ticket_repo import TicketRepository
from app.schemas.resources import InboxReplyOut, ReplyResolveIn, ReplyResolveOut, TicketOut
from app.services.kb_service import KbService

router = APIRouter(prefix="/tickets", tags=["tickets"])


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


@router.get("/runs/count")
async def runs_count(session: SessionDep) -> dict:
    return {"runs": await RunRepository(session).count()}

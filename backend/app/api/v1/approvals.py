"""Approval endpoints: the human-in-the-loop gate for replies."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.api.deps import ApprovalServiceDep
from app.schemas.resources import ApprovalIn, ReplyOut

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.post("/replies/{reply_id}", response_model=ReplyOut)
async def decide_reply(
    reply_id: uuid.UUID, body: ApprovalIn, service: ApprovalServiceDep
) -> ReplyOut:
    reply = await service.decide_reply(
        reply_id, body.decision, actor=body.actor, comment=body.comment
    )
    return ReplyOut.model_validate(reply)

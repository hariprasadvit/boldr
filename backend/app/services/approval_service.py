"""Approval service: the human-in-the-loop gate (reply approval + gap resolution).

The durable queue is the DB: replies sit in status='draft' until a human approves;
gaps sit in status='open' until resolved. Every decision writes an Approval audit row.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.models.approval import Approval
from app.models.reply import Reply
from app.repositories.gap_repo import ApprovalRepository, GapRepository
from app.repositories.run_repo import ReplyRepository

_REPLY_DECISIONS = {"approved": "approved", "rejected": "rejected", "sent": "sent"}


class ApprovalService:
    def __init__(self, session: AsyncSession) -> None:
        self.replies = ReplyRepository(session)
        self.gaps = GapRepository(session)
        self.approvals = ApprovalRepository(session)

    async def decide_reply(
        self, reply_id: uuid.UUID, decision: str, actor=None, comment=None
    ) -> Reply:
        if decision not in _REPLY_DECISIONS:
            raise ValidationError(f"invalid reply decision: {decision}")
        reply = await self.replies.get(reply_id)
        if not reply:
            raise NotFoundError(f"reply {reply_id} not found")
        reply.status = _REPLY_DECISIONS[decision]
        await self.approvals.add(
            Approval(
                target_type="reply",
                target_id=reply_id,
                decision=decision,
                actor=actor,
                comment=comment,
            )
        )
        return reply

    async def resolve_gap(self, gap_id: uuid.UUID, resolution: str, resolved_by=None):
        gap = await self.gaps.get(gap_id)
        if not gap:
            raise NotFoundError(f"gap {gap_id} not found")
        gap.status = "resolved"
        gap.resolution = resolution
        gap.resolved_by = resolved_by
        await self.approvals.add(
            Approval(
                target_type="gap",
                target_id=gap_id,
                decision="approved",
                actor=resolved_by,
                comment=resolution,
            )
        )
        return gap

"""Run + reply data access."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import Row, func, select

from app.models.gap import Gap
from app.models.reply import Reply
from app.models.run import Run
from app.models.ticket import Ticket
from app.repositories.base import Repository


class RunRepository(Repository[Run]):
    model = Run

    async def list_recent(self, limit: int = 200) -> Sequence[Run]:
        stmt = select(Run).order_by(Run.created_at.desc()).limit(limit)
        return (await self.session.execute(stmt)).scalars().all()

    async def _count_by(self, column) -> dict[str, int]:
        stmt = select(column, func.count()).group_by(column)
        return {(k or "?"): n for k, n in (await self.session.execute(stmt)).all()}

    async def summary(self) -> dict:
        """Live run-summary roll-up — mirrors OLD run_summary.json semantics."""
        tickets = (
            await self.session.execute(select(func.count()).select_from(Ticket))
        ).scalar_one()
        gaps = (
            await self.session.execute(
                select(func.count()).select_from(Gap).where(Gap.status == "open")
            )
        ).scalar_one()
        return {
            "tickets_processed": tickets,
            "elapsed_seconds": 0.0,
            "by_route": await self._count_by(Run.route),
            "by_persona": await self._count_by(Run.buyer_persona),
            "by_question_type": await self._count_by(Run.question_type),
            "knowledge_gaps_detected": gaps,
        }


class ReplyRepository(Repository[Reply]):
    model = Reply

    async def list_by_status(self, status: str, limit: int = 200) -> Sequence[Reply]:
        stmt = (
            select(Reply)
            .where(Reply.status == status)
            .order_by(Reply.created_at.desc())
            .limit(limit)
        )
        return (await self.session.execute(stmt)).scalars().all()

    async def list_inbox(self, status: str | None = None, limit: int = 200) -> Sequence[Row]:
        """Drafted replies joined to their run + ticket — the flat inbox view."""
        stmt = (
            select(Reply, Run, Ticket)
            .join(Run, Reply.run_id == Run.id)
            .join(Ticket, Run.ticket_id == Ticket.id)
            .order_by(Reply.created_at.desc())
            .limit(limit)
        )
        if status:
            stmt = stmt.where(Reply.status == status)
        return (await self.session.execute(stmt)).all()

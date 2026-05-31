"""Knowledge-gap + persona + approval data access."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import Row, select

from app.models.approval import Approval
from app.models.gap import Gap
from app.models.persona import Persona
from app.models.run import Run
from app.models.ticket import Ticket
from app.repositories.base import Repository


class GapRepository(Repository[Gap]):
    model = Gap

    async def list_by_status(self, status: str, limit: int = 200) -> Sequence[Gap]:
        stmt = select(Gap).where(Gap.status == status).order_by(Gap.created_at.desc()).limit(limit)
        return (await self.session.execute(stmt)).scalars().all()

    async def list_enriched(self, status: str, limit: int = 200) -> Sequence[Row]:
        """Gaps joined to their run (kb_confidence) + ticket (date_received) — card view."""
        stmt = (
            select(Gap, Run, Ticket)
            .join(Ticket, Gap.ticket_id == Ticket.id)
            .outerjoin(Run, Gap.run_id == Run.id)
            .where(Gap.status == status)
            .order_by(Gap.created_at.desc())
            .limit(limit)
        )
        return (await self.session.execute(stmt)).all()


class PersonaRepository(Repository[Persona]):
    model = Persona

    async def upsert(self, data: dict) -> Persona:
        existing = await self.get(data["persona_id"])
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            await self.session.flush()
            return existing
        return await self.add(Persona(**data))


class ApprovalRepository(Repository[Approval]):
    model = Approval

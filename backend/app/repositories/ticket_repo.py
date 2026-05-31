"""Ticket data access."""

from __future__ import annotations

from sqlalchemy import select

from app.models.ticket import Ticket
from app.repositories.base import Repository


class TicketRepository(Repository[Ticket]):
    model = Ticket

    async def get_by_ticket_id(self, ticket_id: str) -> Ticket | None:
        stmt = select(Ticket).where(Ticket.ticket_id == ticket_id)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def upsert(self, data: dict) -> Ticket:
        existing = await self.get_by_ticket_id(data["ticket_id"])
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            await self.session.flush()
            return existing
        return await self.add(Ticket(**data))

"""Run the pipeline over all seeded tickets and persist results (needs OPENROUTER_API_KEY)."""

from __future__ import annotations

import asyncio

from app.db.session import get_sessionmaker
from app.repositories.ticket_repo import TicketRepository
from app.schemas.pipeline import TicketInput
from app.services.pipeline_service import PipelineService


async def main(limit: int | None = None) -> None:
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        tickets = await TicketRepository(session).list(limit=limit or 1000)

    routes: dict[str, int] = {}
    for i, t in enumerate(tickets, 1):
        async with sessionmaker() as session:
            service = PipelineService(session)
            result = await service.run(
                TicketInput(
                    ticket_id=t.ticket_id,
                    customer_name=t.customer_name or "",
                    order_id=t.order_id or "",
                    channel=t.channel,
                    subject=t.subject,
                    message_body=t.message_body or t.subject or "(no body)",
                    date_received=t.date_received or "",
                )
            )
            await session.commit()
        routes[result.route or "?"] = routes.get(result.route or "?", 0) + 1
        print(f"[{i}/{len(tickets)}] {t.ticket_id} -> {result.route}")
    print(f"[run_baseline] done. routes={routes}")


if __name__ == "__main__":
    import sys

    asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else None))

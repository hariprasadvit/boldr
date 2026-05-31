"""Seed tickets from data/01_customer_tickets.csv (idempotent upsert by ticket_id)."""

from __future__ import annotations

import asyncio
import csv

from app.core.config import get_settings
from app.repositories.ticket_repo import TicketRepository
from app.scripts._common import with_session


async def _seed(session) -> int:
    repo = TicketRepository(session)
    path = get_settings().data_path / "01_customer_tickets.csv"
    n = 0
    with path.open() as f:
        for r in csv.DictReader(f):
            await repo.upsert(
                {
                    "ticket_id": r["ticket_id"],
                    "channel": r.get("channel", "email"),
                    "subject": r.get("subject", ""),
                    "message_body": r.get("message_body", ""),
                    "order_id": r.get("order_id") or None,
                    "customer_name": r.get("customer_name"),
                    "customer_email": r.get("customer_email"),
                    "date_received": r.get("date_received"),
                }
            )
            n += 1
    return n


async def main() -> None:
    count = await with_session(_seed)
    print(f"[seed_tickets] upserted {count} tickets")


if __name__ == "__main__":
    asyncio.run(main())

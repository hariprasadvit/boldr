"""Shared IO for offline intelligence jobs: load runs from DB, write artifacts (DRY)."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select

from app.db.session import get_sessionmaker
from app.models.reply import Reply
from app.models.run import Run
from app.models.ticket import Ticket

OUTPUTS = Path(__file__).resolve().parents[2] / "outputs"


async def load_run_rows() -> list[dict]:
    """One row per run joined to its ticket + drafted reply — the analytics base table."""
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        stmt = (
            select(Run, Ticket, Reply)
            .join(Ticket, Run.ticket_id == Ticket.id)
            .join(Reply, Reply.run_id == Run.id, isouter=True)
        )
        rows = (await session.execute(stmt)).all()
    out: list[dict] = []
    for run, ticket, reply in rows:
        out.append(
            {
                "ticket_id": ticket.ticket_id,
                "subject": ticket.subject or "",
                "message_body": ticket.message_body or "",
                "buyer_persona": run.buyer_persona or "",
                "question_type": run.question_type or "",
                "route": run.route or "",
                "reply_draft": reply.body if reply else "",
            }
        )
    return out


def write_json(name: str, data) -> Path:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    path = OUTPUTS / name
    path.write_text(json.dumps(data, indent=2))
    return path


def write_text(name: str, text: str) -> Path:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    path = OUTPUTS / name
    path.write_text(text)
    return path

"""End-to-end: run the graph with stubbed LLM + retriever, persist, verify DB rows."""
from __future__ import annotations

import pytest
from sqlalchemy import text

from app.db.session import get_sessionmaker
from app.schemas.pipeline import TicketInput
from app.services import kb_service, pipeline_service
from tests.conftest import StubChat, stub_retrieve


@pytest.mark.asyncio
async def test_pipeline_runs_and_persists(monkeypatch):
    monkeypatch.setattr(kb_service.KbService, "build_retriever", lambda self: stub_retrieve)
    monkeypatch.setattr(pipeline_service, "get_chat_client", lambda: StubChat())

    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        service = pipeline_service.PipelineService(session)
        result = await service.run(
            TicketInput(ticket_id="E2E-TEST", subject="BPA?", message_body="Is the strap BPA-free?")
        )
        await session.commit()

    assert result.buyer_persona == "health_conscious"
    assert result.route in {"auto_reply", "human_review"}
    # Anti-hallucination: the fabricated 'ghost::id' citation must be dropped.
    assert "ghost::id" not in result.reply_citations
    assert "faq::materials::test" in result.reply_citations

    async with sessionmaker() as session:
        runs = (await session.execute(text("select count(*) from runs"))).scalar()
        replies = (await session.execute(text("select count(*) from replies"))).scalar()
    assert runs >= 1
    assert replies >= 1

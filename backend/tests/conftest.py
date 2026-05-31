"""Shared test fixtures: a stub chat client + stub retriever (no network)."""
from __future__ import annotations

import pytest

from app.db import session as db_session


@pytest.fixture(autouse=True)
def _fresh_db_engine():
    """Rebuild the cached async engine per test.

    `get_engine`/`get_sessionmaker` are lru_cached, so the asyncpg pool would bind
    to the first test's event loop and later tests hit "Future attached to a
    different loop". Clearing the caches gives each test a fresh engine in its own
    loop.
    """
    db_session.get_engine.cache_clear()
    db_session.get_sessionmaker.cache_clear()
    yield
    db_session.get_engine.cache_clear()
    db_session.get_sessionmaker.cache_clear()


class StubChat:
    """Deterministic chat client for tests — no API calls."""

    def complete(self, system: str, user: str, *, max_tokens: int = 1024) -> str:
        if "FAQ entries" in system:
            return "Q: Generic?\nA: Yes.\n\nSection: General"
        return (
            "Hi there, thanks for reaching out! The strap is BPA-free. — Team Boldr\n"
            "CITATIONS: faq::materials::test, ghost::id"
        )

    def complete_json(self, system: str, user: str, *, max_tokens: int = 1024) -> dict:
        return self._payload_for(system, user)

    def complete_structured(self, system: str, user: str, schema, *, max_tokens: int = 1024):
        """Validate the same deterministic payload into whatever Pydantic schema is asked for."""
        data = self._payload_for(system, user)
        fields = getattr(schema, "model_fields", {})
        return schema.model_validate({k: v for k, v in data.items() if k in fields})

    @staticmethod
    def _payload_for(system: str, user: str) -> dict:
        if "paraphrase" in user.lower() or "paraphrase" in system.lower():
            return {"paraphrase": "Generic question", "theme": "materials_safety"}
        return {
            "question_type": "materials_safety",
            "buyer_persona": "health_conscious",
            "escalation_flags": [],
            "confidence": 0.9,
        }


async def stub_retrieve(_query: str) -> list[dict]:
    return [
        {
            "id": "faq::materials::test",
            "text": "BPA-free strap info",
            "source": "faq",
            "source_priority": 2,
            "similarity": 0.8,
            "adjusted_score": 0.85,
            "metadata": {},
        }
    ]


@pytest.fixture
def stub_chat() -> StubChat:
    return StubChat()

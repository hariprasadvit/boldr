"""End-to-end API tests against the real FastAPI app + Postgres.

The LLM is stubbed (no network / no API key needed) by overriding the chat client
and KB retriever; everything else — routing, persistence, HTTP contracts, the
human-approval gate, and the self-improving gap loop — exercises the real stack.
"""
from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import kb_service, pipeline_service
from tests.conftest import StubChat, stub_retrieve


@pytest.fixture
def client(monkeypatch) -> TestClient:
    monkeypatch.setattr(kb_service.KbService, "build_retriever", lambda self: stub_retrieve)
    monkeypatch.setattr(pipeline_service, "get_chat_client", lambda: StubChat())
    return TestClient(app)


@pytest.fixture
async def aclient(monkeypatch):
    """Async HTTP client running the app in the test's own event loop.

    Required for endpoints that drive the LangGraph pipeline: the graph spawns
    sub-tasks, and the sync TestClient's portal loop would mismatch the asyncpg
    pool. ASGITransport keeps request + DB + graph in one loop.
    """
    monkeypatch.setattr(kb_service.KbService, "build_retriever", lambda self: stub_retrieve)
    monkeypatch.setattr(pipeline_service, "get_chat_client", lambda: StubChat())
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def test_health(client: TestClient):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_db(client: TestClient):
    r = client.get("/api/v1/health/db")
    assert r.status_code == 200
    assert r.json()["db"] == "reachable"


def test_personas_seeded(client: TestClient):
    r = client.get("/api/v1/intelligence/personas")
    assert r.status_code == 200
    ids = {p["persona_id"] for p in r.json()}
    assert ids == {"health_conscious", "gifter", "enthusiast", "active", "sustainable"}


def test_tickets_listed(client: TestClient):
    r = client.get("/api/v1/tickets")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_pipeline_run_persists_and_returns_contract(aclient):
    payload = {"ticket_id": "API-E2E-1", "subject": "BPA?", "message_body": "Is the strap BPA-free?"}
    r = await aclient.post("/api/v1/pipeline/run", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["ticket_id"] == "API-E2E-1"
    assert body["buyer_persona"] == "health_conscious"
    assert body["route"] in {"auto_reply", "human_review", "knowledge_gap"}
    # Anti-hallucination: fabricated citation dropped, real one kept.
    assert "ghost::id" not in body["reply_citations"]
    assert "faq::materials::test" in body["reply_citations"]


def test_pipeline_validation_rejects_empty_body(client: TestClient):
    r = client.post("/api/v1/pipeline/run", json={"subject": "x"})
    assert r.status_code == 422  # message_body is required


async def test_inbox_reply_exposes_route_fields(aclient):
    # Run one ticket, then confirm the inbox reply row carries route/confidence/flags.
    await aclient.post(
        "/api/v1/pipeline/run",
        json={"ticket_id": "API-E2E-INBOX", "subject": "BPA?", "message_body": "BPA-free strap?"},
    )
    r = await aclient.get("/api/v1/tickets/replies")
    assert r.status_code == 200
    rows = r.json()
    assert rows, "expected at least one drafted reply"
    sample = rows[0]
    for field in ("ticket_id", "route", "kb_confidence", "escalation_flags"):
        assert field in sample


async def test_approval_gate_transitions_reply_status(aclient):
    await aclient.post(
        "/api/v1/pipeline/run",
        json={"ticket_id": "API-E2E-APPR", "subject": "BPA?", "message_body": "BPA-free?"},
    )
    drafts = (await aclient.get("/api/v1/tickets/replies?status=draft")).json()
    if not drafts:
        pytest.skip("ticket auto-replied; no draft to approve in this run")
    reply_id = drafts[0]["id"]
    r = await aclient.post(f"/api/v1/approvals/replies/{reply_id}", json={"decision": "approved"})
    assert r.status_code == 200
    assert r.json()["status"] == "approved"


def test_gaps_endpoint_shape(client: TestClient):
    r = client.get("/api/v1/gaps?status=open")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_intelligence_artifacts_endpoints(client: TestClient):
    assert client.get("/api/v1/intelligence/themes").status_code == 200
    assert client.get("/api/v1/intelligence/marketing-brief").status_code == 200
    assert client.get("/api/v1/intelligence/external-bench").status_code == 200

"""Unit tests for pure helpers (no DB, no network)."""
from __future__ import annotations

from app.agent.nodes.classify import reconcile_persona
from app.agent.nodes.decide_route import run as route_run
from app.utils.ids import has_order_id_mismatch
from app.utils.json_parse import extract_json


def test_extract_json_handles_fences_and_prose():
    assert extract_json('prefix ```json\n{"a": 1}\n``` suffix') == {"a": 1}
    assert extract_json('{"nested": {"b": 2}} trailing') == {"nested": {"b": 2}}


def test_order_id_mismatch():
    assert has_order_id_mismatch("BLD-1001", "my order BLD-2002 is late") is True
    assert has_order_id_mismatch("BLD-1001", "order BLD-1001 update?") is False
    assert has_order_id_mismatch("AB-12345", "ref XY-99999 please") is True
    assert has_order_id_mismatch("", "BLD-2002") is False


def test_reconcile_persona_keyword_override():
    hits = {"health_conscious": 3, "gifter": 0, "active": 0}
    final, _ = reconcile_persona("active", 0.5, hits)
    assert final == "health_conscious"


def test_reconcile_persona_keeps_llm_when_no_strong_signal():
    hits = {"health_conscious": 0, "gifter": 0, "active": 1}
    final, _ = reconcile_persona("active", 0.9, hits)
    assert final == "active"


def test_decide_route_hard_flag_forces_human():
    state = {"escalation_flags": ["angry"], "kb_confidence": 0.99}
    assert route_run(state)["route"] == "human_review"


def test_decide_route_auto_reply_on_high_confidence():
    state = {"escalation_flags": [], "question_type": "engraving",
             "buyer_persona": "gifter", "kb_confidence": 0.9, "classification_confidence": 0.9}
    assert route_run(state)["route"] == "auto_reply"


def test_decide_route_gap_on_low_confidence():
    state = {"escalation_flags": [], "question_type": "product_general",
             "buyer_persona": "active", "kb_confidence": 0.2, "classification_confidence": 0.9}
    assert route_run(state)["route"] == "knowledge_gap"

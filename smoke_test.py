"""
Non-LLM smoke test. Validates wiring of:
  - KB ingest + search (uses local sentence-transformer embeddings; no API key needed)
  - Routing logic (pure function, no LLM)
  - State schema + graph compile

Does NOT call Anthropic. To validate the LLM-dependent nodes (classify, draft_reply, etc.),
add ANTHROPIC_API_KEY to .env and run `python batch_replay.py 3`.
"""
from __future__ import annotations

from agent.graph import compiled
from agent.nodes import decide_route, search_kb
from agent.state import TicketState, make_initial_state


def test_kb_search():
    state: TicketState = {
        "subject": "Is the strap BPA-free?",
        "message_body": "Hi, I'm buying this for my young daughter and want to make sure the strap is BPA-free.",
    }
    out = search_kb.run(state)
    hits = out.get("kb_hits", [])
    assert len(hits) > 0, "expected at least one KB hit"
    top = hits[0]
    assert "bpa" in top["text"].lower(), f"expected BPA-relevant top hit; got: {top['text'][:100]}"
    print(f"  ✓ KB search top hit: {top['metadata'].get('source')} (sim={top['similarity']:.2f}, adj={top['adjusted_score']:.2f})")
    return out


def test_routing_branches():
    cases = [
        # (state, expected_route, label)
        ({"escalation_flags": ["angry"], "kb_confidence": 0.9, "question_type": "product_general", "buyer_persona": "active"},
         "human_review", "angry → human"),
        ({"escalation_flags": ["order_id_mismatch"], "kb_confidence": 0.8, "question_type": "order_status", "buyer_persona": "active"},
         "human_review", "order_id mismatch → human"),
        ({"escalation_flags": [], "kb_confidence": 0.85, "question_type": "engraving", "buyer_persona": "gifter"},
         "auto_reply", "high confidence engraving → auto"),
        ({"escalation_flags": [], "kb_confidence": 0.30, "question_type": "knowledge_gap", "buyer_persona": "sustainable"},
         "knowledge_gap", "low confidence → gap"),
        ({"escalation_flags": [], "kb_confidence": 0.85, "question_type": "materials_safety", "buyer_persona": "health_conscious"},
         "human_review", "health × safety → human (liability pair)"),
        ({"escalation_flags": [], "kb_confidence": 0.85, "question_type": "order_status", "buyer_persona": "active"},
         "human_review", "order_status always → human"),
        ({"escalation_flags": [], "kb_confidence": 0.60, "question_type": "engraving", "buyer_persona": "gifter"},
         "human_review", "mid-band → human review"),
        ({"escalation_flags": [], "classification_confidence": 0.30, "kb_confidence": 0.90, "question_type": "engraving", "buyer_persona": "gifter"},
         "human_review", "low classification confidence → human review"),
    ]
    for state, expected, label in cases:
        out = decide_route.run(dict(state))
        actual = out["route"]
        ok = "✓" if actual == expected else "✗"
        print(f"  {ok} {label:50s}  → {actual}  ({out['route_reason']})")
        assert actual == expected, f"FAILED: {label}"


def test_graph_compiles():
    g = compiled()
    assert g is not None
    print(f"  ✓ LangGraph compiled — nodes: {list(g.nodes.keys())}")


def test_order_id_mismatch_detection():
    from agent.nodes.classify import _detect_order_id_mismatch
    assert _detect_order_id_mismatch("BLD-76540", "I placed order BLD-93810 about 10 days ago") is True
    assert _detect_order_id_mismatch("BLD-76540", "I placed order BLD-76540 about 10 days ago") is False
    assert _detect_order_id_mismatch("", "no order id in field") is False
    print("  ✓ order_id mismatch detector handles all cases")


def test_classification_validation():
    from agent.nodes.classify import _validate_result

    qtype, persona, flags, confidence, errors = _validate_result({
        "question_type": "unknown",
        "buyer_persona": "active",
        "escalation_flags": ["angry", "made_up_flag"],
        "confidence": 1.4,
    })

    assert qtype == "product_general"
    assert persona == "active"
    assert confidence == 1.0
    assert "angry" in flags
    assert "classification_error" in flags
    assert errors
    print("  ✓ classifier JSON validation fails closed")


if __name__ == "__main__":
    print("=== Boldr Intel — non-LLM smoke test ===\n")
    print("[1/5] KB search…")
    test_kb_search()
    print("\n[2/5] Routing branches…")
    test_routing_branches()
    print("\n[3/5] Graph compile…")
    test_graph_compiles()
    print("\n[4/5] order_id mismatch detector…")
    test_order_id_mismatch_detection()
    print("\n[5/5] classifier JSON validation…")
    test_classification_validation()
    print("\n✓ All non-LLM checks passed. Drop ANTHROPIC_API_KEY into .env to run the full pipeline.")

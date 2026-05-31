"""Draft reply node: generates a brand-voice reply grounded in retrieved KB chunks.

Two guardrails beyond the prompt:
  1. Escalation flags (esp. order_id_mismatch) are passed in so the model surfaces
     conflicts instead of silently picking one.
  2. Self-reported citations are verified against the chunks actually retrieved;
     fabricated citation IDs are dropped.
"""
from __future__ import annotations

from agent.llm import call, load_prompt
from agent.state import TicketState

MAX_KB_CHARS = 6000  # bound the prompt size


def _format_kb(hits: list[dict]) -> str:
    blocks = []
    used = 0
    for h in hits:
        chunk_id = h.get("id") or h["metadata"].get("source", "unknown")
        text = h["text"]
        block = f"[{chunk_id} | source={h['metadata'].get('source')} | priority={h['metadata'].get('source_priority')}]\n{text}\n"
        if used + len(block) > MAX_KB_CHARS:
            break
        blocks.append(block)
        used += len(block)
    return "\n".join(blocks) if blocks else "(no KB hits)"


def _valid_citation_ids(hits: list[dict]) -> set[str]:
    ids = set()
    for h in hits:
        cid = h.get("id") or h["metadata"].get("source")
        if cid:
            ids.add(str(cid).strip())
    return ids


def run(state: TicketState) -> TicketState:
    name = (state.get("customer_name") or "").split(" ")[0] or "there"
    hits = state.get("kb_hits", [])
    kb_context = _format_kb(hits)
    flags = state.get("escalation_flags", [])

    user_prompt = load_prompt("draft_reply").format(
        kb_context=kb_context,
        customer_name_first=name,
        customer_name=state.get("customer_name", ""),
        channel=state.get("channel", "email"),
        order_id=state.get("order_id") or "(none)",
        subject=state.get("subject", ""),
        message_body=state.get("message_body", ""),
        escalation_flags=", ".join(flags) if flags else "(none)",
    )

    text = call(
        system="You are a Boldr CS agent drafting a reply. Follow the brand voice and source-priority rules exactly.",
        user=user_prompt,
        max_tokens=600,
    )

    if "CITATIONS:" in text:
        body, _, citations = text.rpartition("CITATIONS:")
        raw_cites = [c.strip() for c in citations.split(",") if c.strip() and c.strip().lower() != "none"]
    else:
        body = text
        raw_cites = []

    # Anti-hallucination: keep only citations that match a retrieved chunk.
    valid = _valid_citation_ids(hits)
    cites = [c for c in raw_cites if c in valid]
    dropped = [c for c in raw_cites if c not in valid]
    if dropped:
        state.setdefault("notes", []).append(
            f"dropped {len(dropped)} unverified citation(s): {', '.join(dropped)}"
        )

    state["reply_draft"] = body.strip()
    state["reply_citations"] = cites
    return state

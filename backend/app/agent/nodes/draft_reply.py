"""Draft reply node: brand-voice reply grounded in KB chunks, with citation verification."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from app.agent.runtime import deps_from_config, load_prompt
from app.agent.state import TicketState

MAX_KB_CHARS = 6000


def _format_kb(hits: list[dict]) -> str:
    blocks, used = [], 0
    for h in hits:
        cid = h.get("id") or h.get("source", "unknown")
        block = f"[{cid} | source={h.get('source')} | priority={h.get('source_priority')}]\n{h['text']}\n"
        if used + len(block) > MAX_KB_CHARS:
            break
        blocks.append(block)
        used += len(block)
    return "\n".join(blocks) if blocks else "(no KB hits)"


def _valid_ids(hits: list[dict]) -> set[str]:
    return {
        str(h.get("id") or h.get("source")).strip()
        for h in hits
        if (h.get("id") or h.get("source"))
    }


async def run(state: TicketState, config: RunnableConfig) -> TicketState:
    deps = deps_from_config(config)
    hits = state.get("kb_hits", [])
    name = (state.get("customer_name") or "").split(" ")[0] or "there"
    flags = state.get("escalation_flags", [])

    prompt = load_prompt("draft_reply").format(
        kb_context=_format_kb(hits),
        customer_name_first=name,
        customer_name=state.get("customer_name", ""),
        channel=state.get("channel", "email"),
        order_id=state.get("order_id") or "(none)",
        subject=state.get("subject", ""),
        message_body=state.get("message_body", ""),
        escalation_flags=", ".join(flags) if flags else "(none)",
    )
    text = deps.chat.complete(
        "You are a Boldr CS agent drafting a reply. Follow the brand voice and "
        "source-priority rules exactly.",
        prompt,
        max_tokens=600,
    )

    if "CITATIONS:" in text:
        body, _, cite_str = text.rpartition("CITATIONS:")
        raw = [c.strip() for c in cite_str.split(",") if c.strip() and c.strip().lower() != "none"]
    else:
        body, raw = text, []

    valid = _valid_ids(hits)
    cites = [c for c in raw if c in valid]
    if dropped := [c for c in raw if c not in valid]:
        state.setdefault("notes", []).append(
            f"dropped {len(dropped)} unverified citation(s): {', '.join(dropped)}"
        )

    state["reply_draft"] = body.strip()
    state["reply_citations"] = cites
    return state

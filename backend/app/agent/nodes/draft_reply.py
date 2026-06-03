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

    # Split off OPEN_ITEMS first, then CITATIONS; the body is what remains.
    rest, open_items = _parse_open_items(text)
    if "CITATIONS:" in rest:
        body, _, cite_str = rest.rpartition("CITATIONS:")
        raw = [c.strip() for c in cite_str.split(",") if c.strip() and c.strip().lower() != "none"]
    else:
        body, raw = rest, []

    valid = _valid_ids(hits)
    cites = [c for c in raw if c in valid]
    if dropped := [c for c in raw if c not in valid]:
        state.setdefault("notes", []).append(
            f"dropped {len(dropped)} unverified citation(s): {', '.join(dropped)}"
        )

    state["reply_draft"] = body.strip()
    state["reply_citations"] = cites
    state["open_items"] = open_items

    # A reply with unanswered sub-questions must never auto-send — a human fills the
    # open items first. Downgrade an auto_reply to human_review.
    if open_items and state.get("route") == "auto_reply":
        state["route"] = "human_review"
        state["route_reason"] = f"{len(open_items)} open item(s) need human input before sending"

    return state


def _parse_open_items(text: str) -> tuple[str, list[dict]]:
    """Return (text_without_open_items, [{question, reason}, ...])."""
    if "OPEN_ITEMS:" not in text:
        return text, []
    rest, _, open_str = text.rpartition("OPEN_ITEMS:")
    items: list[dict] = []
    for raw_line in open_str.splitlines():
        line = raw_line.strip().lstrip("-•").strip()
        if not line or line.lower() == "none":
            continue
        question, sep, reason = line.partition("|")
        items.append({"question": question.strip(), "reason": reason.strip() if sep else ""})
    return rest, items

"""Auto-draft KB entry node: produces a Boldr-format FAQ entry for 1-click approval."""
from __future__ import annotations

from agent.llm import call, load_prompt
from agent.state import TicketState


def run(state: TicketState) -> TicketState:
    prompt = load_prompt("kb_entry").format(
        message_body=state.get("message_body", ""),
        theme=state.get("gap_theme", "other"),
        persona=state.get("buyer_persona", ""),
    )
    try:
        text = call(
            system="You draft FAQ entries for the Boldr knowledge base in their exact format.",
            user=prompt,
            max_tokens=400,
        )
        state["kb_entry_draft"] = text.strip()
    except Exception as e:
        state["kb_entry_draft"] = ""
        state.setdefault("notes", []).append(f"auto_draft_kb error: {e}")
    return state

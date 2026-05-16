"""Flag gap node: paraphrase + theme tag for a novel question."""
from __future__ import annotations

from agent.llm import call_json
from agent.state import TicketState


def run(state: TicketState) -> TicketState:
    prompt = (
        "A customer asked something not covered by our knowledge base. "
        "Paraphrase the question generically (strip personal details) and tag the theme.\n\n"
        f"Customer message: {state.get('message_body', '')}\n"
        f"Buyer persona (already tagged): {state.get('buyer_persona', '')}\n\n"
        "Themes to choose from: materials_safety, sustainability, product_specs, niche_use_case, "
        "engraving, sales, servicing, sizing, gifting, other.\n\n"
        "Return JSON only:\n"
        '{"paraphrase": "<generic question>", "theme": "<one theme>"}'
    )
    try:
        result = call_json(
            system="You paraphrase customer questions for a knowledge gap log. Output only JSON.",
            user=prompt,
            max_tokens=200,
        )
        state["gap_paraphrase"] = result.get("paraphrase", state.get("subject", ""))
        state["gap_theme"] = result.get("theme", "other")
    except Exception as e:
        state["gap_paraphrase"] = state.get("subject", "")
        state["gap_theme"] = "other"
        state.setdefault("notes", []).append(f"flag_gap error: {e}")
    return state

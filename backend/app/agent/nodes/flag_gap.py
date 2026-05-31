"""Flag-gap + auto-draft-KB nodes for novel questions.

``flag_gap`` is EXTRACTION (paraphrase + pick one theme enum) so it uses
deterministic structured output with a JSON fallback. ``auto_draft_kb`` is
constrained GENERATION (write an FAQ entry) so it stays free-form.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from langchain_core.runnables import RunnableConfig
from app.agent.runtime import deps_from_config, load_prompt
from app.agent.state import TicketState

Theme = Literal[
    "materials_safety",
    "sustainability",
    "product_specs",
    "niche_use_case",
    "engraving",
    "sales",
    "servicing",
    "sizing",
    "gifting",
    "other",
]
_THEMES = ", ".join(Theme.__args__)
_GAP_SYSTEM = "You paraphrase customer questions for a knowledge gap log."


class GapTag(BaseModel):
    """Structured-output schema for a knowledge-gap log entry."""

    paraphrase: str = Field(
        description="The question rewritten generically, with all personal details removed."
    )
    theme: Theme = Field(description="The single best-fitting theme.")


def _gap_prompt(state: TicketState) -> str:
    return (
        "A customer asked something our knowledge base does not cover. Rewrite their "
        "question generically (strip names, order numbers, and other personal details) "
        "and tag the single best theme.\n\n"
        "<customer_message>\n"
        f"{state.get('message_body', '')}\n"
        "</customer_message>\n\n"
        f"<buyer_persona>{state.get('buyer_persona', '')}</buyer_persona>\n\n"
        f"<themes>{_THEMES}</themes>"
    )


async def flag_gap(state: TicketState, config: RunnableConfig) -> TicketState:
    deps = deps_from_config(config)
    prompt = _gap_prompt(state)
    try:
        result = deps.chat.complete_structured(_GAP_SYSTEM, prompt, GapTag, max_tokens=200)
        state["gap_paraphrase"] = result.paraphrase or state.get("subject", "")
        state["gap_theme"] = result.theme
        return state
    except Exception as structured_err:
        try:
            result = deps.chat.complete_json(
                _GAP_SYSTEM + " Output only JSON.", prompt, max_tokens=200
            )
            state["gap_paraphrase"] = result.get("paraphrase", state.get("subject", ""))
            state["gap_theme"] = result.get("theme", "other")
            state.setdefault("notes", []).append(
                f"flag_gap: structured output failed ({structured_err}); used JSON"
            )
        except Exception as e:
            state["gap_paraphrase"] = state.get("subject", "")
            state["gap_theme"] = "other"
            state.setdefault("notes", []).append(f"flag_gap error: {e}")
    return state


async def auto_draft_kb(state: TicketState, config: RunnableConfig) -> TicketState:
    deps = deps_from_config(config)
    prompt = load_prompt("kb_entry").format(
        message_body=state.get("message_body", ""),
        theme=state.get("gap_theme", "other"),
        persona=state.get("buyer_persona", ""),
    )
    try:
        state["kb_entry_draft"] = deps.chat.complete(
            "You draft FAQ entries for the Boldr knowledge base in their exact format.",
            prompt,
            max_tokens=400,
        ).strip()
    except Exception as e:
        state["kb_entry_draft"] = ""
        state.setdefault("notes", []).append(f"auto_draft_kb error: {e}")
    return state

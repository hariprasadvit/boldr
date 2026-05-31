"""Search KB node: retrieve top hits via the injected async retriever."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from app.agent.runtime import deps_from_config
from app.agent.state import TicketState


async def run(state: TicketState, config: RunnableConfig) -> TicketState:
    deps = deps_from_config(config)
    query = f"{state.get('subject', '')} — {state.get('message_body', '')}"
    hits = await deps.retrieve(query)
    state["kb_hits"] = hits
    state["kb_confidence"] = hits[0]["adjusted_score"] if hits else 0.0
    state["kb_top_source"] = hits[0]["source"] if hits else ""
    return state

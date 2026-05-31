"""LangGraph wiring of the intelligence loop (async nodes, deps via config)."""

from __future__ import annotations

from functools import lru_cache

from langgraph.graph import END, StateGraph

from app.agent.nodes import classify, decide_route, draft_reply, flag_gap, search_kb
from app.agent.state import TicketState


def _route_branch(state: TicketState) -> str:
    return state.get("route", "human_review")


@lru_cache(maxsize=1)
def compiled():
    g = StateGraph(TicketState)
    g.add_node("classify", classify.run)
    g.add_node("search_kb", search_kb.run)
    g.add_node("decide_route", decide_route.run)
    g.add_node("draft_reply", draft_reply.run)
    g.add_node("flag_gap", flag_gap.flag_gap)
    g.add_node("auto_draft_kb", flag_gap.auto_draft_kb)

    g.set_entry_point("classify")
    g.add_edge("classify", "search_kb")
    g.add_edge("search_kb", "decide_route")
    g.add_conditional_edges(
        "decide_route",
        _route_branch,
        {"auto_reply": "draft_reply", "human_review": "draft_reply", "knowledge_gap": "flag_gap"},
    )
    g.add_edge("draft_reply", END)
    g.add_edge("flag_gap", "auto_draft_kb")
    g.add_edge("auto_draft_kb", END)
    return g.compile()

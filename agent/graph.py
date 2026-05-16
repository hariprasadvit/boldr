"""
LangGraph wiring of the self-improving intelligence loop.

Flow (matches the brief diagram):

  classify ─► search_kb ─► decide_route ─┬─► auto_reply  ──► draft_reply ──► END
                                          ├─► human_review ─► draft_reply ──► END
                                          └─► knowledge_gap ► flag_gap ─► auto_draft_kb ─► END
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from agent.nodes import auto_draft_kb, classify, decide_route, draft_reply, flag_gap, search_kb
from agent.state import TicketState


def _route_branch(state: TicketState) -> str:
    return state.get("route", "human_review")


def build():
    g = StateGraph(TicketState)
    g.add_node("classify", classify.run)
    g.add_node("search_kb", search_kb.run)
    g.add_node("decide_route", decide_route.run)
    g.add_node("draft_reply", draft_reply.run)
    g.add_node("flag_gap", flag_gap.run)
    g.add_node("auto_draft_kb", auto_draft_kb.run)

    g.set_entry_point("classify")
    g.add_edge("classify", "search_kb")
    g.add_edge("search_kb", "decide_route")

    g.add_conditional_edges(
        "decide_route",
        _route_branch,
        {
            "auto_reply": "draft_reply",
            "human_review": "draft_reply",
            "knowledge_gap": "flag_gap",
        },
    )
    g.add_edge("draft_reply", END)
    g.add_edge("flag_gap", "auto_draft_kb")
    g.add_edge("auto_draft_kb", END)

    return g.compile()


_compiled = None


def compiled():
    global _compiled
    if _compiled is None:
        _compiled = build()
    return _compiled

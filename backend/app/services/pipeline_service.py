"""Pipeline service: run the LangGraph engine for a ticket and persist the outcome.

Orchestration only — delegates retrieval to KbService, LLM to the chat client, and
persistence to repositories. Drafted replies are saved with status='draft' (the durable
human-approval queue); novel questions become 'open' gaps.
"""

from __future__ import annotations

from langchain_core.callbacks import get_usage_metadata_callback
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.graph import compiled
from app.agent.runtime import AgentDeps
from app.agent.state import make_initial_state
from app.core.config import get_settings
from app.intelligence import confidence as confidence_mod
from app.intelligence.economics import usd_for_tokens
from app.llm.chat import get_chat_client
from app.models.gap import Gap
from app.models.reply import Reply
from app.models.run import Run
from app.repositories.gap_repo import GapRepository
from app.repositories.run_repo import ReplyRepository, RunRepository
from app.repositories.ticket_repo import TicketRepository
from app.schemas.pipeline import (
    ConfidenceBreakdownOut,
    KbHitOut,
    PipelineResult,
    TicketCostOut,
    TicketInput,
)
from app.services.kb_service import KbService


class PipelineService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.tickets = TicketRepository(session)
        self.runs = RunRepository(session)
        self.replies = ReplyRepository(session)
        self.gaps = GapRepository(session)
        self.chat = get_chat_client()

    async def run(self, ticket: TicketInput) -> PipelineResult:
        ticket_id = ticket.ticket_id or f"LIVE-{abs(hash(ticket.message_body)) % 10_000_000}"
        data = ticket.model_dump()
        data["ticket_id"] = ticket_id

        deps = AgentDeps(chat=self.chat, retrieve=KbService(self.session).build_retriever())
        # Capture real token usage across every LLM call in the graph run
        # (classify / draft / gap), provider-agnostic, via LangChain's callback.
        with get_usage_metadata_callback() as usage_cb:
            final = await compiled().ainvoke(
                make_initial_state(data),
                config={"configurable": {"deps": deps}},
            )
        cost = self._cost_from_usage(usage_cb.usage_metadata)
        await self._persist(ticket_id, data, final)
        return self._to_result(ticket_id, final, cost)

    @staticmethod
    def _cost_from_usage(usage_metadata: dict) -> TicketCostOut:
        """Sum per-model usage from the callback into a single real cost figure."""
        in_tok = sum(m.get("input_tokens", 0) for m in usage_metadata.values())
        out_tok = sum(m.get("output_tokens", 0) for m in usage_metadata.values())
        calls = sum(int(m.get("input_token_details", {}).get("calls", 0)) for m in usage_metadata.values())
        return TicketCostOut(
            input_tokens=in_tok,
            output_tokens=out_tok,
            usd=round(usd_for_tokens(in_tok, out_tok), 6),
            # input_token_details rarely carries a call count; fall back to model count.
            llm_calls=calls or len(usage_metadata),
        )

    async def _persist(self, ticket_id: str, data: dict, final: dict) -> None:
        ticket = await self.tickets.upsert(
            {
                "ticket_id": ticket_id,
                "channel": data.get("channel", "email"),
                "subject": data.get("subject", ""),
                "message_body": data.get("message_body", ""),
                "order_id": data.get("order_id") or None,
                "customer_name": data.get("customer_name"),
                "customer_email": data.get("customer_email"),
                "date_received": data.get("date_received"),
            }
        )
        run = await self.runs.add(
            Run(
                ticket_id=ticket.id,
                model=get_settings().OPENROUTER_MODEL,
                question_type=final.get("question_type"),
                buyer_persona=final.get("buyer_persona"),
                escalation_flags=final.get("escalation_flags", []),
                classification_confidence=final.get("classification_confidence"),
                kb_confidence=final.get("kb_confidence"),
                kb_top_source=final.get("kb_top_source"),
                route=final.get("route"),
                route_reason=final.get("route_reason"),
                notes=final.get("notes", []),
            )
        )
        route = final.get("route")
        if route in {"auto_reply", "human_review"} and final.get("reply_draft"):
            status = "approved" if route == "auto_reply" else "draft"
            await self.replies.add(
                Reply(
                    run_id=run.id,
                    body=final["reply_draft"],
                    citations=final.get("reply_citations", []),
                    status=status,
                )
            )
        elif route == "knowledge_gap":
            await self.gaps.add(
                Gap(
                    ticket_id=ticket.id,
                    run_id=run.id,
                    paraphrase=final.get("gap_paraphrase", ""),
                    theme=final.get("gap_theme"),
                    buyer_persona=final.get("buyer_persona"),
                    status="open",
                    kb_entry_draft=final.get("kb_entry_draft"),
                )
            )

    @staticmethod
    def _to_result(ticket_id: str, final: dict, cost: TicketCostOut | None = None) -> PipelineResult:
        breakdown = ConfidenceBreakdownOut.model_validate(confidence_mod.from_state(final))
        return PipelineResult(
            ticket_id=ticket_id,
            confidence_breakdown=breakdown,
            cost=cost,
            question_type=final.get("question_type"),
            buyer_persona=final.get("buyer_persona"),
            escalation_flags=final.get("escalation_flags", []),
            classification_confidence=final.get("classification_confidence"),
            kb_confidence=final.get("kb_confidence"),
            kb_top_source=final.get("kb_top_source"),
            route=final.get("route"),
            route_reason=final.get("route_reason"),
            reply_draft=final.get("reply_draft"),
            reply_citations=final.get("reply_citations", []),
            gap_paraphrase=final.get("gap_paraphrase"),
            gap_theme=final.get("gap_theme"),
            kb_entry_draft=final.get("kb_entry_draft"),
            kb_hits=[
                KbHitOut(
                    id=h["id"],
                    source=h["source"],
                    similarity=h["similarity"],
                    adjusted_score=h["adjusted_score"],
                    text=h["text"][:600],
                )
                for h in final.get("kb_hits", [])[:5]
            ],
            notes=final.get("notes", []),
        )

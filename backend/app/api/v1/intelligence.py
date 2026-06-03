"""Intelligence read endpoints: personas + offline-computed artifacts (themes/brief/bench)."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.api.deps import SessionDep, SettingsDep
from app.intelligence import confidence as confidence_mod
from app.intelligence.economics import ASSUMPTIONS, compute_impact, usd_for_tokens
from app.models.gap import Gap
from app.models.reply import Reply
from app.models.run import Run
from app.models.ticket import Ticket
from app.repositories.gap_repo import PersonaRepository
from app.repositories.run_repo import RunRepository
from app.schemas.resources import PersonaOut, RunSummaryOut

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


def _outputs_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "outputs"


def _read_artifact(name: str):
    path = _outputs_dir() / name
    if not path.exists():
        return None
    if path.suffix == ".json":
        return json.loads(path.read_text())
    return path.read_text()


@router.get("/personas", response_model=list[PersonaOut])
async def list_personas(session: SessionDep) -> list[PersonaOut]:
    rows = await PersonaRepository(session).list(limit=50)
    return [PersonaOut.model_validate(r) for r in rows]


@router.get("/summary", response_model=RunSummaryOut)
async def summary(session: SessionDep) -> RunSummaryOut:
    return RunSummaryOut.model_validate(await RunRepository(session).summary())


@router.get("/themes")
async def themes(_: SettingsDep) -> dict:
    return {"clusters": _read_artifact("theme_clusters.json") or []}


@router.get("/marketing-brief")
async def marketing_brief(_: SettingsDep) -> dict:
    return {"markdown": _read_artifact("marketing_brief.md") or ""}


@router.get("/external-bench")
async def external_bench(_: SettingsDep) -> dict:
    return {
        "markdown": _read_artifact("external_benchmark.md") or "",
        "data": _read_artifact("external_benchmark.json") or [],
    }


@router.get("/impact")
async def impact(session: SessionDep) -> dict:
    """Business-outcome roll-up for the Impact dashboard (hours saved, ROI, cost)."""
    summary = await RunRepository(session).summary()
    drafted = (
        await session.execute(
            select(func.count()).select_from(Gap).where(Gap.kb_entry_draft.isnot(None))
        )
    ).scalar_one()
    themes = _read_artifact("theme_clusters.json") or []
    return compute_impact(
        tickets_processed=summary["tickets_processed"],
        by_route=summary["by_route"],
        knowledge_gaps_drafted=drafted,
        themes=themes,
    )


@router.get("/record/{ticket_id}")
async def record(ticket_id: str, session: SessionDep) -> dict:
    """Canonical per-ticket Intelligence Record: ticket → run → reply/gap → themes.

    The single source of truth every other screen links to. Pure join over what
    the pipeline already persisted, plus a recomputed confidence breakdown.
    """
    ticket = (
        await session.execute(select(Ticket).where(Ticket.ticket_id == ticket_id))
    ).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"ticket {ticket_id} not found")

    run = (
        await session.execute(
            select(Run).where(Run.ticket_id == ticket.id).order_by(Run.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    reply = (
        await session.execute(
            select(Reply).where(Reply.run_id == run.id).order_by(Reply.created_at.desc()).limit(1)
        )
        if run
        else None
    )
    reply = reply.scalar_one_or_none() if reply is not None else None
    gap = (
        await session.execute(
            select(Gap).where(Gap.ticket_id == ticket.id).order_by(Gap.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()

    citations = list(reply.citations) if reply else []
    breakdown = (
        confidence_mod.from_run(
            kb_confidence=run.kb_confidence,
            kb_top_source=run.kb_top_source,
            classification_confidence=run.classification_confidence,
            citation_count=len(citations),
            escalation_flags=run.escalation_flags or [],
        )
        if run
        else None
    )

    themes = _read_artifact("theme_clusters.json") or []
    member_themes = [t for t in themes if ticket_id in (t.get("ticket_ids") or [])]

    est_cost = usd_for_tokens(
        ASSUMPTIONS.est_input_tokens_per_ticket, ASSUMPTIONS.est_output_tokens_per_ticket
    )

    return {
        "ticket": {
            "ticket_id": ticket.ticket_id,
            "subject": ticket.subject,
            "channel": ticket.channel,
            "message_body": ticket.message_body,
            "date_received": ticket.date_received,
        },
        "run": None
        if not run
        else {
            "question_type": run.question_type,
            "buyer_persona": run.buyer_persona,
            "escalation_flags": run.escalation_flags or [],
            "kb_confidence": run.kb_confidence,
            "kb_top_source": run.kb_top_source,
            "route": run.route,
            "route_reason": run.route_reason,
        },
        "reply": None if not reply else {"body": reply.body, "citations": citations, "status": reply.status},
        "gap": None
        if not gap
        else {
            "paraphrase": gap.paraphrase,
            "theme": gap.theme,
            "status": gap.status,
            "kb_entry_draft": gap.kb_entry_draft,
        },
        "confidence_breakdown": breakdown,
        "themes": member_themes,
        "cost_estimate_usd": round(est_cost, 6),
    }

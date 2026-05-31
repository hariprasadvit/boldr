"""Knowledge-gap endpoints: list open gaps + resolve them (closes the self-improving loop)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.api.deps import ApprovalServiceDep, SessionDep
from app.repositories.gap_repo import GapRepository
from app.schemas.resources import GapOut, GapResolveIn

router = APIRouter(prefix="/gaps", tags=["gaps"])


@router.get("", response_model=list[GapOut])
async def list_gaps(session: SessionDep, status: str = "open", limit: int = 200) -> list[GapOut]:
    rows = await GapRepository(session).list_enriched(status, limit)
    out: list[GapOut] = []
    for gap, run, ticket in rows:
        first_seen = ticket.date_received if ticket else None
        out.append(
            GapOut(
                id=gap.id,
                ticket_id=gap.ticket_id,
                paraphrase=gap.paraphrase,
                theme=gap.theme,
                buyer_persona=gap.buyer_persona,
                status=gap.status,
                kb_entry_draft=gap.kb_entry_draft,
                kb_confidence=run.kb_confidence if run else None,
                date_first_seen=first_seen or gap.created_at.date().isoformat(),
            )
        )
    return out


@router.post("/{gap_id}/resolve", response_model=GapOut)
async def resolve_gap(gap_id: uuid.UUID, body: GapResolveIn, service: ApprovalServiceDep) -> GapOut:
    gap = await service.resolve_gap(gap_id, body.resolution, resolved_by=body.resolved_by)
    return GapOut.model_validate(gap)

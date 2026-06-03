"""Knowledge-gap endpoints: list open gaps + resolve them (closes the self-improving loop)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.api.deps import ApprovalServiceDep, SessionDep
from app.core.exceptions import NotFoundError
from app.repositories.gap_repo import GapRepository
from app.schemas.resources import GapOut, GapPublishIn, GapPublishOut, GapResolveIn
from app.services.kb_service import KbService

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


@router.post("/{gap_id}/publish", response_model=GapPublishOut)
async def publish_gap(
    gap_id: uuid.UUID,
    body: GapPublishIn,
    service: ApprovalServiceDep,
    session: SessionDep,
) -> GapPublishOut:
    """Approve & publish: resolve the gap AND write its answer into the live KB so
    future similar tickets retrieve it automatically. This closes the loop."""
    gap = await GapRepository(session).get(gap_id)
    if not gap:
        raise NotFoundError(f"gap {gap_id} not found")
    answer = (body.answer or gap.kb_entry_draft or "").strip()
    resolved = await service.resolve_gap(
        gap_id, answer or "(published from auto-drafted FAQ)", resolved_by=body.resolved_by
    )
    chunk_key = await KbService(session).publish_resolved_gap(resolved)
    return GapPublishOut(
        gap=GapOut.model_validate(resolved), published=chunk_key is not None, chunk_key=chunk_key
    )

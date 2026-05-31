"""Pipeline endpoint: run a single ticket through the engine."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import PipelineServiceDep
from app.schemas.pipeline import PipelineResult, TicketInput

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.post("/run", response_model=PipelineResult)
async def run_pipeline(ticket: TicketInput, service: PipelineServiceDep) -> PipelineResult:
    return await service.run(ticket)

"""XLSX export endpoints — gaps / kb-drafts / marketing-brief review workbooks.

Streams openpyxl-built workbooks as attachments (mirrors the OLD Next.js exports).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import date

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.api.deps import SessionDep
from app.services.export_service import ExportService

router = APIRouter(prefix="/exports", tags=["exports"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx_response(payload: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([payload]),
        media_type=XLSX_MIME,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


async def _stream(
    session: SessionDep,
    build: Callable[[ExportService], Awaitable[bytes]],
    name: str,
) -> StreamingResponse:
    payload = await build(ExportService(session))
    return _xlsx_response(payload, f"boldr-{name}-{date.today().isoformat()}.xlsx")


@router.get("/gaps.xlsx")
async def export_gaps(session: SessionDep) -> StreamingResponse:
    return await _stream(session, lambda svc: svc.gaps_workbook(), "knowledge-gaps")


@router.get("/kb-drafts.xlsx")
async def export_kb_drafts(session: SessionDep) -> StreamingResponse:
    return await _stream(session, lambda svc: svc.kb_drafts_workbook(), "kb-drafts")


@router.get("/marketing-brief.xlsx")
async def export_marketing_brief(session: SessionDep) -> StreamingResponse:
    return await _stream(session, lambda svc: svc.marketing_brief_workbook(), "marketing-brief")

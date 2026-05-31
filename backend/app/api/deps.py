"""Dependency-injection providers — routers depend on services via these (DIP)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.services.approval_service import ApprovalService
from app.services.kb_service import KbService
from app.services.pipeline_service import PipelineService

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_pipeline_service(session: SessionDep) -> PipelineService:
    return PipelineService(session)


def get_approval_service(session: SessionDep) -> ApprovalService:
    return ApprovalService(session)


def get_kb_service(session: SessionDep) -> KbService:
    return KbService(session)


PipelineServiceDep = Annotated[PipelineService, Depends(get_pipeline_service)]
ApprovalServiceDep = Annotated[ApprovalService, Depends(get_approval_service)]
KbServiceDep = Annotated[KbService, Depends(get_kb_service)]

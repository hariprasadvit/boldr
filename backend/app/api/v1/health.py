"""Health & readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import SessionDep, SettingsDep

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(settings: SettingsDep) -> dict:
    """Liveness — does not touch the database."""
    return {"status": "ok", "env": settings.ENV, "service": settings.PROJECT_NAME}


@router.get("/health/db")
async def health_db(session: SessionDep) -> dict:
    """Readiness — verifies the database connection."""
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "db": "reachable"}

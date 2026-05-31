"""Aggregate API router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import approvals, exports, gaps, health, intelligence, pipeline, tickets

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(pipeline.router)
api_router.include_router(tickets.router)
api_router.include_router(gaps.router)
api_router.include_router(approvals.router)
api_router.include_router(intelligence.router)
api_router.include_router(exports.router)

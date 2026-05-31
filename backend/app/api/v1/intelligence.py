"""Intelligence read endpoints: personas + offline-computed artifacts (themes/brief/bench)."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter

from app.api.deps import SessionDep, SettingsDep
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

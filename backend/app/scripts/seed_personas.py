"""Seed the 5 canonical personas from data/08_buyer_personas.csv (idempotent upsert)."""

from __future__ import annotations

import asyncio
import csv

from app.core.config import get_settings
from app.repositories.gap_repo import PersonaRepository
from app.scripts._common import with_session


async def _seed(session) -> int:
    repo = PersonaRepository(session)
    path = get_settings().data_path / "08_buyer_personas.csv"
    n = 0
    with path.open() as f:
        for r in csv.DictReader(f):
            await repo.upsert(
                {
                    "persona_id": r["persona_id"],
                    "name": r["persona_name"],
                    "trigger_keywords": [
                        k.strip() for k in r["trigger_keywords"].split(",") if k.strip()
                    ],
                    "recommended_messaging": r.get("recommended_messaging", ""),
                    "marketing_opportunity": r.get("marketing_opportunity", ""),
                    "priority": r.get("priority", "medium"),
                }
            )
            n += 1
    return n


async def main() -> None:
    count = await with_session(_seed)
    print(f"[seed_personas] upserted {count} personas")


if __name__ == "__main__":
    asyncio.run(main())

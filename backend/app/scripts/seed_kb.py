"""(Re)build the KB vector store from source docs (needs OPENROUTER_API_KEY for embeddings)."""

from __future__ import annotations

import asyncio

from app.scripts._common import with_session
from app.services.kb_service import KbService


async def _seed(session) -> int:
    return await KbService(session).ingest()


async def main() -> None:
    count = await with_session(_seed)
    print(f"[seed_kb] ingested {count} KB chunks into pgvector")


if __name__ == "__main__":
    asyncio.run(main())

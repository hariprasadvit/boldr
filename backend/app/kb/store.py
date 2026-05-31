"""pgvector-backed KB store: ingest chunks + similarity search with priority boost."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.kb_chunk import KbChunk

# Boost canonical sources over stale SOP (priority 1=0.0, 2=+0.05, 3=+0.10).
_PRIORITY_BOOST = {1: 0.0, 2: 0.05, 3: 0.10}


@dataclass
class KbHit:
    id: str
    text: str
    source: str
    source_priority: int
    similarity: float
    adjusted_score: float
    metadata: dict


async def replace_all(session: AsyncSession, rows: list[dict]) -> int:
    """Idempotent rebuild: clear the table then bulk-insert fresh chunks."""
    await session.execute(delete(KbChunk))
    session.add_all([KbChunk(**row) for row in rows])
    await session.flush()
    return len(rows)


async def search(session: AsyncSession, query_embedding: list[float], top_k: int) -> list[KbHit]:
    """Cosine-distance search, then re-rank by source-priority-adjusted score."""
    distance = KbChunk.embedding.cosine_distance(query_embedding).label("distance")
    stmt = select(KbChunk, distance).order_by(distance).limit(top_k)
    rows = (await session.execute(stmt)).all()
    hits: list[KbHit] = []
    for chunk, dist in rows:
        sim = max(0.0, 1.0 - float(dist))
        adjusted = min(1.0, sim + _PRIORITY_BOOST.get(chunk.source_priority, 0.0))
        hits.append(
            KbHit(
                id=chunk.chunk_key or f"{chunk.source}::{chunk.section or ''}",
                text=chunk.text,
                source=chunk.source,
                source_priority=chunk.source_priority,
                similarity=round(sim, 3),
                adjusted_score=round(adjusted, 3),
                metadata=chunk.meta or {},
            )
        )
    hits.sort(key=lambda h: h.adjusted_score, reverse=True)
    return hits

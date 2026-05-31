"""KB service: ingest source docs into pgvector and build the async retriever."""

from __future__ import annotations

from dataclasses import asdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.runtime import Retriever
from app.core.config import get_settings
from app.kb import store
from app.kb.chunkers import collect_chunks
from app.llm.base import EmbeddingClient
from app.llm.embeddings import get_embedding_client


class KbService:
    def __init__(self, session: AsyncSession, embedder: EmbeddingClient | None = None) -> None:
        self.session = session
        self.embedder = embedder or get_embedding_client()
        self.settings = get_settings()

    async def ingest(self) -> int:
        """Rebuild the KB: chunk source docs, embed, replace all rows. Returns chunk count."""
        chunks = collect_chunks(self.settings.data_path)
        embeddings = self.embedder.embed([c.text for c in chunks])
        rows = [
            {
                "chunk_key": c.id,
                "source": c.source,
                "section": c.section,
                "source_priority": c.source_priority,
                "text": c.text,
                "embedding": emb,
                "meta": c.metadata,
            }
            for c, emb in zip(chunks, embeddings, strict=True)
        ]
        return await store.replace_all(self.session, rows)

    def build_retriever(self) -> Retriever:
        top_k = self.settings.KB_TOP_K

        async def retrieve(query: str) -> list[dict]:
            embedding = self.embedder.embed_one(query)
            hits = await store.search(self.session, embedding, top_k)
            return [asdict(h) for h in hits]

        return retrieve

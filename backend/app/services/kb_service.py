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

    async def publish_qa(
        self, question: str, answer: str, *, chunk_key: str, section: str | None = None, meta: dict | None = None
    ) -> str | None:
        """Embed a Q&A pair and insert it into the live KB as a high-priority chunk,
        so future similar tickets retrieve and cite it. Returns the chunk_key (or
        None if there's nothing to publish). This is the loop's write-back."""
        answer = (answer or "").strip()
        if not answer or not (question or "").strip():
            return None
        text = f"Q: {question}\nA: {answer}"
        await store.add_chunk(
            self.session,
            {
                "chunk_key": chunk_key,
                "source": "faq",  # FAQ-tier: cites cleanly and gets the priority boost
                "section": section or "Learned",
                "source_priority": 2,
                "text": text,
                "embedding": self.embedder.embed_one(text),
                "meta": {"kind": "gap", "learned": True, **(meta or {})},
            },
        )
        return chunk_key

    async def publish_resolved_gap(self, gap) -> str | None:
        """Publish a resolved gap into the KB. Prefers the human resolution; falls
        back to the auto-drafted FAQ entry."""
        answer = (getattr(gap, "resolution", None) or "").strip() or (
            getattr(gap, "kb_entry_draft", None) or ""
        ).strip()
        return await self.publish_qa(
            gap.paraphrase,
            answer,
            chunk_key=f"faq::learned::{gap.id}",
            section=gap.theme,
            meta={"gap_id": str(gap.id), "theme": gap.theme},
        )

    def build_retriever(self) -> Retriever:
        top_k = self.settings.KB_TOP_K

        async def retrieve(query: str) -> list[dict]:
            embedding = self.embedder.embed_one(query)
            hits = await store.search(self.session, embedding, top_k)
            return [asdict(h) for h in hits]

        return retrieve

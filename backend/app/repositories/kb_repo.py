"""KB-chunk data access (thin wrapper; vector ops live in app.kb.store)."""

from __future__ import annotations

from app.models.kb_chunk import KbChunk
from app.repositories.base import Repository


class KbChunkRepository(Repository[KbChunk]):
    model = KbChunk

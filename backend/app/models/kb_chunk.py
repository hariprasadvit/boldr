"""Knowledge-base chunks with pgvector embeddings (replaces the ChromaDB store).

The embedding dimension is taken from settings (EMBEDDING_DIM) so it matches the
chosen embeddings provider. Changing the provider/dim requires a new migration.
"""

from __future__ import annotations

from pgvector.sqlalchemy import Vector
from sqlalchemy import Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import get_settings
from app.db.base import Base, TimestampMixin, UUIDMixin

_DIM = get_settings().EMBEDDING_DIM


class KbChunk(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "kb_chunks"

    chunk_key: Mapped[str | None] = mapped_column(String(256), unique=True, nullable=True)
    source: Mapped[str] = mapped_column(String(64), index=True)
    section: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_priority: Mapped[int] = mapped_column(Integer, default=1)
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(_DIM))
    # `metadata` is reserved on the declarative Base, so the attribute is `meta`.
    meta: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

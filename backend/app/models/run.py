"""One pipeline execution over a ticket (classification + routing outcome)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Run(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "runs"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), index=True
    )
    model: Mapped[str] = mapped_column(String(128))

    question_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    buyer_persona: Mapped[str | None] = mapped_column(String(64), nullable=True)
    escalation_flags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    classification_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    kb_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    kb_top_source: Mapped[str | None] = mapped_column(String(128), nullable=True)

    route: Mapped[str | None] = mapped_column(String(32), nullable=True)
    route_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    notes: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

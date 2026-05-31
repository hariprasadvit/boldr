"""Knowledge gaps — novel questions flagged for human resolution → KB growth."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

GAP_STATUSES = ("open", "resolved", "dismissed")


class Gap(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "gaps"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), index=True
    )
    run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("runs.id", ondelete="SET NULL"), nullable=True
    )
    paraphrase: Mapped[str] = mapped_column(Text, default="")
    theme: Mapped[str | None] = mapped_column(String(64), nullable=True)
    buyer_persona: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    resolved_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    kb_entry_draft: Mapped[str | None] = mapped_column(Text, nullable=True)

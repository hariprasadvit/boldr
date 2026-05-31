"""Drafted replies, with their approval status (the human-in-the-loop target)."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

REPLY_STATUSES = ("draft", "approved", "sent", "rejected")


class Reply(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "replies"

    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text, default="")
    citations: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)

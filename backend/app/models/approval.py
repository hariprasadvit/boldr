"""Human approval events — the audit trail for the HITL gate."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

APPROVAL_TARGETS = ("reply", "gap", "kb_entry")
APPROVAL_DECISIONS = ("approved", "rejected", "edited")


class Approval(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "approvals"

    target_type: Mapped[str] = mapped_column(String(32), index=True)
    target_id: Mapped[uuid.UUID] = mapped_column(index=True)
    decision: Mapped[str] = mapped_column(String(16))
    actor: Mapped[str | None] = mapped_column(String(128), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

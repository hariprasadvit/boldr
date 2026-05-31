"""Inbound customer enquiries — the pipeline input."""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Ticket(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tickets"

    ticket_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    channel: Mapped[str] = mapped_column(String(32), default="email")
    subject: Mapped[str] = mapped_column(Text, default="")
    message_body: Mapped[str] = mapped_column(Text, default="")
    order_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(256), nullable=True)
    date_received: Mapped[str | None] = mapped_column(String(32), nullable=True)

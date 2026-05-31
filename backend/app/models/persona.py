"""Buyer personas — the 5 canonical personas from data/08_buyer_personas.csv."""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Persona(Base, TimestampMixin):
    __tablename__ = "personas"

    persona_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    trigger_keywords: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    recommended_messaging: Mapped[str] = mapped_column(Text, default="")
    marketing_opportunity: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(16), default="medium")

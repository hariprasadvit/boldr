"""Order-ID detection helpers (generalised beyond the BLD- prefix)."""

from __future__ import annotations

import re

_ORDER_ID_RE = re.compile(r"\b[A-Z]{2,5}-?\d{3,}\b", re.IGNORECASE)


def find_order_ids(text: str) -> set[str]:
    return {m.upper() for m in _ORDER_ID_RE.findall(text or "")}


def has_order_id_mismatch(order_id_field: str | None, message_body: str | None) -> bool:
    """True when the body cites an order ID different from the provided field."""
    if not order_id_field:
        return False
    field = order_id_field.strip().upper()
    body_ids = find_order_ids(message_body or "")
    return bool(body_ids) and any(bid != field for bid in body_ids)

"""Shared helpers for offline scripts/seeders (DRY)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TypeVar

from app.db.session import get_sessionmaker

T = TypeVar("T")


async def with_session(fn: Callable[..., Awaitable[T]]) -> T:
    """Run an async unit of work in a committed session."""
    async with get_sessionmaker()() as session:
        result = await fn(session)
        await session.commit()
        return result

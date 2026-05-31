"""Async SQLAlchemy engine + session factory.

The engine is created lazily so the app can boot (and serve /health) without a
live database — handy for local dev before Postgres is up.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    connect_args = {}
    # asyncpg behind a transaction-mode pooler (Supabase/pgbouncer) must not use
    # server-side prepared statements — disable the cache to avoid errors.
    if settings.DATABASE_URL_ASYNC.startswith("postgresql+asyncpg"):
        connect_args = {"statement_cache_size": 0}
    return create_async_engine(
        settings.DATABASE_URL_ASYNC,
        echo=settings.DB_ECHO,
        pool_size=settings.DB_POOL_SIZE,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a transactional session."""
    async with get_sessionmaker()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

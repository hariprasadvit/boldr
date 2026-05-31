"""Generic async repository — CRUD once, reused by every concrete repo (DRY/LSP)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Generic, TypeVar

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class Repository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def add_all(self, objs: Sequence[ModelT]) -> Sequence[ModelT]:
        self.session.add_all(objs)
        await self.session.flush()
        return objs

    async def get(self, id_: object) -> ModelT | None:
        return await self.session.get(self.model, id_)

    async def list(self, limit: int = 200, offset: int = 0) -> Sequence[ModelT]:
        stmt = select(self.model).limit(limit).offset(offset)
        return (await self.session.execute(stmt)).scalars().all()

    async def count(self) -> int:
        return (
            await self.session.execute(select(func.count()).select_from(self.model))
        ).scalar_one()

    async def clear(self) -> None:
        await self.session.execute(delete(self.model))

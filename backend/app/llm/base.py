"""LLM/embedding interfaces (Protocols) — callers depend on these, not concretes (DIP)."""

from __future__ import annotations

from typing import Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class ChatClient(Protocol):
    def complete(self, system: str, user: str, *, max_tokens: int = 1024) -> str: ...

    def complete_json(self, system: str, user: str, *, max_tokens: int = 1024) -> dict: ...

    def complete_structured(
        self, system: str, user: str, schema: type[T], *, max_tokens: int = 1024
    ) -> T: ...


class EmbeddingClient(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...

    def embed_one(self, text: str) -> list[float]: ...

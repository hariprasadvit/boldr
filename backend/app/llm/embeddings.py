"""Embedding client via OpenRouter's /embeddings endpoint. Implements EmbeddingClient."""

from __future__ import annotations

from functools import lru_cache

import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import LLMError


class OpenRouterEmbeddingClient:
    """Calls OpenRouter's OpenAI-compatible /embeddings endpoint (same API key as chat)."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._s = settings or get_settings()

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if not self._s.OPENROUTER_API_KEY:
            raise LLMError("OPENROUTER_API_KEY not set. Add it to .env.")
        url = f"{self._s.embedding_base_url.rstrip('/')}/embeddings"
        headers = {
            "Authorization": f"Bearer {self._s.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {"model": self._s.EMBEDDING_MODEL, "input": texts}
        try:
            with httpx.Client(timeout=self._s.LLM_TIMEOUT) as client:
                resp = client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()["data"]
        except httpx.HTTPStatusError as e:
            raise LLMError(f"embeddings provider error: {e.response.status_code}") from e
        except httpx.HTTPError as e:
            raise LLMError(f"embeddings request failed: {e}") from e
        return [row["embedding"] for row in sorted(data, key=lambda d: d.get("index", 0))]

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]


@lru_cache(maxsize=1)
def get_embedding_client() -> OpenRouterEmbeddingClient:
    return OpenRouterEmbeddingClient()

"""Provider-agnostic chat client (LangChain -> OpenRouter). Implements ChatClient."""

from __future__ import annotations

from functools import lru_cache

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.exceptions import LLMError
from app.utils.json_parse import extract_json


class LangChainChatClient:
    """Thin wrapper over a LangChain chat model pointed at OpenRouter."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    @lru_cache(maxsize=8)  # noqa: B019 - cache per (model, max_tokens) on a singleton client
    def _model(self, model: str, max_tokens: int):
        from langchain.chat_models import init_chat_model

        s = self._settings
        if not s.OPENROUTER_API_KEY:
            raise LLMError("OPENROUTER_API_KEY not set. Add it to .env.")
        return init_chat_model(
            model,
            model_provider="openai",
            base_url=s.OPENROUTER_BASE_URL,
            api_key=s.OPENROUTER_API_KEY,
            max_tokens=max_tokens,
            temperature=0.0,
            max_retries=s.LLM_MAX_RETRIES,
            timeout=s.LLM_TIMEOUT,
            default_headers={"HTTP-Referer": "https://boldr.local", "X-Title": "Boldr Intel"},
        )

    @staticmethod
    def _text(content) -> str:
        if isinstance(content, list):
            return "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in content)
        return content or ""

    def complete(self, system: str, user: str, *, max_tokens: int = 1024) -> str:
        model = self._model(self._settings.OPENROUTER_MODEL, max_tokens)
        try:
            resp = model.invoke([SystemMessage(content=system), HumanMessage(content=user)])
        except httpx.HTTPError as e:
            raise LLMError(f"chat provider request failed: {e}") from e
        return self._text(resp.content).strip()

    def complete_json(self, system: str, user: str, *, max_tokens: int = 1024) -> dict:
        raw = self.complete(system, user, max_tokens=max_tokens)
        try:
            return extract_json(raw)
        except Exception:
            fixed = self.complete(
                "Return ONLY one valid JSON object. No prose, no code fences.",
                f"Convert the following into a single valid JSON object:\n{raw}",
                max_tokens=max_tokens,
            )
            return extract_json(fixed)

    def complete_structured(
        self, system: str, user: str, schema: type[BaseModel], *, max_tokens: int = 1024
    ) -> BaseModel:
        """Deterministic extraction via tool-calling.

        Uses ``method="function_calling"`` because OpenRouter proxies an
        OpenAI-compatible surface; native JSON-schema response_format is not
        reliably supported across all routed models, whereas tool/function
        calling is. Returns a validated instance of ``schema``.
        """
        model = self._model(self._settings.OPENROUTER_MODEL, max_tokens).with_structured_output(
            schema, method="function_calling"
        )
        result = model.invoke([SystemMessage(content=system), HumanMessage(content=user)])
        if not isinstance(result, schema):  # pragma: no cover - defensive
            result = schema.model_validate(result)
        return result


@lru_cache(maxsize=1)
def get_chat_client() -> LangChainChatClient:
    return LangChainChatClient()

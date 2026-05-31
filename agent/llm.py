"""Provider-agnostic LLM wrapper built on LangChain, routed through OpenRouter.

No provider-specific SDK is imported directly. We use LangChain's chat-model
abstraction (`init_chat_model`) pointed at OpenRouter's OpenAI-compatible
gateway, so the model/provider can be swapped via env (`OPENROUTER_MODEL`) with
no code change. LangGraph nodes call `call()` / `call_json()` / `call_structured()`.

Env:
  OPENROUTER_API_KEY   required
  OPENROUTER_MODEL     default "anthropic/claude-sonnet-4.6" (any OpenRouter slug)
  OPENROUTER_BASE_URL  default "https://openrouter.ai/api/v1"
"""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage

load_dotenv()

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.6")
BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
_APP_HEADERS = {
    "HTTP-Referer": os.getenv("OPENROUTER_APP_URL", "https://boldr.local"),
    "X-Title": "Boldr Intel Engine",
}


@lru_cache(maxsize=8)
def _chat(model: str, max_tokens: int, temperature: float):
    """Build (and cache) a LangChain chat model bound to OpenRouter.

    `init_chat_model` keeps the call sites provider-agnostic; the OpenAI-compatible
    transport is just how we reach OpenRouter. Change `OPENROUTER_MODEL` to route to
    a different provider/model without touching code.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY not set. Add it to .env (get one at https://openrouter.ai/keys)."
        )
    from langchain.chat_models import init_chat_model

    return init_chat_model(
        model,
        model_provider="openai",
        base_url=BASE_URL,
        api_key=api_key,
        max_tokens=max_tokens,
        temperature=temperature,
        max_retries=4,
        timeout=60,
        default_headers=_APP_HEADERS,
    )


@lru_cache(maxsize=16)
def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.txt").read_text()


def _as_text(content) -> str:
    """Normalise LangChain message content (str or list of blocks) to text."""
    if isinstance(content, list):
        return "".join(
            b.get("text", "") if isinstance(b, dict) else str(b) for b in content
        )
    return content or ""


def call(
    system: str,
    user: str,
    *,
    model: str | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.0,
    cache_system: bool = False,  # kept for API compat; OpenRouter caches transparently
) -> str:
    """Single-shot text completion. Returns the response text."""
    del cache_system
    chat = _chat(model or DEFAULT_MODEL, max_tokens, temperature)
    resp = chat.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    return _as_text(resp.content).strip()


def _extract_json(raw: str) -> dict:
    """Extract the first balanced JSON object from model output."""
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)
    start = raw.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in model output: {raw[:200]}")
    depth = 0
    for i in range(start, len(raw)):
        if raw[i] == "{":
            depth += 1
        elif raw[i] == "}":
            depth -= 1
            if depth == 0:
                return json.loads(raw[start : i + 1])
    # Unbalanced — let raw_decode take the longest valid prefix.
    return json.JSONDecoder().raw_decode(raw[start:])[0]


def call_json(system: str, user: str, **kwargs) -> dict:
    """Call the model and parse JSON, with one reformat retry on failure."""
    raw = call(system, user, **kwargs)
    try:
        return _extract_json(raw)
    except Exception:
        passthru = {k: v for k, v in kwargs.items() if k in ("model", "max_tokens")}
        fixed = call(
            system="Return ONLY one valid JSON object. No prose, no code fences.",
            user=f"Convert the following into a single valid JSON object:\n{raw}",
            **passthru,
        )
        return _extract_json(fixed)


def call_structured(
    system: str,
    user: str,
    schema,
    *,
    model: str | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.0,
):
    """Structured output via LangChain. `schema` is a Pydantic model class.

    Returns a validated instance of `schema`. Raises on provider/parse failure so
    callers can fall back to `call_json`.
    """
    chat = _chat(model or DEFAULT_MODEL, max_tokens, temperature).with_structured_output(schema)
    return chat.invoke([SystemMessage(content=system), HumanMessage(content=user)])

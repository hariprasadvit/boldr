"""Runtime dependencies injected into graph nodes via RunnableConfig.

Nodes depend on these abstractions (a chat client + an async retriever callable),
never on repositories/sessions directly — keeps the agent layer persistence-agnostic.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from langchain_core.runnables import RunnableConfig
from app.llm.base import ChatClient

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

# Retriever: query string -> list of KB hit dicts (id, text, source, source_priority, ...).
Retriever = Callable[[str], Awaitable[list[dict]]]


@dataclass
class AgentDeps:
    chat: ChatClient
    retrieve: Retriever


def deps_from_config(config: RunnableConfig) -> AgentDeps:
    return config["configurable"]["deps"]


@lru_cache(maxsize=16)
def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.txt").read_text()

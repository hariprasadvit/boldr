"""Application settings — the single source of truth for configuration.

Values come from environment / .env (never hard-coded), are validated once at
startup, and are injected everywhere via `get_settings()` (Dependency Inversion).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Absolute path so .env loads regardless of the process cwd (e.g. under
        # Vercel's serverless runtime, which does not run from backend/).
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── App ──
    PROJECT_NAME: str = "Boldr Intelligence Engine"
    ENV: str = "dev"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"
    # CORS_ORIGINS is env-driven: pydantic-settings parses either a JSON array
    # (e.g. CORS_ORIGINS='["https://app.example.com"]') or a comma-separated
    # string. The default keeps the Vite dev server (5173) working in dev. In
    # prod with a same-origin SPA (STATIC_DIR set), these headers are a no-op.
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    # Built React app served single-origin. Defaults to the in-repo build output
    # (backend/static, populated by `make build-frontend`); override via env in
    # other deploy layouts. Resolved to an absolute path by `static_path`.
    STATIC_DIR: str = "static"
    # Source CSV/JSON/TXT files, bundled inside backend/ so they ship with the
    # serverless function. Relative paths resolve under backend/.
    DATA_DIR: str = "data"

    # ── Database (Postgres + pgvector) ──
    # Two URLs: async (asyncpg) for the app, sync (psycopg) for Alembic migrations.
    DATABASE_URL_ASYNC: str = "postgresql+asyncpg://boldr:boldr@127.0.0.1:5432/boldr"
    DATABASE_URL_SYNC: str = "postgresql+psycopg://boldr:boldr@127.0.0.1:5432/boldr"
    DB_POOL_SIZE: int = 5
    DB_ECHO: bool = False

    # ── LLM (provider-agnostic via LangChain → OpenRouter) ──
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_MODEL: str = "anthropic/claude-sonnet-4.6"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    LLM_MAX_RETRIES: int = 4
    LLM_TIMEOUT: int = 60

    # ── KB / embeddings (via OpenRouter's embeddings endpoint — reuses OPENROUTER_API_KEY) ──
    EMBEDDING_MODEL: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    EMBEDDING_DIM: int = 2048  # MUST match the kb_chunks.embedding vector(N) column
    EMBEDDING_BASE_URL: str | None = None  # defaults to OPENROUTER_BASE_URL
    KB_TOP_K: int = 5

    @property
    def embedding_base_url(self) -> str:
        return self.EMBEDDING_BASE_URL or self.OPENROUTER_BASE_URL

    # ── Observability ──
    LOG_LEVEL: str = "INFO"
    LANGSMITH_TRACING: bool = False
    LANGSMITH_API_KEY: str | None = None

    @property
    def is_prod(self) -> bool:
        return self.ENV.lower() in {"prod", "production"}

    @property
    def sync_database_url(self) -> str:
        """Sync URL for Alembic / LangGraph Postgres checkpointer."""
        return self.DATABASE_URL_SYNC

    @property
    def data_path(self) -> Path:
        p = Path(self.DATA_DIR)
        return p if p.is_absolute() else (Path(__file__).resolve().parents[2] / p).resolve()

    @property
    def static_path(self) -> Path:
        """Absolute path to the built SPA. Relative STATIC_DIR resolves under backend/."""
        p = Path(self.STATIC_DIR)
        return p if p.is_absolute() else (Path(__file__).resolve().parents[2] / p).resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()

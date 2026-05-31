# Boldr Backend (FastAPI + LangGraph + Postgres/pgvector)

Production-grade backend for the Boldr Customer Intelligence Engine. Layered
(SOLID): `api → services → repositories → models`, with a provider-agnostic LLM
layer (LangChain → OpenRouter) and a pgvector knowledge base.

## Quickstart

```bash
cd backend
cp .env.example .env          # then paste your OPENROUTER_API_KEY
make install                  # uv sync
make db-up                    # Postgres + pgvector via docker
make migrate                  # apply schema
make seed                     # personas + KB + tickets
make dev                      # http://localhost:8000/docs
```

## Layout

```
app/
  core/        config, logging, exceptions, lifespan   (cross-cutting)
  api/         HTTP layer only — routers + DI wiring
  schemas/     Pydantic request/response DTOs
  models/      SQLAlchemy ORM tables (pgvector for kb_chunks)
  repositories/ data access (generic Repository[T] + concretes)
  services/    business logic; orchestrates the agent + repos
  agent/       LangGraph engine (graph, nodes, prompts, personas)
  llm/         provider-agnostic chat model (LangChain → OpenRouter)
  kb/          vector store + ingest (pgvector)
  intelligence/ clustering, marketing brief, external benchmark
  db/          engine/session + LangGraph checkpointer
  utils/       pure helpers (DRY)
  scripts/     seeding & ops
alembic/       migrations
```

## Process model
- **dev:** this API (8000) + Vite dev server (5173, phase 2) with a proxy.
- **prod:** one process — FastAPI serves the API and the built React app (`STATIC_DIR`).

## Deploy to Vercel

The backend can run as a Python serverless function.

- `vercel.json` builds `api/index.py` with `@vercel/python` and routes all paths
  to it. `api/index.py` re-exports the ASGI `app` from `app.main`.
- In the Vercel project settings, set the environment variables:
  - `OPENROUTER_API_KEY`
  - `DATABASE_URL_ASYNC` — **use a pooled Postgres URL** (e.g. Neon's `-pooler`
    host). Serverless functions are short-lived; a non-pooled connection limit
    will be exhausted under load.
  - `DATABASE_URL_SYNC` — used only by Alembic (direct, non-pooled host).
  - `CORS_ORIGINS` and `ENV=prod` as needed (set `STATIC_DIR` only if you serve
    the SPA same-origin).
- **Run migrations out-of-band** (locally or in CI), never on a cold start:

  ```bash
  uv run alembic upgrade head
  ```

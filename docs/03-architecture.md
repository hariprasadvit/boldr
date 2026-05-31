# 03 · Architecture (Target)

The go-forward system is a **single-process** app: a FastAPI backend that serves both the
JSON API and (in production) the built React frontend. Python/LangGraph is the brain;
Postgres + pgvector is the single datastore.

## Why this shape
- **Single process / single deploy** — FastAPI serves the API *and* the static React build. One port, one container. (Dev uses a Vite dev server with a proxy for hot-reload; that collapses to one process in prod.)
- **Keep LangGraph** — the real state machine + the human-in-the-loop primitives live in Python. A Next.js app can't run Python in-process, so we chose FastAPI + React (Vite), not Next.js. See [07-decisions.md](07-decisions.md).
- **Provider-agnostic LLM** — LangChain `init_chat_model` pointed at OpenRouter. Swap model/provider via env, no code change. No vendor SDK.

## High-level diagram
```
            ┌────────────────────────── one process (prod) ──────────────────────────┐
Browser ──▶ │  FastAPI                                                                 │
            │   ├── /api/v1/*  ── routers ─▶ services ─▶ repositories ─▶ Postgres      │
            │   │                              │                                       │
            │   │                              └─▶ LangGraph agent ──▶ LLM (LangChain  │
            │   │                                   │  └─ checkpointer (Postgres)      │──▶ OpenRouter
            │   │                                   └─▶ KB retrieval ─▶ pgvector        │
            │   └── /  ── static React build (frontend/dist)                           │
            └──────────────────────────────────────────────────────────────────────────┘
```

## Layered design (SOLID)
Strict, one-way dependencies: **api → services → repositories → models**. Higher layers
never reach past their neighbour.

| Layer | Dir | Responsibility | Must NOT |
|-------|-----|----------------|----------|
| API | `app/api/` | HTTP only: parse/validate request, call a service, shape response | touch the DB or contain business logic |
| Schemas | `app/schemas/` | Pydantic request/response DTOs (the contract) | hold persistence concerns |
| Services | `app/services/` | business logic; orchestrate agent + repositories | know about HTTP or SQL details |
| Repositories | `app/repositories/` | data access (Repository pattern) | contain business rules |
| Models | `app/models/` | SQLAlchemy ORM tables | contain logic |
| Agent | `app/agent/` | LangGraph engine (graph/nodes/prompts/personas) | call the DB directly (goes via services) |
| LLM | `app/llm/` | provider-agnostic chat model factory | be imported with a hard vendor dependency |
| KB | `app/kb/` | vector store + ingest (pgvector) | leak the backend choice to callers (interface) |

**SOLID mapping**
- **S** — each layer one job (routers ≠ services ≠ repos ≠ models).
- **O** — `llm/factory.py` and `kb/store.py` are interfaces: add a provider / swap vector backend without touching callers.
- **L** — generic `Repository[T]` base; concrete repos and store impls are drop-in.
- **I** — small protocols (`LLMClient`, `VectorStore`, `Repository[T]`).
- **D** — services depend on abstractions injected via FastAPI `Depends`, not concretes (also makes them unit-testable with mocks).
- **DRY** — generic base repo, shared schemas, one JSON-parse helper (`utils/`), one frontend API client, one `Settings`.

## Backend file structure
```
backend/app/
├── main.py            # app factory: CORS, exception handlers, lifespan, static mount (prod)
├── core/              # config (pydantic-settings), logging (structlog), exceptions
├── api/
│   ├── deps.py        # DI providers (SettingsDep, SessionDep, …service deps)
│   ├── router.py      # aggregates v1 routers
│   └── v1/            # health (+ tickets, pipeline, gaps, approvals, intelligence — pending)
├── schemas/           # Pydantic DTOs (pending)
├── models/            # SQLAlchemy tables (pending)
├── repositories/      # Repository[T] + concretes (pending)
├── services/          # business logic (pending)
├── agent/             # LangGraph engine — ported from top-level agent/ (pending)
├── llm/               # LangChain → OpenRouter factory (pending)
├── kb/                # pgvector store + ingest (pending)
├── intelligence/      # clustering / brief / bench (pending)
├── db/                # engine/session (done) + LangGraph checkpointer (pending)
├── utils/             # pure helpers (pending)
└── scripts/           # seeding & ops (pending)
alembic/               # migrations
docker-compose.yml     # Postgres + pgvector
Makefile               # install / db-up / migrate / seed / dev / test / lint
```

## Frontend (phase 2) — React + Vite
```
frontend/src/
├── api/        # ONE client + endpoint modules (DRY) — no scattered fetch
├── features/   # feature-first: inbox, pipeline, gaps, themes, brief, bench
├── components/ # shared UI primitives
├── hooks/  lib/  types/
└── routes.tsx
```
Vite builds to static files that FastAPI serves in prod (`STATIC_DIR`).

> **UI/UX is a faithful port of the existing `web/` Next.js app (ADR-010) — no redesign.** We copy
> `web/app/*.tsx` + `web/app/globals.css` (Tailwind) verbatim and only swap the data layer to the
> FastAPI endpoints.

## Process model recap
- **dev:** FastAPI (8000) + Vite (5173) with `/api` proxy → hot reload, two dev servers.
- **prod:** one FastAPI process serving `/api/*` and the React build.
- **hosting:** **Vercel** (no Docker). React is served as Vercel static assets; FastAPI runs as a **Python serverless function** for `/api/*` (ASGI entrypoint). Persistent state lives in **Neon** Postgres, so statelessness between invocations is fine — including HITL (the Postgres checkpointer survives cold starts). Heavy/long jobs run **offline** (not in the request path). See [07-decisions.md](07-decisions.md) ADR-008.

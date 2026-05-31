# Boldr Customer Intelligence Engine

A self-improving customer intelligence engine for Boldr Supply Co. — built for the
Echelon 2026 AI Workflow Competition. **Live:** https://echelon-boldr.vercel.app

**Not a chatbot.** Every customer enquiry becomes three things at once: a drafted
reply, a knowledge-base improvement, and a marketing signal.

## What it does

1. **Classify** — extracts question type, buyer persona, and escalation flags.
2. **Search** — vector retrieval (pgvector) over FAQ, product specs, and rate cards,
   re-ranked by source trustworthiness.
3. **Route** — confidence-thresholded auto-reply, human-review queue, or knowledge gap.
4. **Draft** — a brand-voice reply that cites its KB sources and never invents facts.
5. **Flag gaps** — novel questions get an auto-drafted KB entry for one-click approval.
6. **Cluster themes** — groups novel questions into themes.
7. **Marketing brief** — persona-tagged intelligence: what customers ask that the
   product pages don't answer.
8. **External benchmark** — cross-checks internal signals against external sentiment.

See [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md) for the full walkthrough.

## Architecture

Single-process app: a **FastAPI** backend (Python, LangGraph → OpenRouter, async
SQLAlchemy) serves both the JSON API and the built **React + Vite** SPA from one
origin. Data lives in **Postgres + pgvector** (Supabase). Deployed on **Vercel**.

```
boldr/
├── backend/            # FastAPI app, LangGraph pipeline, repositories, services
│   ├── app/            # application code (api, agent, kb, intelligence, models…)
│   ├── api/index.py    # Vercel ASGI entrypoint
│   ├── data/           # source CSV/JSON/TXT (tickets, KB sources, personas)
│   ├── static/         # built SPA, served by FastAPI (committed)
│   ├── alembic/        # database migrations
│   └── tests/          # e2e API tests
├── frontend/           # React + Vite SPA (builds into backend/static)
├── vercel.json         # Vercel build config (root → backend Python function)
└── PROBLEM_STATEMENT.md
```

## Local development

```bash
# Backend (uv) — serves API on :8000
cd backend
uv sync
cp .env.example .env          # fill DATABASE_URL_*, OPENROUTER_API_KEY
uv run alembic upgrade head   # migrations (run locally, not on Vercel)
uv run python -m app.scripts.seed_all   # seed tickets/personas/KB (one-time)
uv run uvicorn app.main:app --reload --port 8000

# Frontend (pnpm) — dev server on :5173 proxying /api to :8000
cd ../frontend
pnpm install
pnpm dev
```

Single-process (build SPA into the backend, serve both on :8000):

```bash
cd backend && make serve
```

## Deployment (Vercel)

Pushing to `master` triggers an automatic Vercel deploy. The root `vercel.json`
builds `backend/api/index.py` as a Python function and bundles `backend/{app,data,
outputs,static}`. The SPA is committed under `backend/static` (rebuild with
`pnpm build` when the frontend changes). Migrations and seeding are run **locally**
against Supabase — never on Vercel.

Required env vars (Production): `DATABASE_URL_ASYNC`, `DATABASE_URL_SYNC`,
`OPENROUTER_API_KEY`, plus `ENV`, `DEBUG`, `API_PREFIX`, `OPENROUTER_MODEL`,
`OPENROUTER_BASE_URL`, `EMBEDDING_MODEL`, `EMBEDDING_DIM`, `KB_TOP_K`, `LOG_LEVEL`,
`DB_POOL_SIZE`.

## Health

- `GET /api/v1/health` — liveness (no DB)
- `GET /api/v1/health/db` — readiness (verifies the database connection)

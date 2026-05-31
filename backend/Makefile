.PHONY: install dev build-frontend serve migrate revision seed seed-kb run-baseline test lint fmt

install:        ## install deps into uv-managed venv
	uv sync

# No Docker. Postgres is a managed serverless instance (e.g. Neon / Vercel Postgres)
# with the pgvector extension — set DATABASE_URL in .env. For local dev you may also
# point DATABASE_URL at a local Postgres (Postgres.app / brew) that has pgvector.

# --loop asyncio: uvloop fails to connect to IPv6-only hosts (e.g. Supabase's
# direct db.<ref>.supabase.co). The stock asyncio loop resolves IPv6 fine.
dev:            ## run the API with hot reload (use Vite dev server for the UI)
	uv run uvicorn app.main:app --reload --port 8000 --loop asyncio

build-frontend: ## build the React app into backend/static (the default STATIC_DIR)
	cd ../frontend && pnpm install && pnpm build

serve: build-frontend  ## single-process prod: build SPA + serve API and UI on :8000
	uv run uvicorn app.main:app --port 8000 --loop asyncio

migrate:        ## apply all migrations
	uv run alembic upgrade head

revision:       ## autogenerate a migration: make revision m="msg"
	uv run alembic revision --autogenerate -m "$(m)"

seed:           ## run all seeders (idempotent)
	uv run python -m app.scripts.seed_all

seed-kb:        ## (re)build the KB vector store
	uv run python -m app.scripts.seed_kb

run-baseline:   ## run the pipeline over seeded tickets, persist results
	uv run python -m app.scripts.run_baseline

test:
	uv run pytest -q

lint:
	uv run ruff check .

fmt:
	uv run ruff format .

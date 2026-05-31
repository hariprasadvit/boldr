# 08 · Uncommitted Working Changes (review before you commit)

> The user commits, not the assistant. This is a precise review list of what's in the working
> tree from the recent sessions, so you know what you're committing. Run `git status` and
> `git diff` to confirm — the lists below describe intent.

## New (untracked) — the big additions
- **`backend/`** — the entire new FastAPI foundation (Phase 1): app factory, `core/` (config,
  logging, exceptions), `db/` (async session + Base), `api/v1/health`, Alembic scaffold,
  `docker-compose.yml` (pgvector), `Makefile`, `pyproject.toml`, `.env.example`. Boots + `/health`.
- **`docs/`** — this onboarding set (`README.md`, `01`–`08`). Plus earlier `challenge_brief.md`
  and `gap_analysis.md`.

## Modified — Python engine upgrades (implementation #1)
- **`agent/llm.py`** — rewritten to be **provider-agnostic**: LangChain `init_chat_model` →
  OpenRouter (was the OpenAI SDK). Added `call_structured`, robust `call_json`.
- **`agent/nodes/draft_reply.py`** + **`agent/prompts/draft_reply.txt`** — citation verification
  against retrieved chunks (drop fabricated IDs); escalation flags passed into the prompt so
  `order_id_mismatch` surfaces the conflict instead of silently picking an ID.
- **`intelligence/cluster_themes.py`** — cluster on the customer's message (not the agent's
  boilerplate reply); cap cluster count.
- **`intelligence/external_bench.py`** — fix alphabetical `max()` signal-strength bug; make the
  dead question-type branch actually count.
- **`batch_replay.py`** — emit `message_body` so clustering has the customer text.
- **`pyproject.toml`** + **`uv.lock`** — swapped `openai`/`anthropic` for `langchain` +
  `langchain-openai`; added `markitdown` (dev).

## Modified — review with `git diff` (may be merge/linter artifacts)
- **`agent/nodes/classify.py`**, **`agent/prompts/classify.txt`** — these were **restored to the
  team's merged version** (5 canonical personas + `reconcile_persona`). They may still show as
  modified due to auto-formatting; diff to confirm there's no unintended change.
- **`agent/nodes/__init__.py`**, **`.gitignore`**, **`demo_app.py`**, **`smoke_test.py`**,
  **`data/...`** — verify these; some are from the team merge / linter, not necessarily this
  session's intent.

## Earlier local commits (also unpushed)
`git log` shows local commits ahead of `origin/main`, including the merge that integrated the
team's `web/` app + persona pipeline. None pushed.

## ⚠️ Before committing
- **Do NOT commit secrets.** `.env` / `web/.env.local` / `backend/.env` are gitignored and hold
  **placeholders** — but double-check `git status` shows no `.env` staged.
- Consider committing in logical groups: (1) Python engine upgrades, (2) `backend/` foundation,
  (3) `docs/`.
- Decide whether to commit `outputs/` logs (some were accidentally tracked earlier; `.gitignore`
  now covers `outputs/*.log`).

## Suggested next action after you install Docker
See [04-roadmap.md](04-roadmap.md) → Phase 2. In short: `cd backend && make db-up`, paste your
`OPENROUTER_API_KEY` into `backend/.env`, then resume model + migration work.

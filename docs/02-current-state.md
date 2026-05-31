# 02 · Current State

> Snapshot as of the latest working session. This describes exactly what exists in the repo
> today, including the messy reality of **three** parallel implementations.

## There are THREE implementations right now
The repo currently carries three codebases that do (overlapping versions of) the same thing.
The plan (see [04-roadmap.md](04-roadmap.md)) is to **consolidate onto #3 and retire #1 and #2.**

### 1. Python / LangGraph engine + Streamlit  *(original prototype — upgraded)*
- **Where:** `agent/`, `kb/`, `intelligence/`, `batch_replay.py`, `demo_app.py`.
- **What:** the real LangGraph state machine (`classify → search_kb → decide_route → draft / flag_gap → auto_draft_kb`). Streamlit dashboard on top.
- **Data:** ChromaDB vector store (`kb/chroma_db/`) + flat files in `data/` + CSV/JSON outputs in `outputs/`.
- **Status:** works. Recently upgraded this session:
  - LLM layer rewritten to be **provider-agnostic** (LangChain `init_chat_model` → OpenRouter) — no vendor SDK.
  - Anti-hallucination: drafted-reply citations now verified against retrieved chunks; escalation flags passed into the prompt.
  - Theme clustering fixed (clusters the customer's message, not the agent's boilerplate; caps cluster count).
  - `external_bench` signal-strength bug fixed.
- **Run:** `uv run streamlit run demo_app.py` (needs `OPENROUTER_API_KEY`).

### 2. Next.js web app  *(team's TS reimplementation — the Vercel demo)*
- **Where:** `web/`.
- **What:** a **separate** TypeScript re-implementation of the pipeline (`web/lib/*.ts`). **Not LangGraph** — just sequential function calls. Polished UI; this is what's deployed at `boldr-intel.vercel.app`.
- **Data:** dashboards read frozen snapshots from `web/public/data/*.json`; the live tab calls OpenRouter directly in TS.
- **Status:** builds and runs (`cd web && npm run dev`). **Untouched** by this session's Python fixes — it has drifted from the Python engine.
- **Why it exists:** Vercel can't host Python/Streamlit, so the author rebuilt the logic in TS to deploy serverlessly.

### 3. FastAPI backend  *(NEW — the go-forward target)*
- **Where:** `backend/`.
- **What:** a production-grade foundation: FastAPI + async SQLAlchemy + Alembic + Postgres/pgvector + LangGraph (with Postgres checkpointer) + LangChain→OpenRouter. SOLID-layered.
- **Status:** **walking skeleton only.** It boots and serves `/api/v1/health` (verified). Models, migrations, services, the ported engine, endpoints, and seeding are **not built yet** (next phases).
- **Run:** `cd backend && uv sync && uv run uvicorn app.main:app --reload` → `http://localhost:8000/docs`.

## Repo map
```
boldr/
├── agent/            # [#1] LangGraph engine: graph, state, nodes, prompts, personas, llm.py
├── kb/               # [#1] ChromaDB ingest + retrieval
├── intelligence/     # [#1] cluster_themes, marketing_brief, external_bench
├── batch_replay.py   # [#1] run all tickets → outputs/
├── demo_app.py       # [#1] Streamlit dashboard
├── data/             # source files (tickets, rate cards, FAQ, SOP, personas, sentiment)
├── outputs/          # [#1] generated artifacts (gitignored)
├── evals/            # eval harness (from the team merge)
├── web/              # [#2] Next.js app (TS reimplementation) + web/public/data snapshots
├── backend/          # [#3] NEW FastAPI app  ← go-forward target
├── docs/             # ← you are here
├── scripts/          # md→pdf, export helpers (from the team merge)
├── pyproject.toml    # [#1] uv project for the Python engine/Streamlit
└── PROJECT_OVERVIEW.md, PROJECT_HANDOVER.md   # legacy team docs (web-app phase)
```

## How the "database" works *today* (important)
There is **no relational database** yet. Persistence is three loose things:
1. **ChromaDB** (`kb/chroma_db/`) — the only real DB; a vector store, collection `boldr_kb` (~76 chunks), cosine space, with `source_priority` metadata so canonical sources (rate cards/specs) outrank the stale SOP. Embeddings use Chroma's built-in `all-MiniLM-L6-v2` (ONNX, local).
2. **Flat files** (`data/*.csv|json|txt`) — read fresh each run; nothing is loaded into tables.
3. **Ephemeral state + file outputs** — the LangGraph `TicketState` lives in memory for one ticket then is discarded (no checkpointer → the "approval queue" can't really pause/resume). Results land as `outputs/*.csv|json|md`; the web app reads a frozen `web/public/data/*.json` snapshot.

The target replaces this with Postgres + pgvector — see [06-data-model.md](06-data-model.md).

## Git / version-control state
- Branch: `main`. Local history is **ahead of `origin/main`** (a merge commit integrating the team's `web/` + persona pipeline, plus earlier setup commits) and **not pushed**.
- This session's work (LangChain LLM rewrite, gap fixes, the entire `backend/` folder, and these docs) is **uncommitted** — **the user will commit it themselves.**
- Secrets: `.env` files are gitignored. They currently hold **placeholders** (`sk-or-REPLACE_ME`); the user sets real keys.

## What blocks the next step
**No Docker** (by decision — Vercel-only deploy). The next phase (autogenerated migration) needs a
reachable **Neon** Postgres (pgvector) + an embeddings API key. Provision Neon, set
`DATABASE_URL` + `EMBEDDING_API_KEY` in `backend/.env`, then the migration can be generated.
ORM models are already written. See [04-roadmap.md](04-roadmap.md).

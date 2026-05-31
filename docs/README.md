# Boldr Customer Intelligence Engine — Documentation

> **Start here.** This folder is the source of truth for what this project is, how
> it's architected, where it stands today, and how to run it. Read the docs in order.

## Onboarding path (read in this order)

| # | Doc | What it answers |
|---|-----|-----------------|
| 1 | [01-project-overview.md](01-project-overview.md) | What is Boldr? What problem are we solving? What does "done" look like? |
| 2 | [02-current-state.md](02-current-state.md) | What exists *right now* — three implementations, repo map, git state. |
| 3 | [03-architecture.md](03-architecture.md) | The target system: FastAPI + React + Postgres/pgvector + LangGraph. SOLID layering. |
| 4 | [04-roadmap.md](04-roadmap.md) | The multi-week plan, the 5 phases, locked decisions, current progress. |
| 5 | [05-setup-and-run.md](05-setup-and-run.md) | How to install and run everything (new backend + legacy apps). Env vars. |
| 6 | [06-data-model.md](06-data-model.md) | How the "DB" works today vs the target Postgres/pgvector schema. |
| 7 | [07-decisions.md](07-decisions.md) | Key technical decisions and *why* (ADR-style). |

## Reference docs
- [challenge_brief.md](challenge_brief.md) — the original Echelon 2026 competition brief (source requirements).
- [gap_analysis.md](gap_analysis.md) — audit of the legacy code vs the brief + best practices.
- `PROJECT_OVERVIEW.md`, `PROJECT_HANDOVER.md` — earlier team docs describing the **legacy web-app phase** (kept for history; superseded by docs 01–07 above).

## TL;DR for the impatient
- **What:** an AI workflow that turns Boldr's customer emails into drafted replies **+** knowledge-base updates **+** marketing intelligence. "Not a chatbot."
- **Where we are:** migrating from two throwaway prototypes (a Python/Streamlit app and a Next.js demo) onto **one production backend** (`backend/`, FastAPI + LangGraph + Postgres/pgvector). The backend **foundation boots today**; DB layer is next.
- **Blocked on:** installing Docker (for Postgres+pgvector). After that: models → migrations → services → port the engine → endpoints → React.
- **LLM:** provider-agnostic via **LangChain → OpenRouter** (no vendor SDK). Set `OPENROUTER_API_KEY`.

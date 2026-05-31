# 06 · Data Model — Now vs Target

## How the "database" is set up TODAY
There is **no relational database**. Persistence is three loosely-coupled things:

1. **Vector store — ChromaDB** (the only real "DB").
   - `kb/ingest.py` → `chromadb.PersistentClient` at `kb/chroma_db/`.
   - One collection `boldr_kb` (~76 chunks), cosine space.
   - Each chunk has metadata incl. `source`, `section`, and **`source_priority`** (1 = SOP/stale → 3 = rate cards/specs/canonical) so canonical sources win on conflict.
   - Embeddings: Chroma's built-in `all-MiniLM-L6-v2` (ONNX, auto-downloaded, local — no embedding API).
2. **Flat files** — `data/*.csv|json|txt` read fresh every run; nothing loaded into tables.
3. **Ephemeral state + file outputs** — the LangGraph `TicketState` lives in memory for one
   ticket then is discarded (**no checkpointer** → the approval queue can't truly pause/resume).
   Results are written to `outputs/*.csv|json|md`; the web app reads a frozen
   `web/public/data/*.json` snapshot.

**Consequences / gaps:** no run history, no audit trail, no durable approval state, no users —
which is exactly why the brief's human-in-the-loop and self-improving loop can't be real yet.

---

## Target: Postgres + pgvector (one database)
A single Postgres instance holds **both** relational data **and** the KB embeddings (via the
`pgvector` extension). SQLAlchemy 2.0 (async) + Alembic migrations. LangGraph checkpoints also
live in Postgres so the approval gate is durable.

### Planned tables (Phase 2)
| Table | Purpose | Key columns (indicative) |
|-------|---------|--------------------------|
| `personas` | the 5 canonical buyer personas | `persona_id` (pk), `name`, `trigger_keywords[]`, `marketing_opportunity`, `priority` |
| `tickets` | inbound enquiries (the input) | `id`, `ticket_id` (unique), `channel`, `subject`, `message_body`, `order_id`, `date_received` |
| `runs` | one pipeline execution over a ticket | `id`, `ticket_id` fk, `model`, `started_at`, `finished_at`, `route`, `route_reason` |
| `replies` | drafted replies | `id`, `run_id` fk, `body`, `citations[]`, `kb_confidence`, `status` (draft/approved/sent) |
| `gaps` | knowledge gaps (novel questions) | `id`, `ticket_id` fk, `paraphrase`, `theme`, `status` (open/resolved), `resolved_by`, `kb_entry_draft` |
| `approvals` | human approval events (HITL audit) | `id`, `target_type` (reply/gap/kb_entry), `target_id`, `decision`, `actor`, `decided_at` |
| `kb_chunks` | the knowledge base | `id`, `source`, `section`, `source_priority`, `text`, **`embedding vector(384)`**, `metadata jsonb` |
| `personas_keyword_hits` *(optional)* | audit of persona reconcile | per-run keyword evidence |
| LangGraph checkpoint tables | durable graph state for `interrupt()`/resume | created by `langgraph-checkpoint-postgres` |

### Vector search
- `kb_chunks.embedding` is **`vector(2048)`** (`EMBEDDING_DIM=2048`).
- Embeddings come from **OpenRouter's embeddings endpoint** (`/api/v1/embeddings`), model
  **`nvidia/llama-nemotron-embed-vl-1b-v2:free`** — same key as chat, behind an `EmbeddingClient`
  interface (no local ONNX/torch model, which suits Vercel serverless). KB vectors are precomputed
  at **seed time**; only the incoming query is embedded per request.
- Retrieval: cosine distance (`<=>`) with an IVFFlat/HNSW index, then the same `source_priority`
  boost applied in the service layer.
- DB is **Neon** (managed serverless Postgres + pgvector); use the **pooled** connection on Vercel.

### Migrations & extension
- First migration runs `CREATE EXTENSION IF NOT EXISTS vector;` then creates the tables.
- `make migrate` (Alembic `upgrade head`). Autogenerate via `make revision m="..."` once Postgres is up.

### Why one database
Embeddings in Postgres (pgvector) means a single thing to run, back up, and deploy — no
separate Chroma directory to sync. The vector store sits behind a `VectorStore` interface, so
the backend choice stays swappable.

---

## Mapping: current → target
| Today | Becomes |
|-------|---------|
| `kb/chroma_db/` (Chroma) | `kb_chunks` table (pgvector) |
| `data/01_customer_tickets.csv` | `tickets` table (seeded) |
| `data/08_buyer_personas.csv` | `personas` table (seeded) |
| `outputs/drafted_replies.csv` | `runs` + `replies` tables |
| `outputs/gap_log_updated.csv` + `kb_drafts/*.md` | `gaps` table |
| in-memory `TicketState` | LangGraph Postgres checkpoints (durable) |
| disabled "Approve" button | `approvals` table + `interrupt()`/resume |

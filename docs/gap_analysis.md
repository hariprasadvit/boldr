# Boldr Intelligence Engine — Gap Analysis & Improvement Plan

> Audited against `docs/challenge_brief.md` (Echelon 2026). Combines a code-vs-brief
> audit with best-practice research on LangGraph, OpenRouter, and Claude prompting.
> Stack note: project runs **LangGraph + OpenAI SDK → OpenRouter `/api/v1`** (provider-agnostic,
> no Anthropic SDK). `agent/llm.py` reads `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`.

## 1. Requirement coverage vs the brief

| # | Brief requirement | Status | Gap |
|---|---|---|---|
| 1 | Ingest enquiry, extract intent+context | Partial | CSV only; "Gmail in production" not built (fine for demo) |
| 2 | Search KB (FAQ/rate cards/specs/SOP) | **Implemented** | Chroma top-5 + source-priority boost. Solid. |
| 3 | Answerable → brand-voice draft, **queue for human approval** | Partial / **faked gate** | "Queue" = a CSV label + a *disabled* button. No `interrupt()`, no checkpointer. Nothing is actually gated/sendable. |
| 4 | Not answerable → flag gap, route to CS, **do not hallucinate** | Partial | Anti-hallucination is prompt-only, never verified. No CS-facing context packet beyond a paraphrase. |
| 5 | Auto-draft KB entry **once human resolves** gap (1-click) | **Faked** | Draft fires at detection time, not post-resolution. Only "resolved" gaps are 2 hand-edited CSV rows. Loop never closes. |
| 6 | Theme clustering — **weekly** | Partial | Real clustering but no scheduling; cadence is claimed, not implemented. Clusters are weak (see B5). |
| 7 | Marketing brief — **monthly**, persona-tagged | Partial | On-theme output, but "monthly" is a hardcoded string; persona tags use the wrong taxonomy. |
| P | Tag each enquiry against the **5 personas** | **Broken** | 3 conflicting persona taxonomies (see B2). Biggest brief-level defect. |
| B | Bonus: external benchmark, 2+ sources, 3+ themes | **Implemented** | 3 sources (r/Watches, WatchUSeek, Trustpilot), 12 themes, LLM verdict+action. One bug (B6). |

## 2. Top correctness defects (ranked)

1. **Anti-hallucination unenforced; order-mismatch reply hallucinates.** `draft_reply.py` parses a self-reported `CITATIONS:` line never checked against `kb_hits`. For order_id-mismatch tickets it silently picks one ID ("happy to check on order BLD-93810", TKT-1009) — contradicting the README claim that it "flags data inconsistency rather than picking one". The mismatch flag never reaches the drafting prompt.
2. **Persona taxonomy mismatch (3 sets).** `prompts/classify.txt` emits 7 personas (`niche_buyer, prospect, owner_aftercare, transactional…`); `08_buyer_personas.csv` defines 5 (`health_conscious, gifter, enthusiast, active, sustainable`); the ticket ground-truth column uses the 5-set. The persona→marketing join in `marketing_brief.py` silently never matches for the 4 stray labels.
3. **README "SOP price drift" gotcha is fabricated.** `05a_SOP.txt` has *no* Regulation Service price (only a SGD 15 engraving fee). There is no stale "SGD 60" to override — the priority-boost demo on TKT-1062 never actually fires. Either add the line to the SOP or fix the README.
4. **`call_json` regex is fragile.** `agent/llm.py` uses greedy `\{.*\}` (first `{` to last `}`); prose braces or two objects corrupt the parse. No retry.
5. **Clustering doesn't cluster.** `cluster_themes.py` embeds `subject + first 200 chars of the *drafted reply*` → biases on boilerplate greetings. Result: 48 "clusters" for 70 tickets = 37 singletons. Docstring claims "HDBSCAN-style"; it's plain average-linkage. Fix: embed the *customer message*, cap clusters 6–10.
6. **`external_bench.py` signal bug.** `max(signal_strength)` takes the *alphabetical* max → `medium > high > low`. Mixed themes get understated. Fix: ordinal key `{low:0, medium:1, high:2}`.
7. **Order-id regex `BLD-\d{4,}` is brittle.** Misses other formats / 3-digit IDs / field-present-body-absent. Works only for the 4 seeded tickets.

## 3. Faked vs real

- Human approval queue = **theater** (route string + disabled button; no interrupt/persistence).
- "Human resolves → auto-draft KB" = **simulated** (draft fires pre-resolution).
- "Weekly"/"Monthly" cadence = **labels** (run-once scripts, no scheduler).
- README gotcha #1 = **fabricated**; gotcha #2 real at flag level but the reply contradicts it.
- "HDBSCAN-style clustering" = plain Agglomerative, 79% singletons.
- `external_bench._internal_freq` has a dead `elif … pass` (question_type matching never counts).

## 4. Best-practice gaps (research-backed)

### LangGraph (docs.langchain.com/oss/python/langgraph)
- **No checkpointer** → no resume, no human-in-the-loop, no crash recovery. Add `SqliteSaver`/`PostgresSaver`, `thread_id=ticket_id`.
- **Approval not modeled in the graph** → use `interrupt()` + `Command(resume=...)` (requires checkpointer). This is the canonical way to implement the brief's "queue for human approval".
- **Hand-parsed JSON** → use structured output. With the raw OpenAI/OpenRouter client this is `response_format={"type":"json_schema", …}`; if moving to `langchain-openai`, `with_structured_output(PydanticModel)`.
- **No retries** on LLM nodes → `add_node(..., retry_policy=RetryPolicy(max_attempts=4))`; route-to-human on exhaustion.
- **No tracing** → LangSmith via env vars (zero code); `stream_mode="updates"` for per-node progress.
- **Batch `for`-loop of `invoke`** → Send API fan-out / subgraph for concurrency + one trace tree + a natural theme-aggregation point.
- Nodes mutate+return whole state → return only changed keys (keeps replay/time-travel correct).

### OpenRouter (provider-agnostic path — keep this)
- Current path (OpenAI SDK → `https://openrouter.ai/api/v1`, Bearer via `OPENROUTER_API_KEY`) is correct and provider-agnostic. Model slugs are dotted: `anthropic/claude-sonnet-4.6`, `anthropic/claude-haiku-4.5`.
- **Reliability:** pass `extra_body={"models": ["anthropic/claude-sonnet-4.6","anthropic/claude-haiku-4.5"]}` for automatic fallback; `extra_body={"provider": {...}}` for routing/privacy.
- **Cost/latency:** OpenRouter does transparent prompt caching for Claude models — keep the large static system prompt as a stable prefix (don't interpolate dates/names) to benefit.
- **Privacy:** `provider:{data_collection:"deny", zdr:true}` for no-retention routing.
- **Resilience:** rely on the `models` fallback array + client `max_retries` + your own backoff; most 429s = out-of-credits (check `GET /api/v1/key`).

### Claude prompting / RAG (works through OpenRouter)
- **Replace regex JSON** with constrained/structured output (json_schema) → eliminates the malformed-JSON failure class.
- **Grounding:** documents-first, query-last, XML-tagged (`<documents>`, `<ticket>`); explicitly allow "I don't know"; quotes-first grounding. ~30% quality lift + injection resistance.
- **Few-shot:** 3–5 `<examples>` for the classifier (edge cases) and 2–3 ideal replies to lock brand voice.
- **Determinism:** classifier → low effort + structured output; drafting/marketing → higher effort + creative prompting.
- Note: if ever calling Anthropic *directly*, citations and structured-output can't combine in one request — but on the OpenRouter/OpenAI path you use `response_format` + prompt-based grounding.

## 5. Prioritized plan

### Quick wins (≤1 hr each, high impact)
1. **Fix persona taxonomy** → make `classify.txt` emit exactly the 5 canonical IDs; align `decide_route` liability pairs + marketing/external joins. *(Biggest brief-impact, lowest effort.)*
2. Pass `escalation_flags` (esp. `order_id_mismatch`) into `draft_reply.txt`; instruct to surface conflicts, not pick an ID.
3. Verify citations against `kb_hits` in `draft_reply.py`; blank uncited numeric claims.
4. Fix `external_bench` signal ordinal; remove dead `elif…pass`.
5. Cluster on `message_body`, cap clusters 6–10.
6. Harden `call_json` (`raw_decode` + 1 reformat retry).
7. Fix README gotcha #1 (or add the SGD 60 line to `05a_SOP.txt` so the override is real).

### Deeper work
1. **Real human-in-the-loop:** LangGraph `interrupt()` + `SqliteSaver`, `thread_id=ticket_id`; drafts pause/persist/resume on approval.
2. **Close the self-improving loop:** gap → human resolves → *then* auto-draft → approve → re-ingest into Chroma.
3. **Structured output** for classify/route via `response_format` json_schema (OpenRouter).
4. **Reliability:** per-node `RetryPolicy` + OpenRouter `models` fallback array; route-to-human on exhaustion.
5. **Real scheduling** for weekly/monthly jobs (cron/scheduler), not labels.
6. **Observability:** LangSmith tracing; `stream_mode="updates"`.
7. Generalize order-id detection beyond `BLD-\d{4,}`.

### Engineering notes
- Cost/ticket: 2 LLM calls (answerable) / 3 (gap) + 1 embedding query.
- Determinism: LLM steps have no seed/temp control → outputs vary run-to-run.
- `cluster_themes.py` reaches into Chroma's private `_embedding_function` (fragile across versions).
- `search_kb.py` / `decide_route.py` lack try/except (other nodes fail-safe).

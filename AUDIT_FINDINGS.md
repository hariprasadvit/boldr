# Boldr Customer Intelligence Engine — Audit & TODO

> Read-only audit of the deployed system (https://echelon-boldr.vercel.app) against the
> problem statement (`PROBLEM_STATEMENT.md`), the original Echelon challenge data
> (`/echelon/data/Boldr Data/`), and 2025–2026 production LLM/agent best practices.
> Nothing in the codebase was modified to produce this report.

Legend: ✅ implemented · 🟡 partial · 🟥 hardcoded/stubbed · ❌ missing · ⚠️ risk

---

## 0a. SECURITY — checked, no secret leaked ✅

- Verified the committed `.env.example` files hold only **placeholder format hints** (key value
  length 12 / 16 chars), not real keys. A genuine OpenRouter key is ~73 chars (`sk-or-v1-`+64 hex)
  and exists **only** in the gitignored `backend/.env` (length 73, never committed).
- (An earlier draft of this audit wrongly flagged a leaked key — that was a false positive from
  matching the `sk-or-` *prefix* in the placeholder. No secret is in git history.)
- Real `.env` is properly gitignored; `frontend/.env.example` is also a clean placeholder.

---

## 0. Executive summary

The **backend is a genuine, working RAG + LangGraph engine** — real LLM classification
(structured output), real pgvector retrieval with trust re-ranking, deterministic routing,
grounded drafting with **real citation-ID verification**, and real embedding-based theme
clustering + LLM-written marketing/benchmark prose. That is more than many demos ship.

The gaps cluster in four places:
1. **The headline "human-in-the-loop" promise is not usable in the app** — approve/reject/
   resolve endpoints exist but no UI control calls them; the gap "Approve & publish" button
   is hard-disabled.
2. **The self-improving loop is not closed** — resolving a gap flips a DB status but never
   re-ingests the drafted FAQ into the live KB, so "next person gets an instant answer"
   doesn't actually happen in-app.
3. **The Campaigns page is 100% hardcoded marketing copy**, decorated with two live numbers.
4. **Challenge-provided inputs are ignored** and the **eval harness (the project's stated
   differentiator) was not ported to the new backend.**

---

## 1. Official challenge brief — the actual scoring criteria

Source: `/echelon/data/Boldr_Challenge_Brief_v2-16May1pm.pdf` (the real Echelon brief).
Brand confirmed: **Boldr = Singapore titanium-watch micro-brand on Shopify, 3-person CS team,
Gmail support.** (My earlier "fragrance brand mismatch" note was WRONG — based on a file that
doesn't exist; deleted. Brand identity is correct.)

### The brief's mandated 7-step "Core Challenge: Intelligence Loop"
| Step | Brief requirement | Our status |
|---|---|---|
| 1 | **Ingest enquiry** — extract question intent + context | ✅ classify node |
| 2 | **Search KB** — rate cards, FAQ, product specs | ✅ pgvector retriever |
| 3 | **Answerable? Draft reply in brand voice, QUEUE FOR HUMAN APPROVAL before sending** | 🟡 drafts ✅ but **no approval queue UI** (see N8) |
| 4 | **Not answerable? Flag gap, route to CS with context, DO NOT hallucinate** | ✅ flag_gap + anti-hallucination prompt |
| 5 | **Once human resolves the gap, auto-draft a KB entry for 1-CLICK APPROVAL** | 🟥 draft ✅ but 1-click approval disabled + no re-ingest (N6/N7) |
| 6 | **Weekly: theme-cluster novel questions** (materials, sustainability, sizing, gifting) | ✅ clustering |
| 7 | **Monthly: marketing brief — "what customers ask that's not on your product pages" + persona tags** | 🟡 real but coverage check crude |

> The brief makes **human approval (step 3) and 1-click gap approval + self-updating KB (step 5)
> CORE requirements, not bonus.** These are exactly our biggest misses (N6/N7/N8). The loop's
> headline — *"Knowledge Base stays current automatically"* — is not actually closed in-app.

### The brief's explicit BONUS challenge — External Sentiment Benchmarking
| Bonus requirement (verbatim intent) | Our status | Evidence |
|---|---|---|
| **Identify 2+ external sources, explain why each is appropriate + what signals it captures** | 🟥 not satisfied | `data/09_external_sentiment_data.csv` is 12 canned rows; no named sources, no justification, no scraper |
| **Compare internal vs external on 3+ themes (align/diverge)** | 🟡 partial | `external_bench.py` computes internal-vs-external per theme, but external side is static fixture data |
| **Per-theme actionable insight: "Boldr-specific gap or market-wide? What to do?"** | 🟡 partial | LLM writes a verdict, but off canned external data |

> Bonus is **architecturally present but evidentially weak** — the comparison logic is real, the
> external data is hand-authored. To truly score the bonus: name ≥2 real sources (watch forums,
> Reddit r/Watches, competitor reviews), justify them, and pull/cite real snippets.

### Official sample data (only SIX files provided by the challenge)
`01_customer_tickets.csv`, `02_product_reference.docx`, `03a_rate_card_engraving.csv`,
`03b_rate_card_servicing.csv`, `04_faq_document.pdf`, `05_cs_sop.docx`. All six are consumed
(converted to txt/json). The repo's `05_decision_tree.json`, `08_buyer_personas.csv`,
`09_external_sentiment_data.csv` are **team-authored**, not official inputs — so not consuming
`05_decision_tree.json` is fine (it's a team artifact, not a challenge requirement). The brief
provides **no pre-built outputs or ideal formats** — builders decide structure. ✅ legitimate.

Note: brief says `05_cs_sop.docx` contains "escalation rules, tone guidelines, and a **live log of
new questions not yet answered**" — i.e. the SOP doubles as the gap log. Our split into SOP +
separate `07_knowledge_gap_log.csv` is a reasonable interpretation.

---

## 2. NEEDS (required capabilities) — scorecard

These are the core promises in the problem statement: *"every enquiry becomes a reply +
a KB improvement + a marketing signal,"* with human-in-the-loop and a self-improving loop.

| # | Required capability | Status | Where |
|---|---|---|---|
| N1 | Classify ticket (question_type, persona, escalation flags) via AI | ✅ | `agent/nodes/classify.py:143` structured output + JSON fallback |
| N2 | KB search with relevance **and trustworthiness** re-ranking | ✅ | `kb/store.py:35-56`, priority boost `:13` |
| N3 | Deterministic rule-book routing (NOT the AI) | ✅ | `agent/nodes/decide_route.py:27-50` (pure logic) |
| N4 | Draft brand-voice reply, KB-grounded, **cites sources** | ✅ (cite-IDs verified) | `agent/nodes/draft_reply.py:24-66` |
| N5 | Novel question → auto-drafted FAQ entry | ✅ | `agent/nodes/flag_gap.py:56-97` |
| N6 | **One-click approve** the FAQ entry (human-in-the-loop) | 🟥 stubbed | button disabled `frontend/.../gaps/GapsPage.tsx:87-93`; `resolveGap` uncalled `api/client.ts:46` |
| N7 | **Self-improving loop closes** (approved entry re-ingested → next ask answered) | ❌ not closed | `services/approval_service.py:48-64` flips status only; no `KbChunk` insert / `ingest()` call |
| N8 | CS agent **queue: approve / tweak / send drafted replies** | 🟥 UI missing | backend `api/v1/approvals.py:15` works; **no page calls `decideReply`**; ticket view is read-only `TicketDetailPage.tsx:57` |
| N9 | Cluster novel questions into themes | ✅ real ML | `intelligence/cluster_themes.py:42-44` (AgglomerativeClustering) |
| N10 | Marketing brief: "what customers ask that isn't on product pages," with theme + counts | 🟡 real but crude | `intelligence/marketing_brief.py:85` LLM-gen; coverage check is naive substring match vs FAQ (not product pages) `:29-34` |
| N11 | External benchmark: internal vs forum/review sentiment | 🟡 logic real, data static | `intelligence/external_bench.py:66-118`; external = hand-authored `data/09_external_sentiment_data.csv` (12 rows, no scraper) |
| N12 | Dashboard pages (overview/inbox/gaps/themes/brief/bench/campaigns/live) | ✅ all 9 routes 200 | `frontend/src/main.tsx:16-32` |
| N13 | Live pipeline runs the real engine + persists | ✅ | `ChatInterface.tsx:84` → `services/pipeline_service.py:36-99` |
| N14 | **Eval harness** (measure question_type/persona accuracy, route, KB recall) | ❌ not in new backend | `backend/evals` ABSENT; only `run_baseline.py` (prints route counts, no scoring) |

**NEEDS verdict:** 8 ✅ / 3 🟡 / 2 🟥 / 2 ❌ (N6, N7, N8 are the most visible misses — they're the
"human-in-the-loop / self-improving" story the writeup leads with; N14 is the stated differentiator).

---

## 3. BONUS / advanced capabilities — scorecard

From the roadmap + best practices; these lift the project above baseline.

| Bonus | Status | Note |
|---|---|---|
| Provider-agnostic LLM layer (swap models via env) | ✅ | `llm/chat.py`, DI Protocols `llm/base.py` |
| Order-ID-mismatch deterministic detection | ✅ | `utils/ids.py:7-20`, 4/4 in original eval |
| SOP-vs-rate-card price-priority handling | 🟡 prompt-only | relies on LLM following priority text; no deterministic price guard |
| Model tiering (cheap model for extraction, strong for drafting) | ❌ | all nodes use one model (`OPENROUTER_MODEL`); classify/flag_gap could use a cheaper tier |
| Prompt caching (stable system+few-shot+KB prefix) | ❌ | not configured; ~70–85% cost/latency lever unused |
| Batch API for offline intelligence jobs | ❌ | jobs call `complete()` per cluster |
| LangSmith tracing / observability | 🟡 config only | `config.py` has LANGSMITH_* but not wired into the agent |
| Durable checkpointer (resumable/HITL pause-resume) | ❌ | no checkpointer in `agent/graph.py` |
| Few-shot examples in prompts | ❌ | every prompt is zero-shot |
| Prompt-injection defense for customer text | ❌ | raw `message_body` interpolated into classify/draft/gap prompts |
| Faithfulness gate (claims grounded, not just IDs cited) | ❌ | only citation-ID existence is verified, not claim support |
| Self-consistency for high-liability (2-of-3) | ❌ | roadmap item, not built |
| Gmail integration | ❌ | absent (roadmap) |
| Multi-turn chat / conversation persistence | ❌ | `/live` is ephemeral React state; staged timers are faked `ChatInterface.tsx:74-81` |
| Hybrid search (BM25 + vector) + reranker | ❌ | vector-only; no rerank; `kb_confidence` = top-1 score only (no margin) |

---

## 4. Station-by-station: implemented vs hardcoded vs missing

### Station 1 — Classify ✅ (with weaknesses)
- ✅ Real structured output (tool-calling) with JSON + default fallbacks. `classify.py:143-172`
- ✅ Deterministic order-ID regex layered correctly (not AI). `utils/ids.py`
- ⚠️ Persona reconcile formula `hits*0.4 + llm_confidence` is an **unjustified magic blend** — with ≥3 keyword hits, keywords always override the LLM; `confidence` is persona-confidence reused as overall gate. `classify.py:114-130`, used in routing `decide_route.py:42`.
- 🟥 Prompt: no few-shot, no injection guard. `prompts/classify.txt`

### Station 2 — Search ✅ (with weaknesses)
- ✅ Real pgvector cosine + priority re-rank. `store.py:35-56`
- 🟡 Trust boost is flat additive (`{1:0, 2:+.05, 3:+.10}`); does **not** distinguish rate_card from product_specs though the draft prompt claims `rate_card > product_specs`. Magic constants, not config. `store.py:13`
- ❌ No dedup, no MMR, no reranker; `kb_confidence` = single top-1 score (no margin/agreement). `search_kb.py:15`

### Station 3 — Route ✅ (cleanest station)
- ✅ Pure deterministic logic, no LLM, audit-trail reason persisted. `decide_route.py:27-50`
- 🟥 All thresholds are source magic numbers (0.72/0.50/0.55), not config; rule-book not versioned per run.
- ⚠️ **Liability gap:** `LIABILITY_PAIRS` covers exactly one pair `(health_conscious, materials_safety)`. Any other persona asking a safety question can auto-reply if the LLM didn't set `high_liability`. **Recommend: route ALL `materials_safety` to human review.** `decide_route.py:24`

### Station 4 — Draft ✅ (strong, with one real risk)
- ✅ Real generation, temp 0.0, **citation IDs verified against retrieved chunks** (not blindly trusted). `draft_reply.py:24-66`
- ⚠️ **Auto-reply with zero citations ships unreviewed:** if the LLM omits `CITATIONS:`, reply saves with no citations and `auto_reply` is auto-`approved`+sent. **Recommend: require ≥1 verified citation for auto_reply, else downgrade to human_review.** `draft_reply.py:58`, `pipeline_service.py:79`
- 🟡 Verifies citation IDs exist but **not that the reply's claims are supported** by those chunks (no faithfulness check) — a correct citation can sit next to an invented price.
- 🟥 Brittle `rpartition("CITATIONS:")` parse breaks if model writes "CITATIONS:" in the body or output is truncated. `draft_reply.py:56`

### Station 5 — Gap ✅ (good prompt, loop not closed)
- ✅ flag_gap = structured extraction; auto_draft_kb = constrained generation; output format matches FAQ chunker so it round-trips. `flag_gap.py`, `kb_entry.txt`
- 🟥 auto_draft_kb grounds on "widely-known watch facts" not retrieved chunks — no KB context passed in. `flag_gap.py:83-87`
- ❌ No gap dedup (two similar novel Qs → two open gaps).
- ❌ **Resolution never re-ingests** (see N7).

### Station 6 — Intelligence 🟡
- ✅ Theme clustering is real ML; labels from LLM with fallback. `cluster_themes.py`
- 🟡 Marketing brief is real LLM-from-data, but "not on product pages" = naive substring match vs FAQ. `marketing_brief.py:29-34`
- 🟥 External sentiment is a static 12-row CSV presented as benchmark data; `THEME_MAP` is a hardcoded keyword dict. `external_bench.py:20-63`
- 🟥 **Campaigns page = 298 lines of static copy** (5 personas × 2 angles × newsletter+2 social = 20 posts), only the sort order + ticket-count badges are live. `frontend/src/features/campaigns/campaigns.ts:1,26`
- 🟥 Intelligence jobs have no Makefile target / not in `seed_all`; dashboard reads pre-generated `outputs/*.{json,md}`.

---

## 5. Where REAL AI is needed vs simple intent-extraction

| Place | Currently | Right tool | Verdict |
|---|---|---|---|
| Classify question_type/persona/flags | LLM structured output | LLM (fuzzy, language-heavy) ✅ | **Correct.** Keep LLM. |
| Order-ID mismatch | regex | regex ✅ | **Correct.** Deterministic. |
| Persona final pick | LLM + magic-weight keyword vote | keep LLM primary; rules only to break low-confidence ties | **AI/rule blend is muddled** — simplify the vote. |
| Routing decision | pure rules | rules ✅ (per spec) | **Correct.** Do NOT make this AI. |
| Draft reply | LLM generation | LLM (real conversation needed) ✅ | **Correct.** This is the one place genuine generation is essential. |
| FAQ-entry draft | LLM | LLM ✅ | **Correct**, but should be grounded in KB. |
| Theme label / marketing brief / bench verdict | LLM | LLM ✅ (synthesis) | **Correct.** |
| Theme clustering | embeddings + sklearn | math, not LLM ✅ | **Correct.** |
| "Not on product pages" coverage | substring keyword match | should be embedding similarity (semantic) | **Under-powered** — a cheap embedding compare beats substring. |
| Price-priority enforcement | LLM follows prompt text | **deterministic guard** after draft | **AI misuse for a guarantee** — should be a rule. |
| Campaign copy | hardcoded static | LLM generation from persona+theme | **Missing AI where the whole point is generation.** |

**Net:** the AI-vs-rules split is mostly right (routing = rules, drafting = AI). The two real
misalignments are (a) using the LLM where a deterministic price guard is needed, and (b) NOT
using the LLM where it's promised (campaigns).

---

## 6. Prompting & agent best-practices gaps (vs 2025–26 standards)

Graded against the researched "top 10 for production customer-service RAG":

1. **Grounding + abstention** — 🟡 prompts say "don't invent" but no retrieval-confidence abstention beyond the route threshold; auto-reply can ship citation-less.
2. **HITL on high-liability** — 🟥 no in-app approval gate; only one liability pair routed.
3. **Citation + faithfulness** — 🟡 IDs verified, claims not.
4. **Schema-guaranteed structured output** — ✅ classify/flag_gap use it (best-practice); ⚠️ verify the routed OpenRouter model actually supports strict structured outputs.
5. **Retrieval: hybrid + rerank + semantic chunking** — 🟥 vector-only, no rerank; chunking is source-aware (good).
6. **Eval harness with regression gates** — ❌ absent in backend (the writeup's own differentiator).
7. **End-to-end tracing** — 🟡 LangSmith env present, not wired.
8. **Calibrated confidence** — 🟥 routes on raw LLM-verbalized confidence (known overconfident); use logprobs or self-consistency for safety.
9. **Prompt-injection defense** — 🟥 raw customer text interpolated; XML tags help but no "treat as data" instruction + no filtering.
10. **Reliability/cost** — 🟡 retries+timeouts ✅; ❌ no checkpointer, model tiering, prompt caching, or batch.

**Systemic prompting gaps:** zero few-shot examples anywhere; no injection framing; brittle
output parsing; brand voice/claims not grounded in the supplied brand guidelines.

---

## 7. Hardcoded / fake-data inventory (presented as live)

- 🟥 `frontend/src/features/campaigns/campaigns.ts` — all campaign copy static (own comment admits it).
- 🟥 `data/09_external_sentiment_data.csv` — 12 hand-authored "forum" rows; surfaced in `/bench` raw-data expander.
- 🟥 `data/07_knowledge_gap_log.csv` — static gap log; the "answered" rows that seed the KB are hand-written, not produced by the live resolve flow.
- 🟥 `external_bench.py` `THEME_MAP` — hardcoded keyword→theme dict; unmapped external themes silently dropped.
- 🟥 `/live` reasoning trace timers — hardcoded `setTimeout` 2400/2900/3200/3800ms; "backend learning update" panel is descriptive copy, not a real action.
- 🟡 Routing thresholds, trust-boost weights, cluster-count bounds — magic numbers in source, not config.
- ☠️ Dead code: `api/client.ts` methods `decideReply`, `resolveGap`, `personas` have **zero callers**; backend `/tickets/runs/count` has no client method.

---

## 7b. Architecture separation, AI misuse, guardrails & responsible AI

### Layer separation — mostly GOOD ✅
- ✅ **Agent layer is clean**: `app/agent/` imports **no** DB/session/repository code (verified) — nodes depend only on injected `ChatClient`/retriever via `RunnableConfig`. Correct DIP.
- ✅ **Service layer owns persistence**: `pipeline_service.py` orchestrates graph + repositories; nodes stay persistence-agnostic. Proper separation.
- ✅ **LLM provider is abstracted** behind `ChatClient` Protocol (`llm/base.py`) — swap via env, no node changes.
- 🟡 One smell: `pipeline_service._persist` hard-codes status logic (`auto_reply`→`approved`, else `draft`) inline — business policy buried in the persistence method; belongs in a policy/service function.

### Agent vs workflow — CORRECT (no agent misuse) ✅
- ✅ This is a **deterministic LangGraph workflow** (fixed classify→search→route→draft edges), **not** an autonomous tool-loop agent. That matches Anthropic's "use workflows, not agents, when the path is knowable" — the right call. No agentic over-engineering, no unbounded tool loops.
- ✅ Routing is pure logic, not an LLM "deciding" — correct separation of decision vs generation.

### LLM used where rules fit better (AI misuse) 🟥
- 🟥 **Price-priority is enforced by prompt, not code.** `draft_reply.txt:11-18` *asks* the LLM to prefer rate_card over SOP. A pricing guarantee should be a **deterministic post-draft guard** (cross-check any SGD figure vs rate card), not a hope. This is the clearest "LLM doing a job a rule should guarantee."
- 🟡 **Persona reconcile** blends `hits×0.4 + llm_confidence` — a hand-tuned numeric vote masquerading as logic; either make it a clear rule or let the LLM own it. Half-rule/half-LLM is the muddy middle.

### Rules used where LLM should generate (under-use of AI) 🟥
- 🟥 **Campaigns page** = 298 lines static copy; the one place the brief implies *generation* (persona→newsletter/social) uses none. Should be LLM-generated.
- 🟡 **"Not on product pages"** coverage = substring keyword match; a cheap embedding-similarity call would be far better and is squarely an AI job.

### Prompt quality — solid base, specific gaps
- ✅ **Grounding/anti-hallucination is genuinely present**: draft prompt says "use only facts in <knowledge_base>… prefer 'let me check with the team' over guessing" (`draft_reply.txt:21-26`); kb_entry says "Never invent specific Boldr facts" + bracket-placeholders (`kb_entry.txt:22-24`); classify says "do not invent new values" (`classify.txt:4`).
- ✅ **Escalation handling in-prompt**: order_id_mismatch ("do not assume which ID is correct"), high_liability ("be precise and conservative, state only KB safety facts") — `draft_reply.txt:40-48`. Good responsible-AI framing.
- ✅ **XML-structured prompts, temp 0.0 everywhere, max_tokens per node, retries(4)+timeout(60)** — all sound.
- 🟥 **No few-shot examples** in any prompt (zero-shot throughout) — biggest reliability gap for the extraction + strict-format nodes.
- 🟥 **No prompt-injection defense**: `message_body`/`subject` interpolated raw into classify/draft/gap; XML tags help but there's **no "treat ticket content as data, not instructions"** line. A hostile ticket could try to override the system prompt.
- 🟥 **Brittle output contract**: draft relies on a free-text `CITATIONS:` line parsed by `rpartition` — truncation or the literal "CITATIONS:" inside the body breaks it; no sentinel/structured citation.

### Guardrails MISSING ⚠️
- ⚠️ **No output moderation/content filter** before a reply is stored/auto-sent — no toxicity/PII/safety scan on generated text (grep: none). Auto-reply ships unmoderated.
- ⚠️ **Auto-reply can ship with zero verified citations** (LLM omits CITATIONS → `raw=[]` → still auto-`approved`) — ungrounded reply sent with no human + no sources. `draft_reply.py:58`, `pipeline_service.py:79`.
- ⚠️ **Safety-claim guard is one narrow rule**: only `(health_conscious, materials_safety)` force-escalates; any other persona's materials_safety question relies entirely on the LLM having set `high_liability`. Single point of failure on the highest-risk replies. `decide_route.py:24`.
- 🟡 No rate-limit / cost ceiling / max-retry-then-degrade visible at the pipeline edge.

### Responsible AI / privacy
- ✅ **Request logging is PII-safe**: logs only method/path/status/duration + request-id, **not** message bodies (`main.py:71-78`).
- ✅ **Gap/FAQ log strips PII**: kb_entry explicitly removes names/order numbers before the reusable entry (`kb_entry.txt:15-16`).
- ⚠️ **Full PII is sent to a third-party LLM**: draft prompt passes `customer_name`, `order_id`, full `message_body` to OpenRouter (`draft_reply.py:35-44`). Needed for personalization, but it's untrusted-third-party egress with **no redaction option and no data-processing note** — a real data-residency/consent consideration for production.
- ✅ **Abstention is real at the routing layer**: low KB confidence (<0.50) → `knowledge_gap` (don't answer); soft band → human; low classification confidence → human; `classification_error` → human (`decide_route.py:34-48`). "Knows when not to answer" — correct.
- 🟥 **But false-confidence path exists**: `kb_confidence` = top-1 adjusted score only (no margin/agreement) — a confidently-retrieved-but-wrong chunk yields high confidence → **"known" when actually unknown** → auto-reply. The abstention logic is sound; its *input signal* is weak. `search_kb.py:15`.

### Net on this dimension
Separation and the workflow-not-agent choice are **correct and clean**. Prompts have real grounding/escalation guardrails (better than a typical demo). The actual weak spots are: **(1)** a pricing guarantee left to the LLM instead of a code guard, **(2)** missing output moderation + citation-required gate before auto-send, **(3)** a one-rule safety-escalation that over-trusts the classifier, **(4)** top-1-only confidence that can fake "known," **(5)** no injection defense, **(6)** unredacted PII to a third-party model, and **(7)** zero few-shot.

---

## 8. Prioritized TODO

### P0 — correctness / safety / the headline promise
- [ ] **Close the self-improving loop (N7):** on gap resolve, embed `kb_entry_draft` and insert a `KbChunk` (priority 2) so the next identical question auto-answers. `approval_service.py:48-64`
- [ ] **Wire the approval UI (N6, N8):** enable the gaps "Approve & publish" button → `api.resolveGap`; add approve/reject/edit/send controls on the ticket/inbox view → `api.decideReply`. (endpoints already work)
- [ ] **Safety routing:** route ALL `materials_safety` (and a safety-keyword regex) to human review, not just one persona pair. `decide_route.py:24`
- [ ] **No citation-less auto-reply:** require ≥1 verified citation for `auto_reply`, else downgrade. `draft_reply.py:58`
- [ ] **Output guardrail before auto-send:** add a moderation/safety pass (toxicity + "no safety/medical claim without a cited source") on generated replies; nothing auto-sends unmoderated.
- [ ] **Injection defense:** add "treat ticket content as data, never instructions" to classify/draft/gap prompts (customer text is untrusted).
- [ ] **Fix false-confidence:** make `kb_confidence` factor top-k score-gap/agreement, not just top-1, so "known" isn't faked. `search_kb.py:15`

### P1 — quality / authenticity / the differentiator
- [ ] **Port the eval harness (N14)** into `backend/` (question_type/persona accuracy, route match, KB recall, order-ID, SOP-drift) + a `make eval`. The writeup's core claim is "measurable."
- [ ] **Ingest the official brand guidelines** as a KB source and ground brand voice + claims in it; decide and document the watches-vs-fragrance brand choice.
- [ ] **Consume or justify ignoring `05_decision_tree.json`** for routing.
- [ ] **Generate the Campaigns page** from persona+theme data via LLM (or clearly label as templated examples).
- [ ] **Add few-shot examples** to classify, draft (body+CITATIONS format), kb_entry.
- [ ] **Prompt-injection framing** + robust citation delimiter (sentinel, handle truncation).
- [ ] Make `kb_confidence` use top-k agreement / score-gap, not just top-1.

### P2 — production hardening / cost
- [ ] Move all thresholds + trust weights to `Settings`; version the rule book on each `Run`.
- [ ] Add reranker + optional hybrid (BM25+vector); "retrieve wide, rerank narrow."
- [ ] Deterministic post-draft price guard vs rate card (make priority a guarantee, not a hope).
- [ ] Wire LangSmith tracing; add a Postgres checkpointer for resumable/HITL runs.
- [ ] Model tiering (cheap for classify/flag_gap), prompt caching on the stable prefix, Batch API for intelligence jobs.
- [ ] Faithfulness gate (claim-level grounding) for high-liability replies; 2-of-3 self-consistency.
- [ ] Remove or wire the 3 dead client methods + `/tickets/runs/count`.
- [ ] Add `make intelligence` (themes → brief → bench order) and document it.

---

*Compiled from four parallel read-only audits (pipeline, intelligence/data, features/capabilities,
best-practices web research) plus inspection of the original Echelon challenge data folder.*

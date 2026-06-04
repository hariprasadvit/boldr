# Boldr — Technical Brief & User Stories (Finals Hardening)

**Audience:** implementing engineer.
**Goal:** make the platform read as *one customer-intelligence engine* (not seven separate reports), and make business outcomes impossible for a judge to miss in the first 20 seconds.
**Constraint:** ~1–2 days. Do P0 fully before P1.

> **⚠️ Stack note (P0 was implemented on `master`, not the old Next.js app).**
> This brief was first written against the Next.js `web/` app (preserved on branch `wip/finals-hardening-nextjs`). `master` is a **FastAPI backend + Vite/React frontend**, so P0 was re-implemented there on branch `feat/finals-hardening`. References to `web/lib/*` and `web/app/*` below map as:
>
> | Brief says (old Next.js) | Implemented on master at |
> |---|---|
> | `web/lib/economics.ts` | `backend/app/intelligence/economics.py` |
> | `web/lib/confidence.ts` | `backend/app/intelligence/confidence.py` |
> | cost capture in `web/lib/llm.ts` | `get_usage_metadata_callback` in `backend/app/services/pipeline_service.py` |
> | `web/app/components.tsx` additions | `frontend/src/components/ui.tsx` |
> | `web/app/page.tsx` dashboard | `frontend/src/features/home/HomePage.tsx` + `GET /intelligence/impact` |
> | `web/app/intelligence/[ticketId]` | `frontend/src/features/intelligence/RecordPage.tsx` + `GET /intelligence/record/{ticket_id}` |
> | `DerivedFrom` on themes/brief/campaigns/bench | same components, `frontend/src/features/*` |
> | confidence/cost in live panel | `frontend/src/features/live/ReasoningPanel.tsx` |
>
> Cost/confidence are computed **backend-side** (single source of truth); the React app only renders. Economics assumptions live in `backend/app/intelligence/economics.py` (`ASSUMPTIONS`).

> One sentence to hold in your head: **every screen is a projection of the same per-ticket intelligence record.** If two screens disagree about a number, the record is the source of truth.

---

## ⓪ Finals Objective (read before touching code)

**This is not a refactor project. This is not a feature-expansion project. This is a presentation-hardening project.**

Success = a judge, in the first 20 seconds, can:
1. **See the value** — business outcomes (hours saved, knowledge created, opportunities) are the first thing on screen.
2. **Trust it** — every insight traces back to specific customer tickets.
3. **Understand the AI's decisions** — confidence and routing are explainable, not arbitrary.

Anything that does not serve those three goals is **out of scope for finals**. When in doubt, cut. Specifically **do NOT build**: more campaign templates (IG/TikTok/newsletter/landing), more personas, more charts, more dashboards, more model features. Polish what exists; surface what's hidden.

**Positioning discipline:** the product is **one thing — a Customer Intelligence Engine** — not a support bot + KB + analytics + marketing suite. Every screen is one stage of a single loop: **Answer → Learn → Discover → Act → Measure** (see [PRODUCT_NARRATIVE.md](./PRODUCT_NARRATIVE.md)). Keep that language in headers and nav.

### Sprint 1 — must ship (in priority order)
- **A. Impact dashboard** — replace raw counts with *Hours saved · Knowledge created · Product gaps found · Marketing opportunities*. Highest-ROI change.
- **B. Traceability** — every theme / campaign / brief / bench row shows *Derived from: [ticket IDs]*, each linking to the record page.
- **C. Confidence breakdown** — the 4-part weighted bar. This is the Responsible-AI story.
- **D. Routing explanation** — show the rule that fired and why, not just "HUMAN REVIEW".
- **E. The Intelligence Record page** (`/intelligence/[ticketId]`) — see §1.3. The clean way to implement traceability and the single best demo screen.

---

## 0. Honest current-state assessment (read this first)

Most of the backend the judges will ask about **already exists**. The work is mostly surfacing it and adding three genuinely-missing things (ROI, confidence decomposition, cost). Do not rebuild what's already here.

| Capability | Status | Where |
|---|---|---|
| Classify (type + persona + escalation flags + confidence) | ✅ built | [classify.ts](../web/lib/classify.ts) |
| Persona reconciliation (LLM + keyword vote) | ✅ built | `reconcilePersona` in [classify.ts](../web/lib/classify.ts#L119) |
| KB retrieval + scoring | ✅ built | [search.ts](../web/lib/search.ts), [kb.ts](../web/lib/kb.ts) |
| Nuanced routing (hard flags, liability pair, dual confidence, soft band) | ✅ built | [route.ts](../web/lib/route.ts) |
| Draft reply + citations | ✅ built | [draft.ts](../web/lib/draft.ts) |
| Gap detection → auto-drafted FAQ → approval status | ✅ built | [flag-gap.ts](../web/lib/flag-gap.ts), `gap_log.json` |
| Theme clusters with `ticket_ids`, persona & type breakdown | ✅ built | `theme_clusters.json` |
| Marketing brief + persona campaigns + external benchmark | ✅ built | `/brief`, `/campaigns`, `/bench` |
| **Lineage rendered across screens (ticket → theme → campaign)** | ❌ missing (data exists, UI doesn't join it) | NEW |
| **Impact/ROI dashboard (hours saved, $ saved, ROI×)** | ❌ missing | NEW |
| **Confidence *decomposition* (the 50/20/20/10 breakdown)** | ❌ missing (only a single `kb_confidence` number is stored) | NEW |
| **Cost telemetry (tokens & $ per ticket)** | ❌ missing (`resp.usage` is discarded in [llm.ts](../web/lib/llm.ts#L67)) | NEW |
| **Routing explained visually in UI** | ⚠️ partial (`route_reason` string exists, not shown as a framework) | enhance |
| **Theme trend deltas (▲42%)** | ❌ missing — but **computable for real** from `date_received` | NEW |

**Honesty note for the demo:** real route mix is **18 auto-reply / 42 human-review / 10 gaps** out of 70 ([run_summary.json](../web/public/data/run_summary.json)). The "62 draft-assisted / 6 auto-approved" reframing is legitimate — a `human_review` ticket *still gets a drafted reply*, so it's draft-*assisted*, not manual — but it is a **relabel, not new automation**. We will compute "draft-assisted = auto_reply + human_review" honestly and say so.

---

## 1. The core data model: one record, many projections

### 1.1 The canonical record

Everything the system knows about one inquiry lives in **one object**. We already produce ~80% of this in `TicketState` ([types.ts](../web/lib/types.ts)); we are extending it, not inventing it.

```ts
// web/lib/types.ts — extend TicketState with these fields
type IntelligenceRecord = TicketState & {
  // --- NEW: confidence decomposition (Layer 5) ---
  confidence_breakdown?: {
    kb_similarity: number;      // 0..1, weight 0.50  (= kb_hits[0].adjusted_score)
    citation_coverage: number;  // 0..1, weight 0.20  (= share of reply claims with a cite)
    historical_match: number;   // 0..1, weight 0.20  (= max sim to a *resolved* gap/FAQ)
    intent_certainty: number;   // 0..1, weight 0.10  (= classification_confidence)
    composite: number;          // weighted sum — THIS drives routing display
  };
  // --- NEW: cost telemetry (Layer "cost") ---
  cost?: {
    input_tokens: number;
    output_tokens: number;
    usd: number;                // computed from token counts × model price
    llm_calls: number;          // classify + draft (+ kb_entry if gap)
  };
  // --- already present, keep ---
  // route, route_reason, kb_confidence, reply_citations, gap_theme, ...
};
```

> **Important:** keep `kb_confidence` as the raw retrieval score (routing still uses it — do not break [route.ts](../web/lib/route.ts)). `confidence_breakdown.composite` is a *display + explainability* artifact. If you want routing to use the composite later, change one constant — but not for finals.

### 1.2 The projections (every screen derives from records)

| Screen | Projection = function of records |
|---|---|
| Overview / Impact | `aggregate(records)` → counts, hours saved, $ cost, $ saved, ROI |
| Inbox / ticket detail | `record` (1:1) |
| Knowledge gaps | `records.filter(r => r.route === 'knowledge_gap')` + lifecycle status |
| Themes | `groupBy(records, theme)` → already materialized in `theme_clusters.json` via `ticket_ids` |
| Marketing brief | `themes.map(t => signal(t))` — evidence = `t.ticket_ids` |
| Campaigns | `personas.map(p => campaign(records.filter persona==p))` |
| External benchmark | `themes ⋈ external_sentiment` on theme |

**The single most credibility-moving change:** every derived screen must render **"Derived from: N tickets"** with the actual ticket IDs linking to the record page (§1.3). The IDs are already in `theme_clusters.json`. This is the lineage that proves nothing was hand-authored.

### 1.3 The Intelligence Record page (`/intelligence/[ticketId]`)

The canonical, top-to-bottom view of one record — the source of truth that every other screen links to. It renders the whole vertical story on one page:

```
Customer question
   ↓ intent + entities            (question_type, escalation_flags)
   ↓ buyer signal + evidence      (buyer_persona + persona_keyword_hits chips)
   ↓ KB hits with scores          (kb_hits[], sources)
   ↓ confidence breakdown         (4-part ConfidenceBar)
   ↓ routing decision             (RoutingLegend with fired rule highlighted)
   ↓ drafted reply + citations    (reply_draft, reply_citations)
   ↓ knowledge contribution       (if gap → the drafted FAQ + lifecycle status)
   ↓ theme membership             (themes whose ticket_ids include this id → link)
   ↓ campaign / marketing signal  (theme.marketing_signal → link to /brief, /campaigns)
   ↓ cost                         (tokens + $ for this ticket)
```

This is the demo centerpiece: it literally shows **one ticket → all outputs** on a single screen. Build it by joining existing data (`getTicket`, `getThemes` filtered by `ticket_ids.includes(id)`, `getGaps` by `ticket_id`). No new pipeline work. `DerivedFrom` chips everywhere point here.

---

## 2. The pipeline, layer by layer (mapped to real code)

The 16-layer mental model collapses to **9 real stages** in [pipeline.ts](../web/lib/pipeline.ts). Keep the narrative; here's what each maps to.

```
1. Inquiry            TicketInput                         (source of truth: ticket_id)
2. Intent + entities  classify()  → question_type, escalation_flags
3. Persona            classify()  → buyer_persona (+ reconcilePersona vote, with signals)
4. Retrieval (RAG)    searchKb()  → kb_hits[] with adjusted_score
5. Confidence         NEW computeConfidence() → confidence_breakdown   ← BUILD
6. Routing            decideRoute() → route + route_reason             (already nuanced)
7. Draft              draftReply() → reply_draft + reply_citations
8. Learning / gap     flagGap() + autoDraftKb() → gap_log lifecycle
9. Aggregate intel    cluster_themes / marketing_brief / external_bench
```

### Layer 3 — persona must show *evidence*, not a guess
`persona_keyword_hits` already exists on the state. Surface it:
> **Buyer signal: Health-conscious** — detected from `nickel allergy`, `skin reaction`, `hypoallergenic`. (vote: kept LLM, score 0.92)
The `reconcilePersona` reason string is already computed — render it.

### Layer 5 — confidence decomposition (NEW — `web/lib/confidence.ts`)
```ts
export function computeConfidence(state: TicketState): ConfidenceBreakdown {
  const kb_similarity   = state.kb_hits?.[0]?.adjusted_score ?? 0;
  const citation_coverage = clamp((state.reply_citations?.length ?? 0) / 2); // ≥2 cites = full
  const historical_match = bestSimilarityToResolvedKb(state); // reuse index, filter kind=gap/faq
  const intent_certainty = state.classification_confidence ?? 0;
  const composite = 0.50*kb_similarity + 0.20*citation_coverage
                  + 0.20*historical_match + 0.10*intent_certainty;
  return { kb_similarity, citation_coverage, historical_match, intent_certainty, composite };
}
```
Render it as a stacked bar with the four weighted contributions. **This is the Responsible-AI / explainable-AI win.**

### Layer 6 — routing as a visible framework
The logic in [route.ts](../web/lib/route.ts) already implements this table. Render it (don't reimplement):

| Condition (in priority order) | Route | Shown as |
|---|---|---|
| hard escalation flag | human_review | 🔴 Safety/liability → human |
| `question_type = order_status` | human_review | 🔴 Policy (SOP §5) → human |
| `health_conscious::materials_safety` | human_review | 🔴 Liability pair → human |
| classification conf < 0.55 | human_review | 🟠 Low intent certainty → human |
| KB conf < 0.50 | knowledge_gap | 🟣 Novel → answer + teach KB |
| KB conf ≥ 0.50 | human_review | 🟠 Draft for human review |

> **Policy update:** there is no auto-send path. Every reply is human-reviewed before sending; KB confidence only separates "novel (gap)" from "draft for review". (An earlier 0.72 "high-confidence → auto" band was removed when the policy moved to human-review-only.)

On each ticket, show **the rule that fired** = `route_reason` (already stored).

### Layer 8/9 — knowledge lifecycle as states, not a single screen
Promote `kb_draft_status` to an explicit lifecycle and show counts at each stage:
```
detected → assigned → answered → kb_drafted → approved → published → reused ×N
```
`gap_log.json` already carries `kb_draft_status` and `answer_provided_by_staff`. Add a `reuse_count` (see P1.3).

---

## 3. Metric definitions (what's real vs assumed)

Every number on the Impact dashboard must be defensible under "where did that come from?". Put a small ⓘ tooltip on each with its formula.

| Metric | Formula | Real / Assumed |
|---|---|---|
| Tickets processed | `records.length` | **real** |
| Draft-assisted | `auto_reply + human_review` (both get a draft) | **real** (relabel — say so) |
| Auto-approved | `route === auto_reply` | **real** |
| Knowledge gaps | `route === knowledge_gap` | **real** |
| Model cost ($) | `Σ cost.usd` from token usage × price | **real** once usage is captured (P0.4) |
| Avg cost / ticket | `Σ cost.usd / records.length` | **real** |
| Hours saved | `draftAssisted × (T_scratch − T_review) / 60` | **assumption** — default `T_scratch=8min`, `T_review=2min` → 6 min saved/ticket. Show the assumption inline. |
| Human cost saved ($) | `hoursSaved × loaded_hourly_rate` | **assumption** — default `$18/hr`. Show it. |
| ROI × | `humanCostSaved / modelCost` | **derived** from the two above |
| Theme trend Δ | bucket `ticket_ids` by `date_received` into first-half vs second-half of the date range; `Δ = (late − early)/early` | **real** (timestamps exist) — label "within sample window" |

> Put the three assumptions (`T_scratch`, `T_review`, `hourly_rate`, `model price`) in **one config object** `web/lib/economics.ts` so a judge question = one edit. Never bury a constant in JSX.

---

## 4. Work breakdown

### P0 — must ship for finals
1. **Impact dashboard** replaces the four raw stats on [page.tsx](../web/app/page.tsx). New top row: **Hours saved · New knowledge created · Product-page gaps · Marketing opportunities**, with a secondary row for cost/ROI. Each stat has a formula tooltip. → new `web/lib/economics.ts`, new `<ImpactStat>` component.
2. **Cross-screen traceability.** Add a reusable `<DerivedFrom ticketIds={[...]} />` chip that links each ID to `/inbox/[id]`. Drop it on: each theme, the marketing brief sections, each persona campaign, each bench row. Data already present (`ticket_ids`).
3. **Confidence decomposition** (`web/lib/confidence.ts`) + a `<ConfidenceBar>` stacked component on the ticket detail page and live pipeline.
4. **Cost telemetry.** Thread `resp.usage` out of [llm.ts](../web/lib/llm.ts) `call()`/`callJson()` (return `{text, usage}` or attach to a per-run accumulator), sum per ticket into `cost`, persist to `drafted_replies.json` via the export script. Add `model_price` to `economics.ts`.
5. **Routing framework panel** — render the §2 Layer-6 table once (static legend) + show the fired rule (`route_reason`) on every ticket with the matching colour.

### P1 — strong, do if P0 lands with time
1. Theme **trend deltas** from `date_received` bucketing (real).
2. **Marketing opportunity score** per theme: `0.4·volume_norm + 0.3·persona_spread + 0.3·external_strength` → 0–10. Show the inputs.
3. KB **reuse counter**: when a live `/live` ticket's top KB hit is a `kind=gap`-derived entry, increment that gap's `reuse_count`. Closes the loop visibly.
4. **Buyer-signal** relabel of "persona" everywhere + evidence chips (`persona_keyword_hits`).

### P2 — only if everything above is solid
1. Persona campaign asset expansion (newsletter/IG/TikTok/landing variants).
2. Persona evolution sparkline (`3 → 10 → 19`) from date buckets.
3. Campaign impact forecast ("reduce support volume ~12%") — clearly labeled as a model.

### Nav restructure (cheap, high-narrative-value)
Group the sidebar to mirror the architecture: **Operations** (Inbox, Pipeline, Reviews) · **Knowledge** (KB, Gaps, Learning loop) · **Intelligence** (Themes, Personas, Marketing) · **Action** (Campaigns, Benchmark, Executive summary). Pure routing/labels.

---

## 5. The demo user story (the one flow to wire airtight)

**One ticket, five acts. Use the engraving / Father's-Day gifting ticket.**

1. **Ask** — customer: *"Can I engrave this and receive it before Father's Day?"*
2. **Understand** — UI shows: intent `engraving`, **buyer signal `gifter`** with evidence chips, KB hits with scores.
3. **Decide** — **ConfidenceBar** (4 weighted parts) → composite → **routing rule that fired** (coloured) → drafted reply **with citations**.
4. **Learn** — same ticket appears as: a **theme** (gifting), contributes to the **gifter segment**, and (if novel) a **drafted FAQ** in the lifecycle.
5. **Act** — surfaces as a **"Father's Day Engraving" campaign** with `Derived from: [these ticket IDs]`.

Narration line: **"One question became a customer response, a knowledge asset, and a marketing campaign — that's the whole product."**

### Acceptance criteria (demo is "done" when…)
- [ ] Impact dashboard is the first thing on screen; hours-saved/knowledge/gaps/opportunities visible without scrolling.
- [ ] Every theme, brief section, campaign, and bench row shows **Derived from: N tickets** with clickable IDs.
- [ ] Ticket detail shows the 4-part **confidence bar** and the **fired routing rule** in its colour.
- [ ] At least one ticket's cost in `$` is real (from token usage), and the dashboard's total cost ties to the sum.
- [ ] The engraving ticket traces ticket → reply → theme → campaign with no dead links.
- [ ] Every assumption-based number has a visible formula/assumption tooltip.

---

## 6. Guardrails for the implementer
- **Don't break routing.** `route.ts` consumes raw `kb_confidence`; the new composite is display-only.
- **One source of truth for constants** → `web/lib/economics.ts`. No magic numbers in components.
- **Label real vs assumed** on the UI itself, not just in code comments. Judges reward the honesty.
- **Heed [web/AGENTS.md](../web/AGENTS.md):** this Next.js has local breaking changes — check `node_modules/next/dist/docs/` before using unfamiliar APIs.

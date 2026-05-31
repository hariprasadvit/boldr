# 01 · Project Overview

## What is Boldr?
**Boldr Supply Co.** is a Singapore-based watch micro-brand selling **titanium watches,
straps, and watch servicing** through Shopify. Its buyers are considered, niche customers
who care about **materials** (titanium grade, BPA-free straps), **customisation** (engraving,
strap compatibility), and **after-sales service** (battery, regulation, full service). A
**3-person CS team** answers all inbound enquiries over email (Gmail).

## The problem
Most enquiries are answerable from existing documents (rate cards, product specs, a manually
maintained FAQ) — but the process is **entirely manual** and has **no memory**. Every question
is answered and forgotten. Novel questions — the ones that reveal what buyers actually care
about (e.g. "Is this BPA-free?") — vanish into the inbox instead of feeding product and
marketing strategy.

## What we're building
An AI workflow that turns reactive support into a **self-improving intelligence engine**.
**Explicitly not a chatbot** — every inbound enquiry produces **three** outputs:

1. **A drafted reply** in Boldr's brand voice (queued for human approval before sending).
2. **A knowledge-base update** — novel questions are flagged and an FAQ entry is auto-drafted.
3. **A marketing signal** — themes are clustered and rolled into a brief: *"what customers
   are asking that isn't on your product pages,"* tagged by buyer persona.

## The intelligence loop (from the brief)
| Step | Action |
|------|--------|
| 1 | **Ingest** the enquiry; extract intent + context. |
| 2 | **Search** the knowledge base (FAQ, rate cards, product specs, SOP). |
| 3 | **Answerable?** → draft a brand-voice reply, **queue for human approval**. |
| 4 | **Not answerable?** → flag a knowledge gap, route to staff with context. **Never hallucinate.** |
| 5 | **Auto-draft a KB entry** once a human resolves the gap (1-click approve). |
| 6 | **Theme clustering** (weekly) — group novel questions by theme. |
| 7 | **Marketing brief** (monthly) — persona-tagged "what's missing from product pages." |
| Bonus | **External benchmark** — compare internal signals vs forum/review sentiment. |

The full brief is in [challenge_brief.md](challenge_brief.md).

## The 5 buyer personas (canonical)
Defined in `data/08_buyer_personas.csv`; every enquiry is tagged with exactly one:
`health_conscious`, `gifter`, `enthusiast`, `active`, `sustainable`.

## Definition of done (engineering)
A single, production-grade app the Boldr team could actually run and own:
- one backend (FastAPI) exposing the loop as an API,
- a real **human-in-the-loop approval queue** (durable pause/resume),
- a **self-improving KB** (gaps → human resolves → KB grows),
- weekly/monthly **intelligence** outputs,
- a React UI on top,
- explainable, tested, and deployable.

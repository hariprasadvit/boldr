# Echelon 2026 · Boldr Challenge Brief

> Converted from `data/Boldr_Challenge_Brief_v2-16May1pm.pdf` via Microsoft MarkItDown + PDF text extraction. Source of truth for requirements.

## About Boldr
Singapore-based watch micro-brand selling **titanium watches, straps, and watch servicing** through Shopify. Niche, considered buyers who care about **materials** (titanium grade, alloy, BPA-free straps), **customisation** (engraving, strap compatibility), and **after-sales service** (battery, regulation, full service). A **3-person CS team** handles all inbound enquiries over **email (Gmail)**.

Stack: Shopify · Email support · 3 staff · open-source tool preference.

## The Problem
Dozens of enquiries/week, mostly answerable from existing KB docs (rate cards, product specs, a manually-updated FAQ) — but the process is **entirely manual**. No memory, no feedback loop, no intelligence layer. Novel questions disappear into inboxes instead of feeding product & marketing strategy.

**Pain points:** manual drafting; KB updated inconsistently; no visibility on trending themes; 3-person team stretched; zero signal from support → marketing.

**Missed opportunities:** BPA-free straps (marketing angle nobody uses); sustainability buyers (growing segment); nickel-allergy queries (product-page gap); health-conscious parents (untargeted persona); vegan strap questions (new trend, 3 tickets/6wks); corporate gifting (recurring, no bulk pricing).

**Core insight:** one "Is this BPA-free?" ticket → product-page update + campaign — but only because a human noticed. **Make that automatic, at scale.**

## The Challenge
Build an AI workflow that turns reactive support into a **self-improving intelligence engine**: answers questions, identifies gaps, updates its own KB, and generates marketing signals automatically.

### Core Intelligence Loop (7 steps)
| Step | Action | Detail |
|------|--------|--------|
| 1 | Ingest enquiry | Receive customer email. Extract question intent and context. |
| 2 | Search Knowledge Base | Query KB docs, rate cards, FAQ, product specs for a relevant answer. |
| 3 | Answerable? → Draft reply | If YES: draft a reply in Boldr's brand voice. **Queue for human approval before sending.** |
| 4 | Not answerable? → Flag gap | If NO: flag as knowledge gap. Route to CS staff with context. **Do NOT hallucinate.** |
| 5 | Auto-draft KB entry | Once human resolves the gap, auto-draft a new KB entry in Boldr's format for **1-click approval**. |
| 6 | Theme clustering | **Weekly:** group novel questions by theme (materials, sustainability, sizing, gifting). |
| 7 | Marketing brief | **Monthly:** "What customers are asking that is not on your product pages" — with **buyer persona tags**. |

### Buyer Personas
The workflow **must tag each enquiry against one of five buyer personas** derived from the sample ticket data. Theme clustering feeds persona identification → drives the marketing brief.

### Bonus — External Sentiment Benchmarking
- Identify **2+ external sources** (watch forums, Reddit, competitor reviews); explain why each is appropriate and what buyer signals it captures.
- Compare internal vs external sentiment on **3+ themes**.
- For each theme output: **"Is this a Boldr-specific gap or a market-wide concern? What should Boldr do?"**

## Sample Data Provided (6 raw input files)
| File | Contains | Role |
|------|----------|------|
| 01_customer_tickets.csv | Anonymised inbound emails (subject, body, date) | **Primary INPUT** |
| 02_product_reference.docx | Models, specs, strap catalogue, safety flags, quick-answer table | KB source — product/materials |
| 03a_rate_card_engraving.csv | Engraving pricing, char limits, scripts, turnaround | KB source — engraving |
| 03b_rate_card_servicing.csv | Servicing tiers + pricing by model | KB source — servicing |
| 04_faq_document.pdf | 28 FAQ entries built over time | KB source — primary store |
| 05_cs_sop.docx | CS SOP: handling per enquiry type, escalation rules, tone + **live log of new unanswered questions** | KB source — routing/process |

## Platform Guidance
Any automation platform/framework allowed; open-source / low-code (n8n, Make.com) encouraged for transparency. What matters: **well-architected, explainable, and something the Boldr team could actually use and own.**

## Deliverable note
No pre-built outputs or ideal answer formats are given — builders decide how to structure, parse, and use these documents.

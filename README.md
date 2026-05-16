# Boldr Customer Intelligence Engine

A self-improving customer intelligence engine for Boldr Supply Co. — built for Echelon 2026 AI Workflow Competition.

**Not a chatbot.** Every customer enquiry becomes drafted reply + knowledge base intelligence + marketing signal.

## What it does

1. **Ingest** — reads inbound customer tickets (CSV in this demo; Gmail in production)
2. **Classify** — extracts question_type, buyer persona, escalation flags
3. **Search** — hybrid retrieval over FAQ + product specs + rate cards
4. **Route** — confidence-thresholded auto-reply OR human-gated queue
5. **Draft** — brand-voice reply citing KB sources internally
6. **Flag gaps** — novel questions logged with auto-drafted KB entry for 1-click approval
7. **Cluster themes** — group novel questions into themes weekly
8. **Marketing brief** — monthly persona-tagged intelligence: "what customers ask that isn't on your product pages"
9. **External benchmark** — cross-check internal signals vs forum/review sentiment

## Setup

```bash
cd /Users/hariprasad/boldr-intel
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env — paste your ANTHROPIC_API_KEY
```

## Run

```bash
# 1. Build the knowledge base (one-time, ~30s)
python -m kb.ingest

# 2. Replay all 70 tickets through the pipeline (~3-5 min)
python batch_replay.py

# 3. Generate intelligence outputs (clusters + marketing brief + external benchmark)
python -m intelligence.cluster_themes
python -m intelligence.marketing_brief
python -m intelligence.external_bench

# 4. Launch the demo dashboard
streamlit run demo_app.py
```

## Project layout

```
boldr-intel/
├── data/                    # source files (tickets, KB sources, personas, sentiment)
├── kb/ingest.py             # parse + chunk + embed → ChromaDB
├── agent/
│   ├── graph.py             # LangGraph state machine
│   ├── state.py             # TicketState
│   ├── nodes/               # classify, search, route, draft, gap, kb_draft
│   └── prompts/             # all prompts as plain text
├── intelligence/
│   ├── cluster_themes.py    # HDBSCAN-style clustering of novel questions
│   ├── marketing_brief.py   # monthly intel report generator
│   └── external_bench.py    # internal vs external sentiment cross-check
├── batch_replay.py          # process all tickets through the graph
├── demo_app.py              # Streamlit dashboard
└── outputs/                 # all generated artefacts (replies, gaps, briefs)
```

## Demo gotchas to call out

- **SOP price drift**: `05a_SOP.txt` lists Regulation Service at SGD 60; the actual rate card `03b` says SGD 85. The agent prefers the rate card. Watch this on TKT-1062.
- **Order ID mismatches**: TKT-1009, TKT-1029, TKT-1040, TKT-1043 have the field `order_id` differing from the order ID quoted in the message body. The agent flags these as data inconsistency rather than picking one.

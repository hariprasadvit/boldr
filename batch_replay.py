"""
Batch-replay all 70 tickets through the LangGraph pipeline.

Outputs to outputs/:
  - drafted_replies.csv      one row per ticket with reply, route, citations, confidence
  - gap_log_updated.csv      novel-question rows ready to merge into 07_knowledge_gap_log.csv
  - kb_drafts/<ticket>.md    one auto-drafted FAQ entry per knowledge gap
  - run_summary.json         counts by route / persona / question_type
"""
from __future__ import annotations

import csv
import json
import time
from collections import Counter
from pathlib import Path

from agent.graph import compiled
from agent.state import make_initial_state

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT / "outputs"
KB_DRAFTS = OUT / "kb_drafts"


def main(limit: int | None = None):
    OUT.mkdir(parents=True, exist_ok=True)
    KB_DRAFTS.mkdir(parents=True, exist_ok=True)

    graph = compiled()

    tickets = []
    with (DATA / "01_customer_tickets.csv").open() as f:
        for row in csv.DictReader(f):
            tickets.append(row)

    if limit:
        tickets = tickets[:limit]

    replies_rows = []
    gaps_rows = []
    counts = {"route": Counter(), "persona": Counter(), "question_type": Counter()}
    started = time.time()

    for i, t in enumerate(tickets, 1):
        print(f"[{i}/{len(tickets)}] {t['ticket_id']} — {t.get('subject', '')[:50]}")
        state = make_initial_state(t)
        try:
            final = graph.invoke(state)
        except Exception as e:
            print(f"  ! pipeline error: {e}")
            final = state
            final["route"] = "error"
            final["route_reason"] = str(e)

        route = final.get("route", "unknown")
        counts["route"][route] += 1
        counts["persona"][final.get("buyer_persona", "?")] += 1
        counts["question_type"][final.get("question_type", "?")] += 1

        replies_rows.append({
            "ticket_id": t["ticket_id"],
            "date_received": t.get("date_received", ""),
            "channel": t.get("channel", ""),
            "subject": t.get("subject", ""),
            "message_body": t.get("message_body", ""),
            "buyer_persona": final.get("buyer_persona", ""),
            "question_type": final.get("question_type", ""),
            "escalation_flags": "|".join(final.get("escalation_flags", [])),
            "kb_confidence": final.get("kb_confidence", 0.0),
            "kb_top_source": final.get("kb_top_source", ""),
            "route": route,
            "route_reason": final.get("route_reason", ""),
            "reply_draft": final.get("reply_draft", ""),
            "reply_citations": "|".join(final.get("reply_citations", [])),
        })

        if route == "knowledge_gap":
            gaps_rows.append({
                "ticket_id": t["ticket_id"],
                "date_first_seen": t.get("date_received", ""),
                "question_paraphrase": final.get("gap_paraphrase", ""),
                "theme": final.get("gap_theme", ""),
                "buyer_persona": final.get("buyer_persona", ""),
                "kb_confidence": final.get("kb_confidence", 0.0),
                "kb_draft_status": "drafted_pending_approval",
            })
            entry = final.get("kb_entry_draft", "")
            if entry:
                (KB_DRAFTS / f"{t['ticket_id']}.md").write_text(entry)

    # Write outputs
    if replies_rows:
        with (OUT / "drafted_replies.csv").open("w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(replies_rows[0].keys()))
            writer.writeheader()
            writer.writerows(replies_rows)

    if gaps_rows:
        with (OUT / "gap_log_updated.csv").open("w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(gaps_rows[0].keys()))
            writer.writeheader()
            writer.writerows(gaps_rows)

    summary = {
        "tickets_processed": len(tickets),
        "elapsed_seconds": round(time.time() - started, 1),
        "by_route": dict(counts["route"]),
        "by_persona": dict(counts["persona"]),
        "by_question_type": dict(counts["question_type"]),
        "knowledge_gaps_detected": len(gaps_rows),
    }
    (OUT / "run_summary.json").write_text(json.dumps(summary, indent=2))

    print("\n=== Summary ===")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    import sys
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else None
    main(limit=lim)

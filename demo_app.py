"""
Streamlit dashboard for the Boldr Customer Intelligence Engine.

Tabs:
  1. Live Pipeline   — paste a ticket, watch it flow through all 7 stages
  2. Batch Replay    — view all 70 processed tickets with filters
  3. Knowledge Gaps  — drafted KB entries for 1-click approval
  4. Theme Clusters  — what customers are clustering around
  5. Marketing Brief — the strategic monthly output
  6. External Bench  — internal vs external sentiment
"""
from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "outputs"
DATA = ROOT / "data"

st.set_page_config(page_title="Boldr Intel Engine", layout="wide", page_icon="⌚")

# ---------- Sidebar ----------
st.sidebar.title("Boldr Intel Engine")
st.sidebar.caption("Echelon 2026 · Self-improving CS pipeline")

if not (OUT / "drafted_replies.csv").exists():
    st.sidebar.error("No batch outputs yet.\nRun `python batch_replay.py` first.")
else:
    summary = json.loads((OUT / "run_summary.json").read_text()) if (OUT / "run_summary.json").exists() else {}
    st.sidebar.metric("Tickets processed", summary.get("tickets_processed", "—"))
    st.sidebar.metric("Knowledge gaps", summary.get("knowledge_gaps_detected", "—"))
    if "by_route" in summary:
        for k, v in summary["by_route"].items():
            st.sidebar.write(f"• `{k}`: {v}")

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "Live Pipeline", "Batch Replay", "Knowledge Gaps",
    "Theme Clusters", "Marketing Brief", "External Bench"
])

# ---------- Tab 1: Live Pipeline ----------
with tab1:
    st.header("Live Pipeline — single ticket")
    st.caption("Paste a customer message. Watch each node execute in order.")

    col_a, col_b = st.columns([1, 1])
    with col_a:
        name = st.text_input("Customer name", "Sample Customer")
        channel = st.selectbox("Channel", ["email", "chat", "whatsapp", "instagram_dm"])
        order_id = st.text_input("Order ID (optional)", "")
        subject = st.text_input("Subject", "Question about your watch")
        body = st.text_area(
            "Message body",
            "Hi, I have a nickel allergy. Can you confirm the buckle on the leather strap is nickel-free?",
            height=140,
        )
        run = st.button("▶ Run pipeline", type="primary")

    with col_b:
        if run:
            from agent.graph import compiled
            from agent.state import make_initial_state

            ticket = {
                "ticket_id": "LIVE-001",
                "customer_name": name,
                "customer_email": "live@example.com",
                "order_id": order_id,
                "channel": channel,
                "subject": subject,
                "message_body": body,
                "date_received": "live",
            }
            graph = compiled()
            with st.spinner("classify → search_kb → decide_route → draft / gap …"):
                final = graph.invoke(make_initial_state(ticket))

            st.subheader("Stage 1-2: Classify")
            st.json({
                "question_type": final.get("question_type"),
                "buyer_persona": final.get("buyer_persona"),
                "escalation_flags": final.get("escalation_flags", []),
                "classification_confidence": final.get("classification_confidence"),
            })

            st.subheader("Stage 3: KB Search (top hits)")
            for h in (final.get("kb_hits", []) or [])[:3]:
                with st.expander(f"sim={h['similarity']:.2f}  adj={h['adjusted_score']:.2f}  · {h['metadata'].get('source')}"):
                    st.code(h["text"][:600])

            st.subheader("Stage 4: Route decision")
            st.success(f"Route: **{final.get('route', '?')}**  —  {final.get('route_reason','')}")

            if final.get("reply_draft"):
                st.subheader("Stage 5: Drafted reply")
                st.markdown(f"```\n{final['reply_draft']}\n```")
                if final.get("reply_citations"):
                    st.caption("Citations: " + ", ".join(final["reply_citations"]))

            if final.get("kb_entry_draft"):
                st.subheader("Stage 6: Auto-drafted KB entry (1-click approve)")
                st.code(final["kb_entry_draft"])
        else:
            st.info("Fill the form and click **Run pipeline**.")

# ---------- Tab 2: Batch Replay ----------
with tab2:
    st.header("Batch Replay — all processed tickets")
    p = OUT / "drafted_replies.csv"
    if not p.exists():
        st.warning("Run `python batch_replay.py` to populate this view.")
    else:
        df = pd.read_csv(p)
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Tickets", len(df))
        c2.metric("Auto-replied", int((df["route"] == "auto_reply").sum()))
        c3.metric("Human review", int((df["route"] == "human_review").sum()))
        c4.metric("Knowledge gaps", int((df["route"] == "knowledge_gap").sum()))

        # Filters
        with st.expander("Filters", expanded=True):
            f_route = st.multiselect("Route", sorted(df["route"].dropna().unique()), default=[])
            f_persona = st.multiselect("Persona", sorted(df["buyer_persona"].dropna().unique()), default=[])
            f_qtype = st.multiselect("Question type", sorted(df["question_type"].dropna().unique()), default=[])
        view = df.copy()
        if f_route: view = view[view["route"].isin(f_route)]
        if f_persona: view = view[view["buyer_persona"].isin(f_persona)]
        if f_qtype: view = view[view["question_type"].isin(f_qtype)]

        st.dataframe(
            view[["ticket_id", "channel", "subject", "buyer_persona", "question_type",
                  "kb_confidence", "route", "escalation_flags"]],
            use_container_width=True,
            height=320,
        )

        st.subheader("Inspect a ticket")
        if len(view):
            tid = st.selectbox("Ticket ID", view["ticket_id"].tolist())
            row = view[view["ticket_id"] == tid].iloc[0]
            st.write(f"**Subject:** {row['subject']}")
            st.write(f"**Route:** `{row['route']}` — {row['route_reason']}")
            st.write(f"**KB confidence:** {row['kb_confidence']:.2f}  ·  top source: `{row['kb_top_source']}`")
            if row.get("escalation_flags"):
                st.warning(f"Escalation flags: {row['escalation_flags']}")
            st.markdown("**Drafted reply:**")
            st.markdown(f"```\n{row['reply_draft']}\n```")
            if row.get("reply_citations"):
                st.caption("Citations: " + str(row["reply_citations"]))

# ---------- Tab 3: Knowledge Gaps ----------
with tab3:
    st.header("Knowledge Gaps — auto-drafted KB entries")
    p = OUT / "gap_log_updated.csv"
    if not p.exists():
        st.info("No gaps detected yet. Run `python batch_replay.py` first.")
    else:
        df = pd.read_csv(p)
        st.write(f"**{len(df)} novel questions detected.** Each has an auto-drafted FAQ entry below.")
        st.dataframe(df, use_container_width=True)

        kb_dir = OUT / "kb_drafts"
        if kb_dir.exists():
            for md_file in sorted(kb_dir.glob("*.md")):
                with st.expander(f"📝 KB draft for {md_file.stem}"):
                    st.code(md_file.read_text())
                    st.button("✅ Approve & publish", key=f"approve_{md_file.stem}", disabled=True,
                             help="Wired to FAQ in production. Disabled in demo.")

# ---------- Tab 4: Theme Clusters ----------
with tab4:
    st.header("Theme Clusters")
    p = OUT / "theme_clusters.json"
    if not p.exists():
        st.info("Run `python -m intelligence.cluster_themes` to generate.")
    else:
        clusters = json.loads(p.read_text())
        for c in clusters:
            if c["size"] < 2:
                continue
            with st.expander(f"🎯 {c['theme_label']}  ·  {c['size']} tickets"):
                st.write(f"**Summary:** {c['theme_summary']}")
                st.write(f"**Marketing signal:** {c['marketing_signal']}")
                st.write(f"**Suggested action:** {c['suggested_action']}")
                col_p, col_q = st.columns(2)
                with col_p:
                    st.write("**Persona breakdown:**")
                    st.json(c["persona_breakdown"])
                with col_q:
                    st.write("**Sample questions:**")
                    for q in c["sample_questions"]:
                        st.write(f"- {q}")
                st.caption(f"Ticket IDs: {', '.join(c['ticket_ids'])}")

        singletons = [c for c in clusters if c["size"] < 2]
        if singletons:
            with st.expander(f"🔍 {len(singletons)} singleton / novel questions"):
                for c in singletons:
                    st.write(f"- {c['theme_summary']} _({c['ticket_ids'][0] if c['ticket_ids'] else ''})_")

# ---------- Tab 5: Marketing Brief ----------
with tab5:
    st.header("Marketing Brief")
    p = OUT / "marketing_brief.md"
    if not p.exists():
        st.info("Run `python -m intelligence.marketing_brief` to generate.")
    else:
        st.markdown(p.read_text())

# ---------- Tab 6: External Benchmark ----------
with tab6:
    st.header("External Sentiment Benchmark")
    p = OUT / "external_benchmark.md"
    if not p.exists():
        st.info("Run `python -m intelligence.external_bench` to generate.")
    else:
        st.markdown(p.read_text())
        with st.expander("Raw data"):
            jp = OUT / "external_benchmark.json"
            if jp.exists():
                st.json(json.loads(jp.read_text()))

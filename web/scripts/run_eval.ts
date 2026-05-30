/**
 * Score the TS pipeline (BM25 retrieval) against the same 70 tickets the Python
 * pipeline was scored on. Isolates the effect of swapping ChromaDB semantic
 * retrieval for BM25 keyword retrieval — same prompts, same LLM, only difference
 * is the search node.
 *
 * Reads:  /Users/hariprasad/boldr/data/01_customer_tickets.csv
 * Writes: /Users/hariprasad/boldr/evals/results/ts_predictions.csv (raw)
 *         /Users/hariprasad/boldr/evals/results/ts_baseline.json   (scored)
 *
 * Cost:   70 tickets × ~3 LLM calls × ~$0.005 ≈ $0.35–0.50 in OpenRouter credits
 * Time:   ~7–10 minutes
 *
 * Run from web/: npx tsx scripts/run_eval.ts
 */
import fs from "node:fs";
import path from "node:path";
import { runPipeline } from "../lib/pipeline";
import type { TicketState } from "../lib/types";

const REPO = path.resolve(__dirname, "..", "..");
const DATA_CSV = path.join(REPO, "data", "01_customer_tickets.csv");
const RESULTS_DIR = path.join(REPO, "evals", "results");
const PRED_CSV = path.join(RESULTS_DIR, "ts_predictions.csv");
const SCORE_JSON = path.join(RESULTS_DIR, "ts_baseline.json");

const ORDER_ID_MISMATCH_TICKETS = new Set(["TKT-1009", "TKT-1029", "TKT-1040", "TKT-1043"]);
const SOP_PRICE_DRIFT_TICKETS = new Set(["TKT-1062"]);

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  // Minimal CSV parser supporting quoted fields with commas and embedded quotes.
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  const header = rows[0];
  return rows.slice(1).filter((r) => r.length === header.length && r.some((c) => c.length))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const tickets = parseCsv(fs.readFileSync(DATA_CSV, "utf-8"));
  console.log(`Loaded ${tickets.length} tickets`);

  const predictions: Array<Record<string, string | number>> = [];
  const t0 = Date.now();

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    process.stdout.write(`[${i + 1}/${tickets.length}] ${t.ticket_id} — ${t.subject.slice(0, 50)}\n`);
    let state: TicketState;
    try {
      state = await runPipeline({
        ticket_id: t.ticket_id,
        customer_name: t.customer_name,
        customer_email: t.customer_email,
        order_id: t.order_id,
        channel: t.channel,
        subject: t.subject,
        message_body: t.message_body,
        date_received: t.date_received,
      });
    } catch (e) {
      console.error(`  ! pipeline error: ${(e as Error).message}`);
      state = { ticket_id: t.ticket_id, route: "human_review", route_reason: `error: ${(e as Error).message}` };
    }
    predictions.push({
      ticket_id: t.ticket_id,
      question_type: state.question_type ?? "",
      buyer_persona: state.buyer_persona ?? "",
      escalation_flags: (state.escalation_flags ?? []).join("|"),
      kb_confidence: state.kb_confidence ?? 0,
      kb_top_source: state.kb_top_source ?? "",
      route: state.route ?? "",
      reply_draft: (state.reply_draft ?? "").replace(/\n/g, " "),
    });
  }

  // Write predictions CSV
  const headers = Object.keys(predictions[0]);
  const csv = [
    headers.join(","),
    ...predictions.map((p) => headers.map((h) => csvEscape(String(p[h] ?? ""))).join(",")),
  ].join("\n");
  fs.writeFileSync(PRED_CSV, csv);
  console.log(`\nWrote ${path.relative(REPO, PRED_CSV)}`);

  // Score against ground truth
  const gtTickets = parseCsv(fs.readFileSync(DATA_CSV, "utf-8"));
  const gtByTid: Record<string, Row> = {};
  for (const t of gtTickets) gtByTid[t.ticket_id] = t;

  let n = 0, qtypeCorrect = 0, personaCorrect = 0, routeMatch = 0, highConfKb = 0, answerableCount = 0;
  let orderIdHits = 0, sopDrift = 0;
  const confusion: Record<string, Record<string, number>> = {};

  for (const p of predictions) {
    const gt = gtByTid[String(p.ticket_id)];
    if (!gt) continue;
    n++;

    if (gt.answered_by_kb.trim().toLowerCase() === "yes") answerableCount++;

    if (p.question_type === gt.question_type) qtypeCorrect++;
    const expQ = gt.question_type;
    if (!confusion[expQ]) confusion[expQ] = {};
    const got = String(p.question_type);
    confusion[expQ][got] = (confusion[expQ][got] ?? 0) + 1;

    if (p.buyer_persona === gt.buyer_persona) personaCorrect++;

    const expectedHuman = gt.requires_escalation.trim().toLowerCase() === "yes";
    const actualHuman = ["human_review", "knowledge_gap"].includes(String(p.route));
    if (expectedHuman === actualHuman) routeMatch++;

    if (gt.answered_by_kb.trim().toLowerCase() === "yes" && Number(p.kb_confidence) >= 0.5) highConfKb++;

    if (ORDER_ID_MISMATCH_TICKETS.has(gt.ticket_id)) {
      const flags = String(p.escalation_flags).split("|");
      if (flags.includes("order_id_mismatch")) orderIdHits++;
    }
    if (SOP_PRICE_DRIFT_TICKETS.has(gt.ticket_id)) {
      const reply = String(p.reply_draft).toLowerCase();
      if (reply.includes("sgd 60") || reply.includes("sgd60") || reply.includes("$60")) sopDrift++;
    }
  }

  const result = {
    pipeline: "typescript_bm25",
    n,
    elapsed_seconds: Math.round((Date.now() - t0) / 1000),
    metrics: {
      qtype_accuracy: +(qtypeCorrect / n).toFixed(3),
      persona_accuracy: +(personaCorrect / n).toFixed(3),
      route_match_rate: +(routeMatch / n).toFixed(3),
      kb_recall_when_answerable: +(highConfKb / Math.max(1, answerableCount)).toFixed(3),
      order_id_mismatch_detected: `${orderIdHits}/${ORDER_ID_MISMATCH_TICKETS.size}`,
      sop_price_drift_violations: sopDrift,
    },
    qtype_confusion: confusion,
  };
  fs.writeFileSync(SCORE_JSON, JSON.stringify(result, null, 2));
  console.log(`Wrote ${path.relative(REPO, SCORE_JSON)}\n`);

  const m = result.metrics;
  console.log(`=== TS pipeline (BM25 retrieval) — n=${n}, ${result.elapsed_seconds}s ===`);
  console.log(`  question_type accuracy:        ${(m.qtype_accuracy * 100).toFixed(1)}%`);
  console.log(`  buyer_persona accuracy:        ${(m.persona_accuracy * 100).toFixed(1)}%`);
  console.log(`  route match (human vs auto):   ${(m.route_match_rate * 100).toFixed(1)}%`);
  console.log(`  KB recall when answerable:     ${(m.kb_recall_when_answerable * 100).toFixed(1)}%`);
  console.log(`  order_id mismatch detected:    ${m.order_id_mismatch_detected}`);
  console.log(`  SOP price drift violations:    ${m.sop_price_drift_violations}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

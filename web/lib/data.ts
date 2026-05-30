import "server-only";
import fs from "node:fs";
import path from "node:path";
import { readLiveGapRows } from "./gap-sheet";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export type ProcessedTicket = {
  ticket_id: string;
  date_received: string;
  channel: string;
  subject: string;
  buyer_persona: string;
  question_type: string;
  escalation_flags: string;
  kb_confidence: number;
  kb_top_source: string;
  route: string;
  route_reason: string;
  reply_draft: string;
  reply_citations: string;
};

export type Gap = {
  ticket_id: string;
  date_first_seen: string;
  question_paraphrase: string;
  theme: string;
  buyer_persona: string;
  kb_confidence: number;
  kb_draft_status: string;
  kb_entry_draft?: string;
  answer_provided_by_staff?: string;
};

export type ThemeCluster = {
  cluster_id: number;
  size: number;
  theme_label: string;
  theme_summary: string;
  marketing_signal: string;
  suggested_action: string;
  persona_breakdown: Record<string, number>;
  question_type_breakdown: Record<string, number>;
  sample_questions: string[];
  ticket_ids: string[];
};

export type RunSummary = {
  tickets_processed: number;
  elapsed_seconds: number;
  by_route: Record<string, number>;
  by_persona: Record<string, number>;
  by_question_type: Record<string, number>;
  knowledge_gaps_detected: number;
};

function readJsonSafe<T>(filename: string, fallback: T): T {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function readTextSafe(filename: string, fallback = ""): string {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return fallback;
  return fs.readFileSync(p, "utf-8");
}

export function getTickets(): ProcessedTicket[] {
  return readJsonSafe<ProcessedTicket[]>("drafted_replies.json", []);
}

export function getTicket(id: string): ProcessedTicket | null {
  return getTickets().find((t) => t.ticket_id === id) ?? null;
}

export function getGaps(): Gap[] {
  const exported = readJsonSafe<Gap[]>("gap_log.json", []);
  const exportedIds = new Set(exported.map((gap) => gap.ticket_id));
  const live = readLiveGapRows()
    .filter((gap) => !exportedIds.has(gap.ticket_id))
    .map<Gap>((gap) => ({
      ticket_id: gap.ticket_id,
      date_first_seen: gap.date_logged,
      question_paraphrase: gap.question,
      theme: gap.theme_tag,
      buyer_persona: gap.persona_tag,
      kb_confidence: gap.kb_confidence,
      kb_draft_status: gap.kb_draft_status,
      kb_entry_draft: gap.kb_entry_draft,
      answer_provided_by_staff: gap.answer_provided_by_staff,
    }));
  return [...live, ...exported];
}

export function getThemes(): ThemeCluster[] {
  return readJsonSafe<ThemeCluster[]>("theme_clusters.json", []);
}

export function getSummary(): RunSummary | null {
  return readJsonSafe<RunSummary | null>("run_summary.json", null);
}

export function getBriefMd(): string {
  return readTextSafe("marketing_brief.md");
}

export function getBenchMd(): string {
  return readTextSafe("external_benchmark.md");
}

export type BenchRow = {
  theme: string;
  internal_ticket_count: number;
  internal_sample_ids: string[];
  external_mention_count: number;
  external_sentiment: Record<string, number>;
  external_signal_strength: string;
  external_sample_quotes: string[];
  external_relevance_notes: string[];
};

export function getBenchData(): BenchRow[] {
  return readJsonSafe<BenchRow[]>("external_benchmark.json", []);
}

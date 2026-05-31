export type Route = "auto_reply" | "human_review" | "knowledge_gap";

export type KbHit = {
  id: string;
  text: string;
  source: string;
  similarity: number;
  adjusted_score: number;
};

export type TicketInput = {
  ticket_id?: string;
  customer_name?: string;
  customer_email?: string;
  order_id?: string;
  channel?: string;
  subject?: string;
  message_body: string;
  date_received?: string;
};

export type PipelineResult = {
  ticket_id: string;
  question_type?: string;
  buyer_persona?: string;
  escalation_flags?: string[];
  classification_confidence?: number;
  kb_confidence?: number;
  kb_top_source?: string;
  route?: Route;
  route_reason?: string;
  reply_draft?: string;
  reply_citations?: string[];
  gap_paraphrase?: string;
  gap_theme?: string;
  kb_entry_draft?: string;
  kb_hits?: KbHit[];
  notes?: string[];
};

export type TicketOut = {
  id: string;
  ticket_id: string;
  channel: string;
  subject: string;
  message_body: string;
  order_id?: string | null;
  date_received?: string | null;
};

// Mirrors backend InboxReplyOut: a drafted reply joined to its ticket + run
// (route / confidence / persona / flags) — the inbox row shape.
export type ReplyOut = {
  id: string;
  ticket_id: string;
  subject: string;
  channel: string;
  body: string;
  citations: string[];
  status: string;
  route?: string | null;
  route_reason?: string | null;
  buyer_persona?: string | null;
  question_type?: string | null;
  kb_confidence?: number | null;
  kb_top_source?: string | null;
  escalation_flags?: string[];
};

export type GapOut = {
  id: string;
  ticket_id: string;
  paraphrase: string;
  theme?: string | null;
  buyer_persona?: string | null;
  status: string;
  kb_entry_draft?: string | null;
  kb_confidence?: number | null;
  date_first_seen?: string | null;
};

// Mirrors backend RunSummaryOut / OLD run_summary.json.
export type RunSummary = {
  tickets_processed: number;
  elapsed_seconds: number;
  by_route: Record<string, number>;
  by_persona: Record<string, number>;
  by_question_type: Record<string, number>;
  knowledge_gaps_detected: number;
};

export type PersonaOut = {
  persona_id: string;
  name: string;
  trigger_keywords: string[];
  marketing_opportunity: string;
  priority: string;
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

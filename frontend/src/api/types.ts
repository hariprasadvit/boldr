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
  confidence_breakdown?: ConfidenceBreakdown;
  cost?: TicketCost;
  notes?: string[];
};

export type ConfidenceComponent = {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  measured: boolean;
};

export type ConfidenceBreakdown = {
  components: ConfidenceComponent[];
  composite: number;
};

export type TicketCost = {
  input_tokens: number;
  output_tokens: number;
  usd: number;
  llm_calls: number;
};

export type ImpactSummary = {
  tickets_processed: number;
  auto_approved: number;
  draft_assisted: number;
  knowledge_gaps: number;
  new_knowledge_created: number;
  product_page_gaps: number;
  marketing_opportunities: number;
  hours_saved: number;
  human_cost_saved_usd: number;
  model_cost_usd: number;
  roi_multiple: number;
  avg_cost_per_ticket_usd: number;
  assumptions: {
    minutes_per_reply_from_scratch: number;
    minutes_to_review_draft: number;
    loaded_hourly_rate_usd: number;
    price_per_m_input_usd: number;
    price_per_m_output_usd: number;
  };
};

export type IntelligenceRecord = {
  ticket: {
    ticket_id: string;
    subject: string;
    channel: string;
    message_body: string;
    date_received?: string | null;
  };
  run?: {
    question_type?: string | null;
    buyer_persona?: string | null;
    escalation_flags: string[];
    kb_confidence?: number | null;
    kb_top_source?: string | null;
    route?: string | null;
    route_reason?: string | null;
  } | null;
  reply?: { body: string; citations: string[]; status: string } | null;
  gap?: {
    paraphrase: string;
    theme?: string | null;
    status: string;
    kb_entry_draft?: string | null;
  } | null;
  confidence_breakdown?: ConfidenceBreakdown | null;
  themes: ThemeCluster[];
  cost_estimate_usd: number;
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
  open_items?: OpenItem[];
  edited?: boolean;
  rating?: string | null;
};

export type OpenItem = { question: string; reason?: string };

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

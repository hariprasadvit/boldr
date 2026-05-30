export type Route = "auto_reply" | "human_review" | "knowledge_gap";

export type KbHit = {
  id: string;
  text: string;
  metadata: KbMetadata;
  similarity: number;
  adjusted_score: number;
  raw_score?: number;
  query_coverage?: number;
};

export type KbMetadata = {
  source: string;
  source_priority?: number;
  section?: string;
  question?: string;
  sku?: string;
  model_name?: string;
  kind?: string;
  gap_id?: string;
  theme?: string;
};

export type KbChunk = {
  id: string;
  text: string;
  metadata: KbMetadata;
};

export type TicketInput = {
  ticket_id?: string;
  customer_name?: string;
  customer_email?: string;
  order_id?: string;
  channel?: string;
  subject?: string;
  message_body?: string;
  date_received?: string;
};

export type TicketState = TicketInput & {
  question_type?: string;
  buyer_persona?: string;
  escalation_flags?: string[];
  classification_confidence?: number;
  persona_keyword_hits?: Record<string, number>;

  kb_hits?: KbHit[];
  kb_confidence?: number;
  kb_top_source?: string;

  route?: Route;
  route_reason?: string;

  reply_draft?: string;
  reply_citations?: string[];

  gap_paraphrase?: string;
  gap_theme?: string;
  kb_entry_draft?: string;

  notes?: string[];
};

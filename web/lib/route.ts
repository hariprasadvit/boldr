import type { TicketState } from "./types";

const HIGH_CONFIDENCE = 0.72;
const GAP_THRESHOLD = 0.5;
const MIN_CLASSIFICATION_CONFIDENCE = 0.55;

const HARD_HUMAN_FLAGS = new Set([
  "angry",
  "refund_overdue",
  "fulfilment_error",
  "corporate_bulk",
  "press_media",
  "high_liability",
  "order_id_mismatch",
  "older_model",
  "classification_error",
]);

const HARD_HUMAN_TYPES = new Set(["order_status"]);

const LIABILITY_PAIRS = new Set(["health_conscious::materials_safety"]);

export function decideRoute(state: TicketState): TicketState {
  const flags = new Set(state.escalation_flags ?? []);
  const qtype = state.question_type ?? "";
  const persona = state.buyer_persona ?? "";
  const confidence = state.kb_confidence ?? 0;
  const classificationConfidence = state.classification_confidence ?? 1;

  const hardFlagHits = [...flags].filter((f) => HARD_HUMAN_FLAGS.has(f));
  if (hardFlagHits.length) {
    return {
      ...state,
      route: "human_review",
      route_reason: `hard escalation flag(s): ${hardFlagHits.sort().join(", ")}`,
    };
  }

  if (HARD_HUMAN_TYPES.has(qtype)) {
    return {
      ...state,
      route: "human_review",
      route_reason: `question type '${qtype}' always needs a human (SOP §5)`,
    };
  }

  if (LIABILITY_PAIRS.has(`${persona}::${qtype}`)) {
    return {
      ...state,
      route: "human_review",
      route_reason: `liability pair: ${persona} asking ${qtype} — human-reviewed`,
    };
  }

  if (classificationConfidence < MIN_CLASSIFICATION_CONFIDENCE) {
    return {
      ...state,
      route: "human_review",
      route_reason: `classification confidence ${classificationConfidence.toFixed(2)} < ${MIN_CLASSIFICATION_CONFIDENCE} — draft for human`,
    };
  }

  if (confidence < GAP_THRESHOLD) {
    return {
      ...state,
      route: "knowledge_gap",
      route_reason: `KB confidence ${confidence.toFixed(2)} < ${GAP_THRESHOLD} — novel question`,
    };
  }

  if (confidence >= HIGH_CONFIDENCE) {
    return {
      ...state,
      route: "auto_reply",
      route_reason: `KB confidence ${confidence.toFixed(2)} ≥ ${HIGH_CONFIDENCE} — high confidence`,
    };
  }

  return {
    ...state,
    route: "human_review",
    route_reason: `KB confidence ${confidence.toFixed(2)} in soft band [${GAP_THRESHOLD}, ${HIGH_CONFIDENCE}) — draft for human`,
  };
}

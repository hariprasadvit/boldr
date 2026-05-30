import { callJson, fillTemplate, loadPrompt } from "./llm";
import { countKeywordHits, formatKeywordsForPrompt } from "./personas";
import type { TicketState } from "./types";

function detectOrderIdMismatch(orderIdField: string, body: string): boolean {
  if (!orderIdField) return false;
  const bodyIds = body.match(/\bBLD-\d{4,}\b/g) ?? [];
  if (!bodyIds.length) return false;
  return bodyIds.some((bid) => bid !== orderIdField);
}

type ClassifyResult = {
  question_type?: string;
  buyer_persona?: string;
  escalation_flags?: unknown;
  confidence?: unknown;
};

const VALID_QUESTION_TYPES = new Set([
  "order_status",
  "engraving",
  "servicing",
  "strap_compatibility",
  "materials_safety",
  "product_general",
  "knowledge_gap",
]);

const VALID_BUYER_PERSONAS = new Set([
  "health_conscious",
  "gifter",
  "enthusiast",
  "active",
  "sustainable",
]);

const VALID_ESCALATION_FLAGS = new Set([
  "angry",
  "refund_overdue",
  "fulfilment_error",
  "corporate_bulk",
  "press_media",
  "high_liability",
  "order_id_mismatch",
  "older_model",
]);

function clampConfidence(value: unknown): [number, boolean] {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return [0, false];
  if (confidence < 0 || confidence > 1) return [Math.min(1, Math.max(0, confidence)), false];
  return [confidence, true];
}

function validateResult(result: ClassifyResult): {
  questionType: string;
  buyerPersona: string;
  flags: string[];
  confidence: number;
  errors: string[];
} {
  const errors: string[] = [];

  let questionType = result.question_type;
  if (!questionType || !VALID_QUESTION_TYPES.has(questionType)) {
    errors.push(`invalid question_type: ${String(questionType)}`);
    questionType = "product_general";
  }

  let buyerPersona = result.buyer_persona;
  if (!buyerPersona || !VALID_BUYER_PERSONAS.has(buyerPersona)) {
    errors.push(`invalid buyer_persona: ${String(buyerPersona)}`);
    buyerPersona = "active";
  }

  const rawFlags = Array.isArray(result.escalation_flags) ? result.escalation_flags : [];
  if (result.escalation_flags !== undefined && !Array.isArray(result.escalation_flags)) {
    errors.push("escalation_flags was not an array");
  }

  const flags: string[] = [];
  for (const flag of rawFlags) {
    if (typeof flag === "string" && VALID_ESCALATION_FLAGS.has(flag)) {
      flags.push(flag);
    } else {
      errors.push(`invalid escalation flag: ${String(flag)}`);
    }
  }

  const [confidence, confidenceValid] = clampConfidence(result.confidence);
  if (!confidenceValid) errors.push(`invalid confidence: ${String(result.confidence)}`);

  if (errors.length && !flags.includes("classification_error")) flags.push("classification_error");

  return { questionType, buyerPersona, flags, confidence, errors };
}

/**
 * Combine the LLM's persona pick with deterministic trigger-keyword hits.
 *
 * The classify prompt now includes the trigger keywords (so the LLM has the
 * signal), but the LLM can still go off on subtle cases. The persona CSV gives
 * us a deterministic second opinion. This function decides how to merge.
 *
 * TODO ────────────────────────────────────────────────────────────────────────
 * Pick a strategy and implement the body. Three options worth considering —
 * each has different failure modes. The default below is a no-op that trusts
 * the LLM. Mirror your Python `reconcile_persona` choice here so the two
 * pipelines stay in agreement.
 *
 * A — "Hint only" (current default): trust the LLM since keywords are already
 *     in the prompt. No code needed.
 * B — "Hard override on dominant keyword evidence": if exactly one persona has
 *     hits >= 2 AND it differs from llmPersona, override.
 * C — "Confidence-weighted vote": score each persona as
 *     (keywordHits[p] * 0.4) + (p === llmPersona ? llmConfidence : 0); argmax.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function reconcilePersona(
  llmPersona: string,
  llmConfidence: number,
  keywordHits: Record<string, number>,
  _messageBody: string,
): { persona: string; reason: string } {
  // Strategy C — confidence-weighted vote
  // Each persona scores: (keyword_hits * 0.4) + (llmConfidence if it is the LLM's pick else 0)
  // Ties favour the LLM's pick for stability.
  const scores: Record<string, number> = {};
  for (const [pid, hits] of Object.entries(keywordHits)) {
    let s = hits * 0.4;
    if (pid === llmPersona) s += llmConfidence;
    scores[pid] = s;
  }

  let best = llmPersona;
  let bestScore = scores[llmPersona] ?? 0;
  for (const [pid, s] of Object.entries(scores)) {
    if (s > bestScore) {
      best = pid;
      bestScore = s;
    }
  }

  if (best === llmPersona) {
    return { persona: llmPersona, reason: `vote kept LLM (top score ${bestScore.toFixed(2)})` };
  }
  return {
    persona: best,
    reason: `vote override: ${best} (${bestScore.toFixed(2)}) > LLM=${llmPersona} (${(scores[llmPersona] ?? 0).toFixed(2)})`,
  };
}

export async function classify(state: TicketState): Promise<TicketState> {
  const prompt = fillTemplate(loadPrompt("classify"), {
    order_id: state.order_id || "(none provided)",
    channel: state.channel ?? "email",
    subject: state.subject ?? "",
    message_body: state.message_body ?? "",
    persona_keywords: formatKeywordsForPrompt(),
  });

  let result: ClassifyResult;
  try {
    result = await callJson<ClassifyResult>(
      "You are a precise customer service triage classifier. Output only valid JSON.",
      prompt,
      { maxTokens: 400 },
    );
  } catch (e) {
    return {
      ...state,
      question_type: "product_general",
      buyer_persona: "active",
      escalation_flags: ["classification_error"],
      classification_confidence: 0,
      notes: [...(state.notes ?? []), `classify error: ${(e as Error).message}`],
    };
  }

  const { questionType, buyerPersona, flags, confidence, errors } = validateResult(result);
  if (detectOrderIdMismatch(state.order_id ?? "", state.message_body ?? "")) {
    if (!flags.includes("order_id_mismatch")) flags.push("order_id_mismatch");
  }

  const bodyText = `${state.subject ?? ""} ${state.message_body ?? ""}`;
  const keywordHits = countKeywordHits(bodyText);
  const { persona: finalPersona, reason } = reconcilePersona(
    buyerPersona,
    confidence,
    keywordHits,
    bodyText,
  );

  const reconcileNote =
    finalPersona !== buyerPersona
      ? `persona reconcile: LLM=${buyerPersona} → ${finalPersona} (${reason})`
      : null;

  const newNotes = [
    ...(state.notes ?? []),
    ...(reconcileNote ? [reconcileNote] : []),
    ...(errors.length ? [`classify validation: ${errors.join("; ")}`] : []),
  ];

  return {
    ...state,
    question_type: questionType,
    buyer_persona: finalPersona,
    escalation_flags: flags,
    classification_confidence: confidence,
    persona_keyword_hits: keywordHits,
    notes: newNotes.length ? newNotes : state.notes,
  };
}

import { call, callJson, fillTemplate, loadPrompt } from "./llm";
import type { TicketState } from "./types";

type GapResult = { paraphrase?: string; theme?: string };

export async function flagGap(state: TicketState): Promise<TicketState> {
  const prompt =
    "A customer asked something not covered by our knowledge base. " +
    "Paraphrase the question generically (strip personal details) and tag the theme.\n\n" +
    `Customer message: ${state.message_body ?? ""}\n` +
    `Buyer persona (already tagged): ${state.buyer_persona ?? ""}\n\n` +
    "Themes to choose from: materials_safety, sustainability, product_specs, niche_use_case, " +
    "engraving, sales, servicing, sizing, gifting, other.\n\n" +
    "Return JSON only:\n" +
    '{"paraphrase": "<generic question>", "theme": "<one theme>"}';

  try {
    const result = await callJson<GapResult>(
      "You paraphrase customer questions for a knowledge gap log. Output only JSON.",
      prompt,
      { maxTokens: 200 },
    );
    return {
      ...state,
      gap_paraphrase: result.paraphrase ?? state.subject ?? "",
      gap_theme: result.theme ?? "other",
    };
  } catch (e) {
    return {
      ...state,
      gap_paraphrase: state.subject ?? "",
      gap_theme: "other",
      notes: [...(state.notes ?? []), `flag_gap error: ${(e as Error).message}`],
    };
  }
}

export async function autoDraftKb(state: TicketState): Promise<TicketState> {
  const prompt = fillTemplate(loadPrompt("kb_entry"), {
    message_body: state.message_body ?? "",
    theme: state.gap_theme ?? "other",
    persona: state.buyer_persona ?? "",
  });

  try {
    const text = await call(
      "You draft FAQ entries for the Boldr knowledge base in their exact format.",
      prompt,
      { maxTokens: 400 },
    );
    return { ...state, kb_entry_draft: text.trim() };
  } catch (e) {
    return {
      ...state,
      kb_entry_draft: "",
      notes: [...(state.notes ?? []), `auto_draft_kb error: ${(e as Error).message}`],
    };
  }
}

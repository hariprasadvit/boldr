import { getIndex } from "./kb";
import type { TicketState } from "./types";

const TOP_K = 5;

export function searchKb(state: TicketState): TicketState {
  const idx = getIndex();
  const query = `${state.subject ?? ""} — ${state.message_body ?? ""}`;
  const hits = idx.search(query, TOP_K);

  return {
    ...state,
    kb_hits: hits,
    kb_confidence: hits[0]?.adjusted_score ?? 0,
    kb_top_source: hits[0]?.metadata.source ?? "",
  };
}

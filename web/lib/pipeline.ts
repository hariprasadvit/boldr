import { classify } from "./classify";
import { searchKb } from "./search";
import { decideRoute } from "./route";
import { draftReply } from "./draft";
import { flagGap, autoDraftKb } from "./flag-gap";
import type { TicketInput, TicketState } from "./types";

export async function runPipeline(input: TicketInput): Promise<TicketState> {
  let state: TicketState = { ...input, notes: [] };

  state = await classify(state);
  state = searchKb(state);
  state = decideRoute(state);

  if (state.route === "knowledge_gap") {
    state = await flagGap(state);
    state = await autoDraftKb(state);
  } else {
    state = await draftReply(state);
  }

  return state;
}

import { call, fillTemplate, loadPrompt } from "./llm";
import type { KbHit, TicketState } from "./types";

const MAX_KB_CHARS = 6000;

function formatKb(hits: KbHit[]): string {
  const blocks: string[] = [];
  let used = 0;
  for (const h of hits) {
    const chunkId = h.id || h.metadata.source || "unknown";
    const block = `[${chunkId} | source=${h.metadata.source} | priority=${h.metadata.source_priority}]\n${h.text}\n`;
    if (used + block.length > MAX_KB_CHARS) break;
    blocks.push(block);
    used += block.length;
  }
  return blocks.length ? blocks.join("\n") : "(no KB hits)";
}

export async function draftReply(state: TicketState): Promise<TicketState> {
  const name = (state.customer_name ?? "").split(" ")[0] || "there";
  const kbContext = formatKb(state.kb_hits ?? []);

  const userPrompt = fillTemplate(loadPrompt("draft_reply"), {
    kb_context: kbContext,
    customer_name_first: name,
    customer_name: state.customer_name ?? "",
    channel: state.channel ?? "email",
    order_id: state.order_id || "(none)",
    subject: state.subject ?? "",
    message_body: state.message_body ?? "",
  });

  const text = await call(
    "You are a Boldr CS agent drafting a reply. Follow the brand voice and source-priority rules exactly.",
    userPrompt,
    { maxTokens: 600 },
  );

  let body = text;
  let cites: string[] = [];
  if (text.includes("CITATIONS:")) {
    const idx = text.lastIndexOf("CITATIONS:");
    body = text.slice(0, idx).trim();
    const tail = text.slice(idx + "CITATIONS:".length);
    cites = tail
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c && c.toLowerCase() !== "none");
  }

  return { ...state, reply_draft: body.trim(), reply_citations: cites };
}

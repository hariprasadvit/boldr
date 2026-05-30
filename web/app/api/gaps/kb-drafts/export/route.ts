import { getGaps } from "@/lib/data";
import { kbDraftRowsFromGaps, kbDraftRowsToCsv, type GapSheetRow } from "@/lib/gap-sheet";

export const runtime = "nodejs";

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const gapRows: GapSheetRow[] = getGaps().map((gap) => ({
    date_logged: gap.date_first_seen,
    ticket_id: gap.ticket_id,
    question: gap.question_paraphrase,
    theme_tag: gap.theme,
    persona_tag: gap.buyer_persona,
    kb_confidence: gap.kb_confidence,
    source_channel: "",
    route_reason: gap.kb_confidence < 0.5 ? `KB confidence ${gap.kb_confidence.toFixed(2)} < 0.5` : "",
    answer_provided_by_staff: gap.answer_provided_by_staff ?? "",
    kb_draft_status: gap.kb_draft_status,
    kb_entry_draft: gap.kb_entry_draft ?? "",
    review_status: "Needs review",
    human_notes: "",
  }));

  return new Response(kbDraftRowsToCsv(kbDraftRowsFromGaps(gapRows)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="boldr-kb-drafts-approval-sheet-${todayStamp()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

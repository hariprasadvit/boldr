import { NextRequest } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { appendKnowledgeGap } from "@/lib/gap-sheet";
import type { TicketInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: TicketInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.message_body) {
    return Response.json({ error: "message_body is required" }, { status: 400 });
  }

  const input: Required<TicketInput> = {
    ticket_id: body.ticket_id || `LIVE-${Date.now()}`,
    customer_name: body.customer_name || "Sample Customer",
    customer_email: body.customer_email || "live@example.com",
    order_id: body.order_id || "",
    channel: body.channel || "email",
    subject: body.subject || "",
    message_body: body.message_body,
    date_received: "live",
  };

  try {
    const result = await runPipeline(input);
    const gapSheetRow = appendKnowledgeGap(result);
    return Response.json({
      ...result,
      gap_sheet_row: gapSheetRow,
      notes: gapSheetRow
        ? [...(result.notes ?? []), "knowledge gap appended to separate gaps sheet"]
        : result.notes,
    });
  } catch (e) {
    return Response.json({
      ...input,
      route: "human_review",
      route_reason: "pipeline failed — draft for human",
      escalation_flags: ["pipeline_error"],
      classification_confidence: 0,
      kb_confidence: 0,
      notes: [`pipeline error: ${(e as Error).message}`],
    });
  }
}

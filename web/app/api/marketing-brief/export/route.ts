import { getGaps, getSummary, getThemes, getTickets } from "@/lib/data";
import { PERSONA_CAMPAIGNS } from "@/lib/campaigns";
import { loadPersonas } from "@/lib/personas";
import { createXlsx, type WorksheetSpec } from "@/lib/xlsx";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const PERSONA_OPTIONS = "gifter | health_conscious | enthusiast | active | sustainable";
const PERSONA_VALIDATION = ["gifter", "health_conscious", "enthusiast", "active", "sustainable"];
const REVIEW_STATUS_VALIDATION = ["Needs review", "Approved", "Edit requested", "Rejected"];
const PUBLISH_READY_VALIDATION = ["No", "Yes"];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows[0] ?? [];
  return rows
    .slice(1)
    .filter((cells) => cells.some(Boolean))
    .map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

function sourceMessagesByTicket(): Map<string, string> {
  const source = path.join(process.cwd(), "..", "data", "01_customer_tickets.csv");
  if (!fs.existsSync(source)) return new Map();
  return new Map(parseCsv(fs.readFileSync(source, "utf-8")).map((row) => [row.ticket_id, row.message_body]));
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function campaignRows(): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
      "Review Status",
      "Persona",
      "Persona Options",
      "Ticket Count",
      "Campaign Angle",
      "Marketing Opportunity",
      "Newsletter Subject",
      "Newsletter Preview",
      "Newsletter Body",
      "Instagram Format",
      "Instagram Hook",
      "Instagram Copy",
      "TikTok Format",
      "TikTok Hook",
      "TikTok Copy",
      "Human Notes",
    ],
  ];
  const summary = getSummary();

  for (const persona of PERSONA_CAMPAIGNS) {
    for (const angle of persona.angles) {
      const instagram = angle.assets.find((asset) => asset.platform === "Instagram");
      const tiktok = angle.assets.find((asset) => asset.platform === "TikTok");
      rows.push([
        "Needs review",
        persona.id,
        PERSONA_OPTIONS,
        summary?.by_persona?.[persona.id] ?? 0,
        angle.name,
        persona.opportunity,
        angle.newsletterSubject,
        angle.newsletterPreview,
        angle.newsletterBody,
        instagram?.format ?? "",
        instagram?.hook ?? "",
        instagram?.copy ?? "",
        tiktok?.format ?? "",
        tiktok?.hook ?? "",
        tiktok?.copy ?? "",
        "",
      ]);
    }
  }
  return rows;
}

function segmentationRows(): (string | number)[][] {
  const tickets = getTickets();
  const gapsByTicket = new Map(getGaps().map((gap) => [gap.ticket_id, gap]));
  const messageByTicket = sourceMessagesByTicket();
  const rows: (string | number)[][] = [
    [
      "Review Status",
      "Ticket ID",
      "Current Persona",
      "Corrected Persona",
      "Persona Options",
      "Question Type",
      "Route",
      "KB Confidence",
      "Theme / Gap",
      "Subject",
      "Customer Message",
      "Correction Notes",
    ],
  ];

  for (const ticket of tickets) {
    const gap = gapsByTicket.get(ticket.ticket_id);
    rows.push([
      "Needs review",
      ticket.ticket_id,
      ticket.buyer_persona,
      ticket.buyer_persona,
      PERSONA_OPTIONS,
      ticket.question_type,
      ticket.route,
      ticket.kb_confidence,
      gap?.theme ?? "",
      ticket.subject,
      messageByTicket.get(ticket.ticket_id) ?? "",
      "",
    ]);
  }
  return rows;
}

function gapRows(): (string | number)[][] {
  return [
    [
      "Review Status",
      "Ticket ID",
      "Persona",
      "Corrected Persona",
      "Theme",
      "Question",
      "Answer provided by staff",
      "KB Draft Status",
      "FAQ Entry Draft",
      "Human Notes",
    ],
    ...getGaps().map((gap) => [
      "Needs review",
      gap.ticket_id,
      gap.buyer_persona,
      gap.buyer_persona,
      gap.theme,
      gap.question_paraphrase,
      gap.answer_provided_by_staff ?? "",
      gap.kb_draft_status,
      gap.kb_entry_draft ?? "",
      "",
    ]),
  ];
}

function kbDraftRows(): (string | number)[][] {
  return [
    [
      "Approval Status",
      "Publish Ready",
      "Source Ticket ID",
      "Question",
      "Answer provided by staff",
      "Theme",
      "Persona",
      "KB Entry Draft",
      "Approver Notes",
    ],
    ...getGaps()
      .filter((gap) => gap.kb_entry_draft || gap.answer_provided_by_staff)
      .map((gap) => [
        "Needs review",
        "No",
        gap.ticket_id,
        gap.question_paraphrase,
        gap.answer_provided_by_staff ?? "",
        gap.theme,
        gap.buyer_persona,
        gap.kb_entry_draft ?? "",
        "",
      ]),
  ];
}

function themeRows(): (string | number)[][] {
  return [
    [
      "Theme",
      "Cluster Size",
      "Persona Mix",
      "Marketing Signal",
      "Suggested Action",
      "Sample Questions",
      "Human Priority",
      "Owner",
      "Notes",
    ],
    ...getThemes()
      .filter((theme) => theme.size > 1)
      .map((theme) => [
        theme.theme_label,
        theme.size,
        Object.entries(theme.persona_breakdown ?? {})
          .map(([persona, count]) => `${persona}: ${count}`)
          .join(", "),
        theme.marketing_signal,
        theme.suggested_action,
        theme.sample_questions.join(" | "),
        "",
        "",
        "",
      ]),
  ];
}

function personaRows(): (string | number)[][] {
  return [
    ["Persona ID", "Persona Name", "Priority", "Trigger Keywords", "Recommended Messaging", "Marketing Opportunity"],
    ...loadPersonas().map((persona) => [
      persona.id,
      persona.name,
      persona.priority,
      persona.trigger_keywords.join(", "),
      persona.recommended_messaging,
      persona.marketing_opportunity,
    ]),
  ];
}

function overviewRows(): (string | number)[][] {
  const summary = getSummary();
  return [
    ["Boldr Marketing Brief Export", ""],
    ["Generated", todayStamp()],
    ["Purpose", "Human review and editing of AI-generated segmentation, campaign angles, and KB feedback-loop outputs."],
    ["Persona Options", PERSONA_OPTIONS],
    ["Tickets Processed", summary?.tickets_processed ?? 0],
    ["Knowledge Gaps", summary?.knowledge_gaps_detected ?? 0],
    ["", ""],
    ["Suggested Review Flow", "1. Check Segmentation Review. 2. Correct any personas in Corrected Persona. 3. Review Campaign Matrix. 4. Approve themes and FAQ drafts."],
    ["KB Gap Loop", "Fill Answer provided by staff in Knowledge Gaps. n8n watches that column, asks Claude to draft the Boldr-format entry, then writes it to KB Drafts for approval."],
    ["Review Status Values", "Needs review | Approved | Edit requested | Rejected"],
    ["", ""],
    ["Persona", "Ticket Count"],
    ...Object.entries(summary?.by_persona ?? {}).map(([persona, count]) => [persona, count]),
  ];
}

export async function GET() {
  const sheets: WorksheetSpec[] = [
    { name: "Overview", rows: overviewRows(), widths: [28, 90] },
    {
      name: "Campaign Matrix",
      rows: campaignRows(),
      widths: [16, 18, 54, 12, 28, 48, 34, 44, 70, 18, 34, 60, 18, 34, 60, 42],
      validations: [{ range: "A2:A1000", options: REVIEW_STATUS_VALIDATION }],
    },
    {
      name: "Segmentation Review",
      rows: segmentationRows(),
      widths: [16, 18, 18, 18, 54, 20, 18, 14, 20, 42, 72, 46],
      validations: [
        { range: "A2:A1000", options: REVIEW_STATUS_VALIDATION },
        { range: "D2:D1000", options: PERSONA_VALIDATION },
      ],
    },
    {
      name: "Knowledge Gaps",
      rows: gapRows(),
      widths: [16, 18, 18, 18, 20, 58, 60, 24, 82, 44],
      validations: [
        { range: "A2:A1000", options: REVIEW_STATUS_VALIDATION },
        { range: "D2:D1000", options: PERSONA_VALIDATION },
      ],
    },
    {
      name: "KB Drafts",
      rows: kbDraftRows(),
      widths: [18, 14, 18, 58, 60, 22, 18, 82, 44],
      validations: [
        { range: "A2:A1000", options: REVIEW_STATUS_VALIDATION },
        { range: "B2:B1000", options: PUBLISH_READY_VALIDATION },
      ],
    },
    { name: "Theme Actions", rows: themeRows(), widths: [34, 12, 30, 70, 70, 58, 18, 20, 44] },
    { name: "Persona Reference", rows: personaRows(), widths: [20, 28, 14, 68, 70, 70] },
  ];

  const workbook = createXlsx(sheets);
  const body = new Uint8Array(workbook);
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="boldr-marketing-brief-${todayStamp()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

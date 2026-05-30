import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { TicketState } from "./types";

export type GapSheetRow = {
  date_logged: string;
  ticket_id: string;
  question: string;
  theme_tag: string;
  persona_tag: string;
  kb_confidence: number;
  source_channel: string;
  route_reason: string;
  answer_provided_by_staff: string;
  kb_draft_status: string;
  kb_entry_draft: string;
  review_status: string;
  human_notes: string;
};

export type KbDraftSheetRow = {
  date_created: string;
  source_ticket_id: string;
  question: string;
  answer_provided_by_staff: string;
  theme_tag: string;
  persona_tag: string;
  kb_entry_draft: string;
  approval_status: string;
  approver_notes: string;
  publish_ready: string;
};

const GAP_COLUMNS: { key: keyof GapSheetRow; label: string }[] = [
  { key: "date_logged", label: "Date logged" },
  { key: "ticket_id", label: "Ticket ID" },
  { key: "question", label: "Question" },
  { key: "theme_tag", label: "Theme tag" },
  { key: "persona_tag", label: "Persona tag" },
  { key: "kb_confidence", label: "KB confidence" },
  { key: "source_channel", label: "Source channel" },
  { key: "route_reason", label: "Route reason" },
  { key: "answer_provided_by_staff", label: "Answer provided by staff" },
  { key: "kb_draft_status", label: "KB draft status" },
  { key: "kb_entry_draft", label: "KB entry draft" },
  { key: "review_status", label: "Review status" },
  { key: "human_notes", label: "Human notes" },
];

const KB_DRAFT_COLUMNS: { key: keyof KbDraftSheetRow; label: string }[] = [
  { key: "date_created", label: "Date created" },
  { key: "source_ticket_id", label: "Source ticket ID" },
  { key: "question", label: "Question" },
  { key: "answer_provided_by_staff", label: "Answer provided by staff" },
  { key: "theme_tag", label: "Theme tag" },
  { key: "persona_tag", label: "Persona tag" },
  { key: "kb_entry_draft", label: "KB entry draft" },
  { key: "approval_status", label: "Approval status" },
  { key: "approver_notes", label: "Approver notes" },
  { key: "publish_ready", label: "Publish ready" },
];

function sheetPath() {
  return path.join(process.cwd(), "..", "outputs", "live_gap_sheet.csv");
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
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

  const headers = rows[0] ?? [];
  return rows
    .slice(1)
    .filter((cells) => cells.some(Boolean))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

export function gapRowToCsv(row: GapSheetRow): string {
  return GAP_COLUMNS.map(({ key }) => escapeCsv(row[key])).join(",");
}

export function gapRowsToCsv(rows: GapSheetRow[]): string {
  return [GAP_COLUMNS.map(({ label }) => label).join(","), ...rows.map(gapRowToCsv)].join("\n") + "\n";
}

function readCell(row: Record<string, string>, key: keyof GapSheetRow, label: string): string {
  return row[label] ?? row[key] ?? "";
}

function sectionForTheme(theme: string): string {
  const normalized = theme.toLowerCase();
  if (normalized.includes("strap")) return "Strap Compatibility";
  if (normalized.includes("service") || normalized.includes("polish") || normalized.includes("battery")) {
    return "Watch Servicing";
  }
  if (normalized.includes("shipping") || normalized.includes("order") || normalized.includes("discount")) {
    return "Orders & Shipping";
  }
  if (normalized.includes("allerg") || normalized.includes("material") || normalized.includes("safety")) {
    return "Materials & Safety";
  }
  return "General";
}

function staffAnswerDraft(row: GapSheetRow): string {
  const answer = row.answer_provided_by_staff.trim();
  if (!answer) return "";
  return [
    `Q: ${row.question}`,
    `A: ${answer}`,
    "",
    `Section: ${sectionForTheme(row.theme_tag)}`,
  ].join("\n");
}

export function kbDraftRowsFromGaps(rows: GapSheetRow[]): KbDraftSheetRow[] {
  return rows
    .map((row) => {
      const draft = row.kb_entry_draft.trim() || staffAnswerDraft(row);
      const hasStaffAnswer = Boolean(row.answer_provided_by_staff.trim());
      const approvalStatus = draft
        ? "Needs approval"
        : hasStaffAnswer
          ? "Ready for Claude draft"
          : "Waiting for staff answer";

      return {
        date_created: row.date_logged,
        source_ticket_id: row.ticket_id,
        question: row.question,
        answer_provided_by_staff: row.answer_provided_by_staff,
        theme_tag: row.theme_tag,
        persona_tag: row.persona_tag,
        kb_entry_draft: draft,
        approval_status: approvalStatus,
        approver_notes: "",
        publish_ready: "No",
      };
    })
    .filter((row) => row.kb_entry_draft || row.approval_status !== "Waiting for staff answer");
}

export function kbDraftRowsToCsv(rows: KbDraftSheetRow[]): string {
  return [
    KB_DRAFT_COLUMNS.map(({ label }) => label).join(","),
    ...rows.map((row) => KB_DRAFT_COLUMNS.map(({ key }) => escapeCsv(row[key])).join(",")),
  ].join("\n") + "\n";
}

export function readLiveGapRows(): GapSheetRow[] {
  const file = sheetPath();
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf-8")).map((row) => ({
    date_logged: readCell(row, "date_logged", "Date logged"),
    ticket_id: readCell(row, "ticket_id", "Ticket ID"),
    question: readCell(row, "question", "Question"),
    theme_tag: readCell(row, "theme_tag", "Theme tag"),
    persona_tag: readCell(row, "persona_tag", "Persona tag"),
    kb_confidence: Number(readCell(row, "kb_confidence", "KB confidence") || 0),
    source_channel: readCell(row, "source_channel", "Source channel"),
    route_reason: readCell(row, "route_reason", "Route reason"),
    answer_provided_by_staff: readCell(row, "answer_provided_by_staff", "Answer provided by staff"),
    kb_draft_status: readCell(row, "kb_draft_status", "KB draft status") || "drafted_pending_approval",
    kb_entry_draft: readCell(row, "kb_entry_draft", "KB entry draft"),
    review_status: readCell(row, "review_status", "Review status") || "Needs review",
    human_notes: readCell(row, "human_notes", "Human notes"),
  }));
}

export function appendKnowledgeGap(state: TicketState): GapSheetRow | null {
  if (state.route !== "knowledge_gap") return null;

  const file = sheetPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const existing = readLiveGapRows();
  if (state.ticket_id && existing.some((row) => row.ticket_id === state.ticket_id)) {
    return null;
  }

  const row: GapSheetRow = {
    date_logged: new Date().toISOString(),
    ticket_id: state.ticket_id ?? `LIVE-${Date.now()}`,
    question: state.gap_paraphrase || state.subject || state.message_body || "",
    theme_tag: state.gap_theme ?? "other",
    persona_tag: state.buyer_persona ?? "active",
    kb_confidence: Number((state.kb_confidence ?? 0).toFixed(3)),
    source_channel: state.channel ?? "",
    route_reason: state.route_reason ?? "",
    answer_provided_by_staff: "",
    kb_draft_status: state.kb_entry_draft ? "drafted_pending_approval" : "needs_kb_draft",
    kb_entry_draft: state.kb_entry_draft ?? "",
    review_status: "Needs review",
    human_notes: "",
  };

  fs.writeFileSync(file, gapRowsToCsv([...existing, row]));
  return row;
}

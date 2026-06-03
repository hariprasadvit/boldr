// Single API client (DRY) — all calls to the FastAPI backend go through here.
import type {
  BenchRow,
  GapOut,
  ImpactSummary,
  IntelligenceRecord,
  PersonaOut,
  PipelineResult,
  ReplyOut,
  RunSummary,
  ThemeCluster,
  TicketInput,
  TicketOut,
} from "./types";

export const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";
const BASE = API_BASE;

/** Absolute URL for a file/download endpoint (xlsx exports etc.). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.detail || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  runPipeline: (ticket: TicketInput) =>
    request<PipelineResult>("/pipeline/run", { method: "POST", body: JSON.stringify(ticket) }),
  listTickets: () => request<TicketOut[]>("/tickets"),
  listReplies: (status?: string) =>
    request<ReplyOut[]>(`/tickets/replies${status ? `?status=${status}` : ""}`),
  decideReply: (replyId: string, decision: string) =>
    request<ReplyOut>(`/approvals/replies/${replyId}`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),
  listGaps: (status = "open") => request<GapOut[]>(`/gaps?status=${status}`),
  resolveGap: (gapId: string, resolution: string) =>
    request<GapOut>(`/gaps/${gapId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    }),
  publishGap: (gapId: string, answer?: string) =>
    request<{ gap: GapOut; published: boolean; chunk_key: string | null }>(
      `/gaps/${gapId}/publish`,
      { method: "POST", body: JSON.stringify({ answer: answer ?? null }) },
    ),
  personas: () => request<PersonaOut[]>("/intelligence/personas"),
  summary: () => request<RunSummary>("/intelligence/summary"),
  impact: () => request<ImpactSummary>("/intelligence/impact"),
  record: (ticketId: string) =>
    request<IntelligenceRecord>(`/intelligence/record/${encodeURIComponent(ticketId)}`),
  themes: () => request<{ clusters: ThemeCluster[] }>("/intelligence/themes"),
  marketingBrief: () => request<{ markdown: string }>("/intelligence/marketing-brief"),
  externalBench: () => request<{ markdown: string; data: BenchRow[] }>("/intelligence/external-bench"),
};

import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { EmptyState, Pill, RouteBadge, SectionHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import type { ReplyOut } from "@/api/types";

type Tab = { key: string; label: string; match: (r: ReplyOut) => boolean };

// The inbox as a work queue: a ticket's reply status IS its lifecycle. Every reply
// is human-reviewed before sending, so the queue is Needs review -> Resolved.
const TABS: Tab[] = [
  { key: "needs_review", label: "Needs review", match: (r) => r.status === "draft" || r.status === "approved" },
  { key: "resolved", label: "Resolved", match: (r) => r.status === "sent" },
  { key: "all", label: "All", match: () => true },
];

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  draft: { text: "needs review", color: "amber" },
  sent: { text: "resolved", color: "emerald" },
  approved: { text: "needs review", color: "amber" },
  rejected: { text: "rejected", color: "rose" },
};

export function InboxPage() {
  const replies = useAsync(() => api.listReplies(), []);
  const tickets = useAsync(() => api.listTickets(), []);
  const [tab, setTab] = useState("needs_review");

  if (replies.loading || tickets.loading) {
    return <SectionHeader title="Inbox" subtitle="Loading…" />;
  }

  const replyRows = replies.data ?? [];
  const rows: ReplyOut[] = replyRows.length
    ? replyRows
    : (tickets.data ?? []).map((t) => ({
        id: t.ticket_id,
        ticket_id: t.ticket_id,
        subject: t.subject,
        channel: t.channel,
        body: "",
        citations: [],
        status: "draft",
      }));

  if (!rows.length) {
    return (
      <div>
        <SectionHeader title="Inbox" />
        <EmptyState title="No tickets processed yet." hint="Run the pipeline (run_baseline) first." />
      </div>
    );
  }

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const filtered = rows.filter(active.match);

  return (
    <div>
      <SectionHeader
        title="Inbox"
        subtitle="A work queue — each ticket flows from needs-review to resolved as a human completes it."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = rows.filter(t.match).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                tab === t.key
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                  : "border-[var(--border)] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.label} <span className="text-zinc-500">· {count}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="bg-zinc-950/50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Ticket</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Persona</th>
              <th className="px-4 py-3 font-medium">KB conf.</th>
              <th className="px-4 py-3 font-medium">Route</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.map((r) => {
              const st = STATUS_LABEL[r.status] ?? { text: r.status, color: "zinc" };
              const openCount = (r.open_items ?? []).length;
              return (
                <tr key={r.ticket_id} className="hover:bg-zinc-950/40">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                    <Link to={`/inbox/${r.ticket_id}`} className="hover:text-[var(--accent)]">
                      {r.ticket_id}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-zinc-200">
                    <Link to={`/inbox/${r.ticket_id}`} className="hover:text-[var(--accent)]">
                      {r.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill color={st.color}>{st.text}</Pill>
                      {openCount > 0 && (
                        <span className="rounded border border-amber-700/50 bg-amber-900/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                          ⚠ {openCount} to fill
                        </span>
                      )}
                      {r.edited && r.status === "sent" && (
                        <span className="text-[10px] text-zinc-500" title="edited before sending">
                          edited
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{r.buyer_persona ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                    {r.kb_confidence != null ? r.kb_confidence.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3">{r.route ? <RouteBadge route={r.route} /> : "—"}</td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--muted)]">
                  Nothing in {active.label.toLowerCase()}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

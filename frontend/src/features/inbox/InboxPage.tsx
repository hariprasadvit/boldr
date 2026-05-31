import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { EmptyState, Pill, RouteBadge, SectionHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import type { ReplyOut } from "@/api/types";

export function InboxPage() {
  const replies = useAsync(() => api.listReplies(), []);
  const tickets = useAsync(() => api.listTickets(), []);

  if (replies.loading || tickets.loading) {
    return <SectionHeader title="Inbox" subtitle="Loading…" />;
  }

  // Prefer enriched inbox reply rows (route/persona/confidence/flags). Fall back
  // to bare tickets so the table still renders before any pipeline run exists.
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

  return (
    <div>
      <SectionHeader
        title="Inbox"
        subtitle={
          `${rows.length} customer tickets, each with classification, KB confidence, ` +
          `route decision, and a drafted reply.`
        }
      />
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="bg-zinc-950/50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Ticket</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Persona</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">KB conf.</th>
              <th className="px-4 py-3 font-medium">Route</th>
              <th className="px-4 py-3 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => (
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
                <td className="px-4 py-3 text-zinc-400">{r.buyer_persona ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-400">{r.question_type ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                  {r.kb_confidence != null ? r.kb_confidence.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3">{r.route ? <RouteBadge route={r.route} /> : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(r.escalation_flags ?? []).filter(Boolean).map((f: string) => (
                      <Pill key={f} color="rose">
                        {f}
                      </Pill>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

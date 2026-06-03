import { Link, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { EmptyState, Pill, RouteBadge, SectionHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tickets = useAsync(() => api.listTickets(), []);
  const replies = useAsync(() => api.listReplies(), []);

  if (tickets.loading || replies.loading) {
    return <SectionHeader title="Ticket" subtitle="Loading…" />;
  }
  const ticket = (tickets.data ?? []).find((t) => t.ticket_id === id);
  if (!ticket) {
    return (
      <div>
        <SectionHeader title="Ticket" />
        <EmptyState title="Ticket not found." hint="Return to the inbox." />
      </div>
    );
  }
  const reply = (replies.data ?? []).find((r) => r.ticket_id === id);
  const flags = (reply?.escalation_flags ?? []).filter(Boolean);
  const citations = (reply?.citations ?? []).filter(Boolean);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link to="/inbox" className="inline-block text-xs text-[var(--muted)] hover:text-zinc-300">
          ← back to inbox
        </Link>
        <Link
          to={`/intelligence/${ticket.ticket_id}`}
          className="text-xs text-amber-300 hover:text-amber-200"
        >
          view full intelligence record →
        </Link>
      </div>
      <SectionHeader
        title={ticket.subject || "Customer ticket"}
        subtitle={`Ticket ${ticket.ticket_id} · ${ticket.channel} · ${ticket.date_received ?? ""}`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {reply?.route && <RouteBadge route={reply.route} />}
        {reply?.question_type && <Pill>type: {reply.question_type}</Pill>}
        {reply?.buyer_persona && <Pill color="amber">persona: {reply.buyer_persona}</Pill>}
        {reply?.kb_confidence != null && <Pill>KB confidence: {reply.kb_confidence.toFixed(2)}</Pill>}
        {reply?.kb_top_source && <Pill>top source: {reply.kb_top_source}</Pill>}
        {flags.map((f) => (
          <Pill key={f} color="rose">
            ⚠ {f}
          </Pill>
        ))}
      </div>

      {ticket.message_body && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Customer message</h3>
          <p className="whitespace-pre-wrap text-sm text-zinc-200">{ticket.message_body}</p>
        </div>
      )}

      {reply?.route_reason && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Route reason</h3>
          <p className="text-sm text-zinc-200">{reply.route_reason}</p>
        </div>
      )}

      {reply?.body && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-3 text-sm font-medium text-zinc-100">Drafted reply</h3>
          <pre className="whitespace-pre-wrap rounded bg-zinc-950/60 p-4 font-mono text-[12px] leading-relaxed text-zinc-200">
            {reply.body}
          </pre>
          {citations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1 text-[11px] text-[var(--muted)]">
              <span>citations:</span>
              {citations.map((c) => (
                <span key={c} className="font-mono text-zinc-400">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

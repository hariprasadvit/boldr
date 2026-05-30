import Link from "next/link";
import { notFound } from "next/navigation";
import { getTicket } from "@/lib/data";
import { Pill, RouteBadge, SectionHeader } from "../../components";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = getTicket(id);
  if (!ticket) notFound();

  return (
    <div>
      <Link href="/inbox" className="mb-4 inline-block text-xs text-[var(--muted)] hover:text-zinc-300">
        ← back to inbox
      </Link>
      <SectionHeader title={ticket.subject} subtitle={`Ticket ${ticket.ticket_id} · ${ticket.channel} · ${ticket.date_received}`} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <RouteBadge route={ticket.route} />
        <Pill>type: {ticket.question_type}</Pill>
        <Pill color="amber">persona: {ticket.buyer_persona}</Pill>
        <Pill>KB confidence: {ticket.kb_confidence.toFixed(2)}</Pill>
        <Pill>top source: {ticket.kb_top_source || "(none)"}</Pill>
        {(ticket.escalation_flags ? ticket.escalation_flags.split("|").filter(Boolean) : []).map((f) => (
          <Pill key={f} color="rose">
            ⚠ {f}
          </Pill>
        ))}
      </div>

      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Route reason</h3>
        <p className="text-sm text-zinc-200">{ticket.route_reason}</p>
      </div>

      {ticket.reply_draft && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-3 text-sm font-medium text-zinc-100">Drafted reply</h3>
          <pre className="whitespace-pre-wrap rounded bg-zinc-950/60 p-4 font-mono text-[12px] leading-relaxed text-zinc-200">
            {ticket.reply_draft}
          </pre>
          {ticket.reply_citations && (
            <div className="mt-3 flex flex-wrap gap-1 text-[11px] text-[var(--muted)]">
              <span>citations:</span>
              {ticket.reply_citations.split("|").filter(Boolean).map((c) => (
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

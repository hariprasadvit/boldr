import { getTickets } from "@/lib/data";
import { Pill, RouteBadge, SectionHeader, EmptyState } from "../components";
import Link from "next/link";

export default function InboxPage() {
  const tickets = getTickets();

  if (!tickets.length) {
    return (
      <div>
        <SectionHeader title="Inbox" />
        <EmptyState title="No tickets processed yet." hint="Run python batch_replay.py" />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Inbox"
        subtitle={`${tickets.length} customer tickets, each with classification, KB confidence, route decision, and a drafted reply.`}
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
            {tickets.map((t) => (
              <tr key={t.ticket_id} className="hover:bg-zinc-950/40">
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                  <Link href={`/inbox/${t.ticket_id}`} className="hover:text-[var(--accent)]">
                    {t.ticket_id}
                  </Link>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-zinc-200">
                  <Link href={`/inbox/${t.ticket_id}`} className="hover:text-[var(--accent)]">
                    {t.subject}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400">{t.buyer_persona}</td>
                <td className="px-4 py-3 text-zinc-400">{t.question_type}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">{t.kb_confidence.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <RouteBadge route={t.route} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(t.escalation_flags ? t.escalation_flags.split("|").filter(Boolean) : []).map((f) => (
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

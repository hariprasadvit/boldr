import { getGaps } from "@/lib/data";
import { EmptyState, Pill, SectionHeader } from "../components";

export default function GapsPage() {
  const gaps = getGaps();

  if (!gaps.length) {
    return (
      <div>
        <SectionHeader title="Knowledge gaps" />
        <EmptyState title="No knowledge gaps detected yet." hint="Run python batch_replay.py" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Knowledge gaps"
          subtitle={`${gaps.length} novel questions detected. Low-confidence KB searches are routed to a gaps sheet, then resolved into KB drafts.`}
        />
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/gaps/export"
            className="rounded-md border border-violet-800/60 bg-violet-900/30 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:border-violet-600 hover:bg-violet-900/50"
            download
          >
            Export gaps sheet
          </a>
          <a
            href="/api/gaps/kb-drafts/export"
            className="rounded-md border border-emerald-800/60 bg-emerald-900/25 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-600 hover:bg-emerald-900/40"
            download
          >
            Export KB drafts sheet
          </a>
        </div>
      </div>
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          <Pill color="violet">low KB confidence / no match</Pill>
          <Pill color="amber">theme + persona tagged</Pill>
          <Pill color="emerald">staff answer trigger</Pill>
          <Pill>KB drafts approval sheet</Pill>
        </div>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          This is the system loop: questions the KB cannot answer are logged with date, question, theme tag, persona
          tag, confidence, and an <span className="text-zinc-300">Answer provided by staff</span> column. In production,
          n8n watches that column; when staff fill it, Claude drafts a Boldr-format KB entry into the KB drafts sheet
          for approval and publishing.
        </p>
      </div>
      <div className="space-y-4">
        {gaps.map((g) => (
          <div key={g.ticket_id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-400">{g.ticket_id}</span>
                <Pill color="violet">{g.theme}</Pill>
                <Pill color="amber">{g.buyer_persona}</Pill>
                <Pill>KB conf: {g.kb_confidence.toFixed(2)}</Pill>
              </div>
              <span className="text-[11px] text-[var(--muted)]">{g.date_first_seen}</span>
            </div>
            <div className="mb-3 text-sm text-zinc-200">
              <span className="text-[var(--muted)]">Question:</span> {g.question_paraphrase}
            </div>
            {g.kb_entry_draft && (
              <details className="group rounded border border-violet-900/50 bg-violet-950/20 p-3">
                <summary className="cursor-pointer list-none text-xs font-medium text-violet-300">
                  Auto-drafted FAQ entry ▾
                </summary>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-zinc-200">
                  {g.kb_entry_draft}
                </pre>
                <div className="mt-3 flex justify-end">
                  <button
                    disabled
                    title="In production this writes the entry to the FAQ. Disabled in the demo."
                    className="cursor-not-allowed rounded border border-emerald-800/50 bg-emerald-900/30 px-3 py-1 text-xs text-emerald-300 opacity-70"
                  >
                    ✓ Approve &amp; publish
                  </button>
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { api, apiUrl } from "@/api/client";
import { EmptyState, Pill, SectionHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";

type PubState = { status: "idle" | "publishing" | "done" | "error"; chunkKey?: string | null; error?: string };

export function GapsPage() {
  const gaps = useAsync(() => api.listGaps("open"), []);
  const [pub, setPub] = useState<Record<string, PubState>>({});

  async function publish(gapId: string) {
    setPub((p) => ({ ...p, [gapId]: { status: "publishing" } }));
    try {
      const r = await api.publishGap(gapId);
      setPub((p) => ({ ...p, [gapId]: { status: "done", chunkKey: r.chunk_key } }));
    } catch (e) {
      setPub((p) => ({ ...p, [gapId]: { status: "error", error: (e as Error).message } }));
    }
  }

  if (gaps.loading) return <SectionHeader title="Knowledge gaps" subtitle="Loading…" />;
  const rows = gaps.data ?? [];

  if (!rows.length) {
    return (
      <div>
        <SectionHeader title="Knowledge gaps" />
        <EmptyState title="No knowledge gaps detected yet." hint="Run the pipeline first." />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Knowledge gaps"
          subtitle={
            `${rows.length} novel questions detected. Low-confidence KB searches are ` +
            `routed to a gaps sheet, then resolved into KB drafts.`
          }
        />
        <div className="flex flex-wrap gap-2">
          <a
            href={apiUrl("/exports/gaps.xlsx")}
            className="rounded-md border border-violet-800/60 bg-violet-900/30 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:border-violet-600 hover:bg-violet-900/50"
            download
          >
            Export gaps sheet
          </a>
          <a
            href={apiUrl("/exports/kb-drafts.xlsx")}
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
          This is the self-improving loop: questions the KB can&apos;t answer are logged with theme, persona,
          and confidence, and the system auto-drafts a FAQ entry. Click{" "}
          <span className="text-emerald-300">Approve &amp; publish</span> and that answer is embedded into the
          live knowledge base — so the next customer asking the same thing gets answered automatically, with a
          citation back to this entry.
        </p>
      </div>
      <div className="space-y-4">
        {rows.map((g) => (
          <div key={g.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-400">{g.ticket_id}</span>
                {g.theme && <Pill color="violet">{g.theme}</Pill>}
                {g.buyer_persona && <Pill color="amber">{g.buyer_persona}</Pill>}
                {g.kb_confidence != null && <Pill>KB conf: {g.kb_confidence.toFixed(2)}</Pill>}
              </div>
              {g.date_first_seen && (
                <span className="text-[11px] text-[var(--muted)]">{g.date_first_seen}</span>
              )}
            </div>
            <div className="mb-3 text-sm text-zinc-200">
              <span className="text-[var(--muted)]">Question:</span> {g.paraphrase}
            </div>
            {g.kb_entry_draft && (
              <details className="group rounded border border-violet-900/50 bg-violet-950/20 p-3">
                <summary className="cursor-pointer list-none text-xs font-medium text-violet-300">
                  Auto-drafted FAQ entry ▾
                </summary>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-zinc-200">
                  {g.kb_entry_draft}
                </pre>
                <div className="mt-3 flex items-center justify-end gap-3">
                  {pub[g.id]?.status === "done" ? (
                    <span className="text-[11px] text-emerald-300">
                      ✓ Published to KB — future tickets answer from{" "}
                      <span className="font-mono text-emerald-200">{pub[g.id]?.chunkKey}</span>
                    </span>
                  ) : pub[g.id]?.status === "error" ? (
                    <span className="text-[11px] text-rose-300">Publish failed: {pub[g.id]?.error}</span>
                  ) : (
                    <button
                      onClick={() => publish(g.id)}
                      disabled={pub[g.id]?.status === "publishing"}
                      title="Embeds this answer into the live KB so future tickets retrieve it."
                      className="rounded border border-emerald-800/50 bg-emerald-900/30 px-3 py-1 text-xs text-emerald-300 transition-colors hover:border-emerald-600 hover:bg-emerald-900/50 disabled:opacity-50"
                    >
                      {pub[g.id]?.status === "publishing" ? "Publishing…" : "✓ Approve & publish"}
                    </button>
                  )}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

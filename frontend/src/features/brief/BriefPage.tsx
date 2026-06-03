import { api, apiUrl } from "@/api/client";
import { Markdown } from "@/components/Markdown";
import { DerivedFrom, EmptyState, Pill, SectionHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";

export function BriefPage() {
  const state = useAsync(() => api.marketingBrief(), []);
  const themesState = useAsync(() => api.themes(), []);
  const evidenceThemes = (themesState.data?.clusters ?? [])
    .filter((t) => t.size >= 2)
    .sort((a, b) => b.size - a.size)
    .slice(0, 8);

  if (state.loading) return <SectionHeader title="Marketing brief" subtitle="Loading…" />;
  const md = state.data?.markdown ?? "";
  if (!md) {
    return (
      <div>
        <SectionHeader title="Marketing brief" />
        <EmptyState title="No brief generated yet." hint="Run the marketing_brief job." />
      </div>
    );
  }
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Marketing brief"
          subtitle="Monthly customer intelligence — what customers ask that isn’t on your product pages."
        />
        <a
          href={apiUrl("/exports/marketing-brief.xlsx")}
          className="rounded-md border border-emerald-800/60 bg-emerald-900/30 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-600 hover:bg-emerald-900/50"
          download
        >
          Export review workbook
        </a>
      </div>
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Pill color="emerald">editable Excel export</Pill>
          <Pill>segmentation QA</Pill>
          <Pill color="amber">campaign matrix</Pill>
        </div>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          The workbook includes a human review queue for persona corrections, campaign copy, theme actions,
          knowledge-gap drafts, and the five-persona reference taxonomy.
        </p>
      </div>
      {evidenceThemes.length > 0 && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-1 text-sm font-medium text-zinc-100">Evidence ledger</h3>
          <p className="mb-4 text-xs text-[var(--muted)]">
            Every recommendation below traces to real tickets — nothing here is hand-authored.
          </p>
          <div className="space-y-3">
            {evidenceThemes.map((t) => (
              <div key={t.cluster_id} className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-sm text-zinc-200">{t.theme_label}</span>
                  <Pill color="amber">{t.size} tickets</Pill>
                </div>
                <DerivedFrom ticketIds={t.ticket_ids} max={12} />
              </div>
            ))}
          </div>
        </div>
      )}
      <Markdown md={md} />
    </div>
  );
}

import { api } from "@/api/client";
import { Markdown } from "@/components/Markdown";
import { DerivedFrom, EmptyState, Pill, SectionHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";

export function BenchPage() {
  const state = useAsync(() => api.externalBench(), []);

  if (state.loading) return <SectionHeader title="External sentiment benchmark" subtitle="Loading…" />;
  const md = state.data?.markdown ?? "";
  const data = state.data?.data ?? [];
  if (!md) {
    return (
      <div>
        <SectionHeader title="External sentiment benchmark" />
        <EmptyState title="No external benchmark yet." hint="Run the external_bench job." />
      </div>
    );
  }
  return (
    <div>
      <SectionHeader
        title="External sentiment benchmark"
        subtitle="Internal customer signals vs forum/review sentiment — Boldr-specific gap, or market-wide signal?"
      />
      {data.length > 0 && (
        <div className="mb-8 space-y-3">
          {data.map((row) => {
            const internal = row.internal_ticket_count;
            const external = row.external_mention_count;
            const verdict =
              external > internal * 3
                ? { label: "Market-wide concern", color: "rose" as const }
                : external > internal
                  ? { label: "Validated externally", color: "amber" as const }
                  : { label: "Boldr-specific signal", color: "emerald" as const };
            return (
              <div key={row.theme} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-zinc-100">{row.theme}</h3>
                  <Pill color={verdict.color}>{verdict.label}</Pill>
                </div>
                <div className="mb-3 grid gap-4 sm:grid-cols-2">
                  <div className="rounded border border-[var(--border)] bg-zinc-950/40 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Internal demand</div>
                    <div className="mt-1 text-xl font-semibold text-zinc-100">{internal} tickets</div>
                    <div className="mt-2">
                      <DerivedFrom ticketIds={row.internal_sample_ids ?? []} label="Sampled" max={8} />
                    </div>
                  </div>
                  <div className="rounded border border-[var(--border)] bg-zinc-950/40 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">External signal</div>
                    <div className="mt-1 text-xl font-semibold text-zinc-100">
                      {external} mentions
                      <span className="ml-2 text-xs font-normal text-[var(--muted)]">{row.external_signal_strength}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                      {Object.entries(row.external_sentiment ?? {}).map(([k, v]) => (
                        <Pill key={k}>{k} · {v}</Pill>
                      ))}
                    </div>
                  </div>
                </div>
                {(row.external_sample_quotes ?? []).length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-[11px] text-[var(--muted)] hover:text-zinc-300">
                      {row.external_sample_quotes.length} external quotes ▾
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                      {row.external_sample_quotes.map((q, i) => (
                        <li key={i}>“{q}”</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Markdown md={md} />
      {data.length > 0 && (
        <details className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <summary className="cursor-pointer text-sm text-zinc-300">Raw benchmark data ▾</summary>
          <pre className="mt-3 overflow-x-auto rounded bg-zinc-950/60 p-3 font-mono text-[11px] text-zinc-300">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

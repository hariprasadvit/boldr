import { api } from "@/api/client";
import { Markdown } from "@/components/Markdown";
import { EmptyState, SectionHeader } from "@/components/ui";
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

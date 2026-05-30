import { marked } from "marked";
import { getBenchMd, getBenchData } from "@/lib/data";
import { EmptyState, SectionHeader } from "../components";

export default function BenchPage() {
  const md = getBenchMd();
  const data = getBenchData();
  if (!md) {
    return (
      <div>
        <SectionHeader title="External sentiment benchmark" />
        <EmptyState title="No external benchmark yet." hint="Run python -m intelligence.external_bench" />
      </div>
    );
  }
  const html = marked.parse(md, { gfm: true, breaks: false }) as string;
  return (
    <div>
      <SectionHeader
        title="External sentiment benchmark"
        subtitle="Internal customer signals vs forum/review sentiment — Boldr-specific gap, or market-wide signal?"
      />
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
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

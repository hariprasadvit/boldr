import { marked } from "marked";
import { getBriefMd } from "@/lib/data";
import { EmptyState, Pill, SectionHeader } from "../components";

export default function BriefPage() {
  const md = getBriefMd();
  if (!md) {
    return (
      <div>
        <SectionHeader title="Marketing brief" />
        <EmptyState title="No brief generated yet." hint="Run python -m intelligence.marketing_brief" />
      </div>
    );
  }
  const html = marked.parse(md, { gfm: true, breaks: false }) as string;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Marketing brief"
          subtitle="Monthly customer intelligence — what customers ask that isn’t on your product pages."
        />
        <a
          href="/api/marketing-brief/export"
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
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

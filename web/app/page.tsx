import Link from "next/link";
import { getSummary, getTickets, getGaps, getThemes } from "@/lib/data";
import { Card, Pill, SectionHeader, Stat } from "./components";

function SelfImprovingPanel({
  gaps,
  themes,
  ticketsProcessed,
}: {
  gaps: ReturnType<typeof getGaps>;
  themes: ReturnType<typeof getThemes>;
  ticketsProcessed: number;
}) {
  const latestGaps = [...gaps]
    .sort((a, b) => b.date_first_seen.localeCompare(a.date_first_seen))
    .slice(0, 3);
  const activeThemes = themes.filter((theme) => theme.size > 1).length;

  return (
    <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Self-improving feedback loop</h2>
          <p className="mt-1 max-w-3xl text-xs text-[var(--muted)]">
            Highlight this in the demo: every new query either reuses the KB or creates a reviewed learning artifact
            that can be published back into the KB and rolled up into campaign intelligence.
          </p>
        </div>
        <Pill color="emerald">{gaps.length} FAQ drafts queued</Pill>
      </div>

      <div className="grid gap-3 text-xs md:grid-cols-5">
        {[
          ["1", "Query arrives", `${ticketsProcessed} processed`],
          ["2", "KB scored", "confidence + citations"],
          ["3", "Novelty detected", "low-confidence questions"],
          ["4", "FAQ drafted", "approval queue"],
          ["5", "KB + campaigns refresh", `${activeThemes} active themes`],
        ].map(([step, title, detail]) => (
          <div key={title} className="rounded border border-[var(--border)] bg-zinc-950/50 p-3">
            <div className="mb-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-zinc-950">
              {step}
            </div>
            <div className="font-medium text-zinc-200">{title}</div>
            <div className="mt-1 text-[11px] text-[var(--muted)]">{detail}</div>
          </div>
        ))}
      </div>

      {latestGaps.length > 0 && (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--muted)]">Latest backend learning artifacts</div>
          <div className="grid gap-2 md:grid-cols-3">
            {latestGaps.map((gap) => (
              <Link
                key={gap.ticket_id}
                href="/gaps"
                className="rounded border border-violet-900/40 bg-violet-950/20 p-3 transition-colors hover:border-violet-700/70"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-zinc-400">{gap.ticket_id}</span>
                  <Pill color="violet">{gap.theme}</Pill>
                </div>
                <div className="line-clamp-2 text-xs text-zinc-300">{gap.question_paraphrase}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const summary = getSummary();
  const tickets = getTickets();
  const gaps = getGaps();
  const themes = getThemes();

  const hasData = !!summary && tickets.length > 0;

  return (
    <div>
      <SectionHeader
        title="Customer intelligence at the inbox"
        subtitle="Every inbound ticket becomes a drafted reply, a knowledge-base diff, and a marketing signal — automatically."
      />

      {!hasData ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-12 text-center">
          <div className="text-sm text-zinc-300">No pipeline outputs found yet.</div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            From the repo root: <code className="font-mono">python batch_replay.py</code> then{" "}
            <code className="font-mono">python scripts/export_outputs.py</code>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Tickets processed" value={summary!.tickets_processed} />
            <Stat
              label="Auto-replied"
              value={summary!.by_route?.auto_reply ?? 0}
              hint={`${Math.round(((summary!.by_route?.auto_reply ?? 0) / summary!.tickets_processed) * 100)}% of inbox`}
            />
            <Stat label="Human review" value={summary!.by_route?.human_review ?? 0} />
            <Stat
              label="Knowledge gaps"
              value={summary!.knowledge_gaps_detected}
              hint={`${themes.filter((t) => t.size > 1).length} clusters identified`}
            />
          </div>

          <SelfImprovingPanel gaps={gaps} themes={themes} ticketsProcessed={summary!.tickets_processed} />

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card title="Live pipeline" subtitle="Paste a new ticket, watch the agent run" href="/live" accent>
              <div className="mt-1 text-xs text-zinc-400">
                classify → search → route → draft / gap. ~6–10s per ticket.
              </div>
            </Card>
            <Card title="Inbox" subtitle={`${tickets.length} processed tickets`} href="/inbox">
              <div className="mt-1 text-xs text-zinc-400">
                Every reply with citations, route reason, and escalation flags.
              </div>
            </Card>
            <Card title="Marketing brief" subtitle="Monthly intelligence" href="/brief">
              <div className="mt-1 text-xs text-zinc-400">
                What customers ask that isn&apos;t on your product pages.
              </div>
            </Card>
            <Card title="Persona campaigns" subtitle="Newsletter + IG + TikTok variants" href="/campaigns">
              <div className="mt-1 text-xs text-zinc-400">
                Buyer persona segments become reusable campaign assets at scale.
              </div>
            </Card>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title="Knowledge gaps" subtitle={`${gaps.length} novel questions detected`} href="/gaps">
              <div className="mt-1 text-xs text-zinc-400">Each with an auto-drafted FAQ entry ready for 1-click approval.</div>
            </Card>
            <Card title="Theme clusters" subtitle={`${themes.filter((t) => t.size > 1).length} themes`} href="/themes">
              <div className="mt-1 text-xs text-zinc-400">What customers are clustering around this period.</div>
            </Card>
            <Card title="External benchmark" subtitle="Internal vs. forum & review sentiment" href="/bench">
              <div className="mt-1 text-xs text-zinc-400">Boldr-specific gap, or market-wide signal? With actions.</div>
            </Card>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="mb-3 text-sm font-medium text-zinc-100">Pipeline mix</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-[var(--muted)]">By question type:</span>
              {Object.entries(summary!.by_question_type ?? {}).map(([k, v]) => (
                <Pill key={k}>
                  {k} <span className="text-zinc-500">·{v}</span>
                </Pill>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-[var(--muted)]">By buyer persona:</span>
              {Object.entries(summary!.by_persona ?? {}).map(([k, v]) => (
                <Pill key={k} color="amber">
                  {k} <span className="text-zinc-500">·{v}</span>
                </Pill>
              ))}
            </div>
          </div>

          <p className="mt-8 text-xs text-[var(--muted)]">
            Built for Echelon 2026 AI Workflow Competition. Source data &amp; KB live in{" "}
            <Link href="https://github.com" className="underline">
              the repo
            </Link>
            . Pipeline runs via OpenRouter → Claude Sonnet 4.6.
          </p>
        </>
      )}
    </div>
  );
}

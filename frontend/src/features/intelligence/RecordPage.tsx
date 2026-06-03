import { Link, useParams } from "react-router-dom";
import { api } from "@/api/client";
import {
  ConfidenceBar,
  DerivedFrom,
  Pill,
  RouteBadge,
  RoutingLegend,
  matchFiredRule,
  usd,
} from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import type { ReactNode } from "react";

/**
 * The Intelligence Record — the canonical, top-to-bottom view of one ticket.
 * Every derived screen links here. It joins the ticket with the run, reply/gap,
 * confidence breakdown, and the themes it belongs to, so the whole "one question
 * → all outputs" lineage lives on a single page. Pure read of /intelligence/record.
 */

const STAGE_COLOR: Record<string, string> = {
  Answer: "text-emerald-300",
  Learn: "text-violet-300",
  Discover: "text-sky-300",
};

function Stage({ n, stage, title, children }: { n: number; stage: string; title: string; children: ReactNode }) {
  return (
    <div className="relative border-l border-[var(--border)] pb-6 pl-6 last:pb-0">
      <div className="absolute -left-[9px] top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[var(--border)] bg-zinc-900 text-[10px] font-semibold text-zinc-400">
        {n}
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider ${STAGE_COLOR[stage] ?? "text-zinc-400"}`}>
          {stage}
        </span>
        <span className="text-sm font-medium text-zinc-100">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function RecordPage() {
  const { ticketId = "" } = useParams();
  const { data, loading, error } = useAsync(() => api.record(ticketId), [ticketId]);

  if (loading) return <div className="text-sm text-[var(--muted)]">Loading record…</div>;
  if (error || !data)
    return (
      <div>
        <Link to="/inbox" className="mb-4 inline-block text-xs text-[var(--muted)] hover:text-zinc-300">
          ← back to inbox
        </Link>
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-12 text-center text-sm text-zinc-300">
          {error ?? `No record for ${ticketId}`}
        </div>
      </div>
    );

  const { ticket, run, reply, gap, confidence_breakdown, themes, cost_estimate_usd } = data;
  const flags = run?.escalation_flags ?? [];
  const citations = reply?.citations ?? [];
  const firedRule = run ? matchFiredRule(run.route_reason ?? "", run.route ?? "") : null;
  let n = 0;

  return (
    <div>
      <Link to="/inbox" className="mb-4 inline-block text-xs text-[var(--muted)] hover:text-zinc-300">
        ← back to inbox
      </Link>

      <div className="mb-6">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--muted)]">Intelligence record</div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {ticket.ticket_id} · {ticket.channel} · {ticket.date_received ?? "—"} · est. model cost {usd(cost_estimate_usd)}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <Stage n={(n += 1)} stage="Answer" title="Customer question">
          <p className="rounded bg-zinc-950/60 p-3 text-sm text-zinc-200">{ticket.message_body}</p>
        </Stage>

        <Stage n={(n += 1)} stage="Answer" title="Intent & buyer signal">
          <div className="flex flex-wrap items-center gap-2">
            {run?.question_type && <Pill>intent: {run.question_type}</Pill>}
            {run?.buyer_persona && <Pill color="amber">buyer signal: {run.buyer_persona}</Pill>}
            {flags.map((f) => (
              <Pill key={f} color="rose">⚠ {f}</Pill>
            ))}
          </div>
        </Stage>

        {confidence_breakdown && (
          <Stage n={(n += 1)} stage="Answer" title="Confidence — why the system is (un)sure">
            <div className="max-w-md rounded-lg border border-[var(--border)] bg-zinc-950/40 p-4">
              <ConfidenceBar components={confidence_breakdown.components} composite={confidence_breakdown.composite} />
            </div>
          </Stage>
        )}

        {run && (
          <Stage n={(n += 1)} stage="Answer" title="Routing decision">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {run.route && <RouteBadge route={run.route} />}
              <span className="text-xs text-zinc-300">{run.route_reason}</span>
            </div>
            <RoutingLegend firedId={firedRule} />
          </Stage>
        )}

        {reply?.body && (
          <Stage n={(n += 1)} stage="Answer" title="Drafted reply">
            <pre className="whitespace-pre-wrap rounded bg-zinc-950/60 p-4 font-mono text-[12px] leading-relaxed text-zinc-200">
              {reply.body}
            </pre>
            {citations.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted)]">
                <span>sources:</span>
                {citations.map((c) => (
                  <span key={c} className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-zinc-300">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </Stage>
        )}

        {gap && (
          <Stage n={(n += 1)} stage="Learn" title="Knowledge contribution">
            <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-4">
              <div className="mb-2 flex items-center gap-2">
                {gap.theme && <Pill color="violet">{gap.theme}</Pill>}
                <span className="text-[11px] text-[var(--muted)]">status: {gap.status}</span>
              </div>
              <div className="mb-2 text-xs text-zinc-300">{gap.paraphrase}</div>
              {gap.kb_entry_draft && (
                <pre className="whitespace-pre-wrap rounded bg-zinc-950/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                  {gap.kb_entry_draft}
                </pre>
              )}
              <Link to="/gaps" className="mt-2 inline-block text-[11px] text-violet-300 hover:text-violet-200">
                → view in knowledge gaps
              </Link>
            </div>
          </Stage>
        )}

        <Stage n={(n += 1)} stage="Discover" title="Theme membership & marketing signal">
          {themes.length > 0 ? (
            <div className="space-y-3">
              {themes.map((theme) => (
                <div key={theme.cluster_id} className="rounded-lg border border-[var(--border)] bg-zinc-950/40 p-4">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <Link to="/themes" className="text-sm font-medium text-zinc-100 hover:text-amber-300">
                      {theme.theme_label}
                    </Link>
                    <Pill>{theme.size} tickets</Pill>
                  </div>
                  {theme.marketing_signal && (
                    <p className="mb-2 text-xs text-zinc-300">
                      <span className="text-amber-300/80">Act → </span>
                      {theme.marketing_signal}
                    </p>
                  )}
                  <DerivedFrom ticketIds={theme.ticket_ids} label="Cluster" max={10} />
                  <div className="mt-2 flex gap-3 text-[11px]">
                    <Link to="/brief" className="text-amber-300 hover:text-amber-200">→ marketing brief</Link>
                    <Link to="/campaigns" className="text-amber-300 hover:text-amber-200">→ campaigns</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Not yet part of a multi-ticket cluster — a single data point until similar questions arrive.
            </p>
          )}
        </Stage>
      </div>

      <p className="mt-4 text-[11px] text-[var(--muted)]">
        One ticket → response, knowledge asset, and marketing signal. Every screen in Boldr is a roll-up of records like this.
      </p>
    </div>
  );
}

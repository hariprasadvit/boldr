import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { Card, ImpactStat, Pill, SectionHeader, usd } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import type { GapOut } from "@/api/types";

export function HomePage() {
  const summaryState = useAsync(() => api.summary(), []);
  const gaps = useAsync(() => api.listGaps("open"), []);
  const themesState = useAsync(() => api.themes(), []);
  const impactState = useAsync(() => api.impact(), []);

  const summary = summaryState.data;
  const impact = impactState.data;
  const gapList = gaps.data ?? [];
  const themes = (themesState.data?.clusters ?? []).filter((t) => t.size > 1);
  const loading = summaryState.loading || gaps.loading || themesState.loading;

  const ticketCount = summary?.tickets_processed ?? 0;

  const questionTypeMix = summary?.by_question_type ?? {};
  const personaMix = summary?.by_persona ?? {};

  const hasData = !loading && ticketCount > 0;

  return (
    <div>
      <SectionHeader
        title="Customer intelligence at the inbox"
        subtitle="Every inbound ticket becomes a drafted reply, a knowledge-base diff, and a marketing signal — automatically."
      />

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Loading…</div>
      ) : !hasData ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-12 text-center">
          <div className="text-sm text-zinc-300">No pipeline outputs found yet.</div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            From the repo root: <code className="font-mono">python batch_replay.py</code> then{" "}
            <code className="font-mono">python scripts/export_outputs.py</code>
          </div>
        </div>
      ) : (
        <>
          {/* Impact dashboard — business outcomes first (what changes next month). */}
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ImpactStat
              label="Hours saved"
              value={`${(impact?.hours_saved ?? 0).toFixed(0)} hrs`}
              hint={`${impact?.draft_assisted ?? 0} tickets draft-assisted`}
              basis="assumption"
              accent
              formula={`${impact?.draft_assisted ?? 0} draft-assisted × ${(impact?.assumptions.minutes_per_reply_from_scratch ?? 8) - (impact?.assumptions.minutes_to_review_draft ?? 2)} min saved (${impact?.assumptions.minutes_per_reply_from_scratch ?? 8}min scratch − ${impact?.assumptions.minutes_to_review_draft ?? 2}min review) ÷ 60`}
            />
            <ImpactStat
              label="Knowledge created"
              value={impact?.new_knowledge_created ?? 0}
              hint="FAQ entries drafted from gaps"
              basis="real"
              formula="Knowledge gaps with an auto-drafted FAQ entry queued for approval"
            />
            <ImpactStat
              label="Product gaps found"
              value={impact?.product_page_gaps ?? 0}
              hint="themes pointing at product pages"
              basis="real"
              formula="Multi-ticket themes whose suggested action references a product page / badge / spec"
            />
            <ImpactStat
              label="Marketing opportunities"
              value={impact?.marketing_opportunities ?? 0}
              hint="themes with a marketing signal"
              basis="real"
              formula="Multi-ticket themes carrying a non-empty marketing signal"
            />
          </div>

          {/* Cost / ROI + automation mix — the cost-efficiency story. */}
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ImpactStat
              label="Model cost"
              value={usd(impact?.model_cost_usd ?? 0)}
              hint={`${usd(impact?.avg_cost_per_ticket_usd ?? 0)} / ticket`}
              basis="derived"
              formula={`Σ tokens × price (in $${impact?.assumptions.price_per_m_input_usd ?? 3}/M, out $${impact?.assumptions.price_per_m_output_usd ?? 15}/M). Batch estimated; live runs report exact usage.`}
            />
            <ImpactStat
              label="Human cost saved"
              value={usd(impact?.human_cost_saved_usd ?? 0)}
              hint={`@ $${impact?.assumptions.loaded_hourly_rate_usd ?? 18}/hr loaded`}
              basis="assumption"
              formula={`${(impact?.hours_saved ?? 0).toFixed(1)} hrs × $${impact?.assumptions.loaded_hourly_rate_usd ?? 18}/hr loaded agent cost`}
            />
            <ImpactStat
              label="ROI"
              value={`${(impact?.roi_multiple ?? 0).toFixed(0)}×`}
              hint="human cost saved ÷ model cost"
              basis="derived"
              accent
              formula="Human cost saved ÷ model cost — every $1 of model spend offsets this much agent time"
            />
            <ImpactStat
              label="Human-reviewed"
              value="100%"
              hint={`${impact?.draft_assisted ?? 0} AI-drafted · ${ticketCount} processed`}
              basis="real"
              formula="Every reply is AI-drafted and approved by a human before sending — no auto-send. Confidence sets review effort, not whether a human is involved."
            />
          </div>

          <SelfImprovingPanel
            gaps={gapList}
            gapCount={gapList.length}
            themeCount={themes.length}
            ticketCount={ticketCount}
          />

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card title="Live pipeline" subtitle="Paste a new ticket, watch the agent run" to="/live" accent>
              <div className="mt-1 text-xs text-zinc-400">
                classify → search → route → draft / gap. ~6–10s per ticket.
              </div>
            </Card>
            <Card title="Inbox" subtitle={`${ticketCount} processed tickets`} to="/inbox">
              <div className="mt-1 text-xs text-zinc-400">
                Every reply with citations, route reason, and escalation flags.
              </div>
            </Card>
            <Card title="Marketing brief" subtitle="Monthly intelligence" to="/brief">
              <div className="mt-1 text-xs text-zinc-400">
                What customers ask that isn’t on your product pages.
              </div>
            </Card>
            <Card title="Persona campaigns" subtitle="Newsletter + IG + TikTok variants" to="/campaigns">
              <div className="mt-1 text-xs text-zinc-400">
                Buyer persona segments become reusable campaign assets at scale.
              </div>
            </Card>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title="Knowledge gaps" subtitle={`${gapList.length} novel questions detected`} to="/gaps">
              <div className="mt-1 text-xs text-zinc-400">
                Each with an auto-drafted FAQ entry ready for 1-click approval.
              </div>
            </Card>
            <Card title="Theme clusters" subtitle={`${themes.length} themes`} to="/themes">
              <div className="mt-1 text-xs text-zinc-400">
                What customers are clustering around this period.
              </div>
            </Card>
            <Card title="External benchmark" subtitle="Internal vs. forum & review sentiment" to="/bench">
              <div className="mt-1 text-xs text-zinc-400">
                Boldr-specific gap, or market-wide signal? With actions.
              </div>
            </Card>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="mb-3 text-sm font-medium text-zinc-100">Pipeline mix</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-[var(--muted)]">By question type:</span>
              {Object.entries(questionTypeMix).map(([k, v]) => (
                <Pill key={k}>
                  {k} <span className="text-zinc-500">·{v}</span>
                </Pill>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-[var(--muted)]">By buyer persona:</span>
              {Object.entries(personaMix).map(([k, v]) => (
                <Pill key={k} color="amber">
                  {k} <span className="text-zinc-500">·{v}</span>
                </Pill>
              ))}
            </div>
          </div>

          <p className="mt-8 text-xs text-[var(--muted)]">
            Built for Echelon 2026 AI Workflow Competition. Source data &amp; KB live in{" "}
            <a href="https://github.com" className="underline">
              the repo
            </a>
            . Pipeline runs via OpenRouter → Claude Sonnet 4.6.
          </p>
        </>
      )}
    </div>
  );
}

function SelfImprovingPanel({
  gaps,
  gapCount,
  themeCount,
  ticketCount,
}: {
  gaps: GapOut[];
  gapCount: number;
  themeCount: number;
  ticketCount: number;
}) {
  const latestGaps = gaps.slice(0, 3);
  const steps: [string, string, string][] = [
    ["1", "Query arrives", `${ticketCount} processed`],
    ["2", "KB scored", "confidence + citations"],
    ["3", "Novelty detected", "low-confidence questions"],
    ["4", "FAQ drafted", "approval queue"],
    ["5", "KB + campaigns refresh", `${themeCount} active themes`],
  ];
  return (
    <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Self-improving feedback loop</h2>
          <p className="mt-1 max-w-3xl text-xs text-[var(--muted)]">
            Highlight this in the demo: every new query either reuses the KB or creates a reviewed learning
            artifact that can be published back into the KB and rolled up into campaign intelligence.
          </p>
        </div>
        <Pill color="emerald">{gapCount} FAQ drafts queued</Pill>
      </div>
      <div className="grid gap-3 text-xs md:grid-cols-5">
        {steps.map(([step, title, detail]) => (
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
          <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Latest backend learning artifacts
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {latestGaps.map((gap) => (
              <Link
                key={gap.id}
                to="/gaps"
                className="rounded border border-violet-900/40 bg-violet-950/20 p-3 transition-colors hover:border-violet-700/70"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-zinc-400">{gap.ticket_id}</span>
                  {gap.theme && <Pill color="violet">{gap.theme}</Pill>}
                </div>
                <div className="line-clamp-2 text-xs text-zinc-300">{gap.paraphrase}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import type { ReactNode } from "react";
import { ConfidenceBar, Pill, RouteBadge, RoutingLegend, matchFiredRule, usd } from "@/components/ui";
import type { PipelineResult } from "@/api/types";

export type Stage = "classify" | "search" | "route" | "draft" | "learn";
export const STAGE_LABELS: Record<Stage, string> = {
  classify: "Classifying",
  search: "Searching knowledge base",
  route: "Deciding route",
  draft: "Drafting reply",
  learn: "Updating learning loop",
};

type Turn = { id: string; state?: PipelineResult };

const STAGES: { key: Stage; label: string }[] = [
  { key: "classify", label: "Classify" },
  { key: "search", label: "KB search" },
  { key: "route", label: "Route" },
  { key: "draft", label: "Draft" },
  { key: "learn", label: "Learn" },
];

export function ReasoningPanel({
  turn,
  pendingStage,
  isActive,
}: {
  turn?: Turn;
  pendingStage: Stage | null;
  isActive: boolean;
}) {
  const state = turn?.state;
  const isLoading = isActive && pendingStage !== null;
  const stageIdx = pendingStage ? STAGES.findIndex((s) => s.key === pendingStage) : STAGES.length;

  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm font-medium text-zinc-100">Reasoning</div>
        <div className="text-xs text-[var(--muted)]">
          {turn ? `Pipeline trace for ${turn.id}` : "Send a message to see the trace"}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {!turn && (
          <div className="text-xs text-[var(--muted)]">
            Each turn runs classify → KB search → route → draft (or flag-gap + auto-draft KB). The trace
            updates here as it executes.
          </div>
        )}

        {turn && (
          <>
            <div className="space-y-1.5">
              {STAGES.map((s, i) => {
                const done = state && (i < stageIdx || !isLoading);
                const active = isLoading && i === stageIdx;
                return (
                  <div key={s.key} className="flex items-center gap-2 text-xs">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                        done
                          ? "bg-emerald-500 text-zinc-950"
                          : active
                            ? "bg-amber-500 text-zinc-950"
                            : "border border-[var(--border)] text-[var(--muted)]"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span
                      className={active ? "text-amber-300" : done ? "text-zinc-300" : "text-[var(--muted)]"}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {state?.question_type && (
              <Section title="Classification">
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <Pill>type: {state.question_type}</Pill>
                  <Pill color="amber">persona: {state.buyer_persona}</Pill>
                  <Pill>conf {(state.classification_confidence ?? 0).toFixed(2)}</Pill>
                  {(state.escalation_flags ?? []).map((f) => (
                    <Pill key={f} color="rose">
                      ⚠ {f}
                    </Pill>
                  ))}
                </div>
              </Section>
            )}

            {state?.kb_hits && state.kb_hits.length > 0 && (
              <Section title={`KB hits · top score ${(state.kb_confidence ?? 0).toFixed(2)}`}>
                <div className="space-y-1.5">
                  {state.kb_hits.slice(0, 3).map((h) => (
                    <details key={h.id} className="rounded border border-[var(--border)] bg-zinc-950/60 p-2">
                      <summary className="flex cursor-pointer items-center justify-between gap-1 text-[11px]">
                        <span className="truncate font-mono text-zinc-300">{h.id}</span>
                        <span className="shrink-0 text-[var(--muted)]">
                          {h.similarity.toFixed(2)} / {h.adjusted_score.toFixed(2)}
                        </span>
                      </summary>
                      <pre className="mt-1.5 whitespace-pre-wrap text-[10px] leading-relaxed text-zinc-400">
                        {h.text.slice(0, 400)}
                      </pre>
                    </details>
                  ))}
                </div>
              </Section>
            )}

            {state?.confidence_breakdown && (
              <Section title="Confidence breakdown">
                <ConfidenceBar
                  components={state.confidence_breakdown.components}
                  composite={state.confidence_breakdown.composite}
                />
              </Section>
            )}

            {state?.route && (
              <Section title="Route decision">
                <div className="mb-2 flex items-center gap-2">
                  <RouteBadge route={state.route} />
                  <span className="text-[11px] text-zinc-400">{state.route_reason}</span>
                </div>
                <RoutingLegend firedId={matchFiredRule(state.route_reason ?? "", state.route)} />
              </Section>
            )}

            {(state?.reply_citations ?? []).length > 0 && (
              <Section title="Citations">
                <div className="space-y-0.5">
                  {(state?.reply_citations ?? []).map((c) => (
                    <div key={c} className="font-mono text-[10px] text-zinc-400">
                      · {c}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {state?.gap_theme && (
              <Section title="Gap theme">
                <Pill color="violet">{state.gap_theme}</Pill>
                {state.gap_paraphrase && (
                  <div className="mt-2 text-[11px] text-zinc-400">{state.gap_paraphrase}</div>
                )}
              </Section>
            )}

            {state?.route && (
              <Section title="What this ticket did for the system">
                {state.route === "knowledge_gap" ? (
                  <div className="space-y-2 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Pill color="violet">logged as a gap</Pill>
                      <span>
                        No good KB answer — saved as a knowledge gap{state.gap_theme ? ` (${state.gap_theme})` : ""}.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill color="emerald">FAQ auto-drafted</Pill>
                      <span>The system wrote a draft answer — approve it in Gaps to publish it into the KB.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill color="amber">then reused</Pill>
                      <span>Once published, the next customer asking this is answered automatically.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Pill color="emerald">saved for review</Pill>
                      <span>This drafted reply is queued for a human to approve before it&apos;s sent.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill color="amber">feeds your dashboards</Pill>
                      <span>
                        Tagged {state.buyer_persona ?? "a persona"} — this ticket now counts toward Themes and
                        Campaigns.
                      </span>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {state?.cost && state.cost.input_tokens > 0 && (
              <Section title="Cost (measured)">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                  <span className="font-mono text-sm font-semibold text-emerald-300">{usd(state.cost.usd)}</span>
                  <span>{state.cost.input_tokens.toLocaleString()} tokens in</span>
                  <span>{state.cost.output_tokens.toLocaleString()} out</span>
                  <span className="text-zinc-600">real usage</span>
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--muted)]">{title}</div>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";
import { Pill, RouteBadge } from "@/components/ui";
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

            {state?.route && (
              <Section title="Route decision">
                <div className="mb-1">
                  <RouteBadge route={state.route} />
                </div>
                <div className="text-[11px] text-zinc-400">{state.route_reason}</div>
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
              <Section title="Backend learning update">
                {state.route === "knowledge_gap" ? (
                  <div className="space-y-2 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Pill color="violet">gaps sheet append</Pill>
                      <span>
                        {state.gap_theme ?? "new theme"} logged with question, date, theme, persona, and
                        staff-answer trigger.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill color="emerald">KB drafts sheet</Pill>
                      <span>
                        When staff provide the answer, n8n routes it to Claude for a Boldr-format KB draft.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill color="amber">campaign signal</Pill>
                      <span>
                        {state.buyer_persona ?? "persona"} demand is added to marketing intelligence.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Pill color="emerald">KB reinforced</Pill>
                      <span>Matched sources and confidence become retrieval quality signals.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill color="amber">persona metric</Pill>
                      <span>
                        {state.buyer_persona ?? "persona"} demand updates theme and campaign counts.
                      </span>
                    </div>
                  </div>
                )}
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

"use client";
import { useEffect, useRef, useState } from "react";
import type { TicketState } from "@/lib/types";
import { Pill, RouteBadge } from "../components";

const EXAMPLES: { label: string; channel: string; body: string }[] = [
  {
    label: "Engraving for a gift",
    channel: "email",
    body: "Hi! I'd like to engrave 'For Dad, with love' on the caseback of the Expedition I'm gifting next week. How much, and is there time to get it before Sunday?",
  },
  {
    label: "Nickel allergy check",
    channel: "email",
    body: "Hi, I have a nickel allergy. Can you confirm the buckle on the leather strap is nickel-free? I had a reaction with another brand last month.",
  },
  {
    label: "MRI safe?",
    channel: "whatsapp",
    body: "Quick question — I'm getting an MRI scan next week. Is your titanium watch safe to wear in the machine, or should I take it off?",
  },
  {
    label: "Service for older model",
    channel: "email",
    body: "I have a 2019 Expedition that's losing about 30 seconds a day. What service tier do I need and what's the cost in SGD?",
  },
];

type Stage = "classify" | "search" | "route" | "draft" | "learn";
const STAGE_LABELS: Record<Stage, string> = {
  classify: "Classifying",
  search: "Searching knowledge base",
  route: "Deciding route",
  draft: "Drafting reply",
  learn: "Updating learning loop",
};

type Turn = {
  id: string;
  user: string;
  channel: string;
  agent?: string;
  state?: TicketState;
  error?: string;
};

function stripGreeting(text: string): string {
  return text.replace(/^Hi\s+[^,]+,\s*thanks for reaching out!?\s*/i, "").trimStart();
}

export default function ChatInterface() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [channel, setChannel] = useState("email");
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [pendingStage, setPendingStage] = useState<Stage | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pendingStage]);

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const focusedTurn = turns.find((t) => t.id === activeTurnId) ?? turns[turns.length - 1];

  async function send(text: string) {
    if (!text.trim() || pendingStage) return;
    const turnId = `T${Date.now()}`;
    const turnIndex = turns.length;
    const newTurn: Turn = { id: turnId, user: text.trim(), channel };

    setTurns((ts) => [...ts, newTurn]);
    setActiveTurnId(turnId);
    setInput("");
    setPendingStage("classify");

    timersRef.current.forEach(clearTimeout);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPendingStage("search"), 2400));
    timers.push(setTimeout(() => setPendingStage("route"), 2900));
    timers.push(setTimeout(() => setPendingStage("draft"), 3200));
    timers.push(setTimeout(() => setPendingStage("learn"), 3800));
    timersRef.current = timers;

    try {
      const resp = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          subject: text.split(/[.!?\n]/)[0].slice(0, 80) || "Customer inquiry",
          message_body: text,
        }),
      });
      timers.forEach(clearTimeout);
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.detail || j.error || `HTTP ${resp.status}`);
      }
      const state: TicketState = await resp.json();
      const rawReply = state.reply_draft || "";
      const reply = turnIndex === 0 ? rawReply : stripGreeting(rawReply);
      setTurns((ts) => ts.map((t) => (t.id === turnId ? { ...t, agent: reply, state } : t)));
    } catch (e) {
      timers.forEach(clearTimeout);
      setTurns((ts) => ts.map((t) => (t.id === turnId ? { ...t, error: (e as Error).message } : t)));
    } finally {
      setPendingStage(null);
      timersRef.current = [];
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="grid h-[calc(100vh-180px)] min-h-[600px] gap-5 md:grid-cols-[1fr_380px]">
      {/* CHAT COLUMN */}
      <div className="flex min-h-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div>
            <div className="text-sm font-medium text-zinc-100">Boldr CS agent</div>
            <div className="text-xs text-[var(--muted)]">
              Every message runs the full pipeline end-to-end. Side panel shows the reasoning.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="rounded border border-[var(--border)] bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
              title="Channel affects tone in the drafted reply"
            >
              <option value="email">email</option>
              <option value="chat">chat</option>
              <option value="whatsapp">whatsapp</option>
              <option value="instagram_dm">instagram_dm</option>
            </select>
            {turns.length > 0 && (
              <button
                onClick={() => {
                  setTurns([]);
                  setActiveTurnId(null);
                }}
                className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:bg-zinc-950 hover:text-zinc-200"
              >
                clear
              </button>
            )}
          </div>
        </div>

        <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div className="space-y-2">
                <div className="text-base text-zinc-300">Start a conversation</div>
                <div className="text-xs text-[var(--muted)]">
                  Type a customer question — the agent classifies it, searches the KB, decides whether to auto-reply
                  or escalate, then drafts a brand-voice response.
                </div>
              </div>
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => {
                      setChannel(ex.channel);
                      send(ex.body);
                    }}
                    className="rounded-full border border-[var(--border)] bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 hover:border-amber-500/50 hover:text-amber-300"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t) => (
            <div key={t.id} className="space-y-3">
              <button
                onClick={() => setActiveTurnId(t.id)}
                className={`ml-auto block max-w-[80%] rounded-2xl rounded-br-md border px-4 py-2.5 text-left text-sm transition-colors ${
                  activeTurnId === t.id
                    ? "border-amber-500/40 bg-amber-500/10 text-zinc-100"
                    : "border-[var(--border)] bg-zinc-950 text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {t.user}
                <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">{t.channel}</div>
              </button>

              {!t.agent && !t.error && activeTurnId === t.id && pendingStage && (
                <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-zinc-950/40 px-4 py-2.5 text-sm text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" style={{ animationDelay: "300ms" }} />
                    </span>
                    <span className="text-xs">{STAGE_LABELS[pendingStage]}…</span>
                  </div>
                </div>
              )}

              {t.agent && (
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-zinc-100">
                  <div className="mb-2 flex items-center gap-2">
                    {t.state?.route && <RouteBadge route={t.state.route} />}
                    {(t.state?.escalation_flags ?? []).length > 0 && (
                      <span className="text-[10px] uppercase tracking-wider text-rose-400">
                        ⚠ {(t.state?.escalation_flags ?? []).join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{t.agent}</div>
                </div>
              )}

              {t.state?.kb_entry_draft && (
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-violet-900/50 bg-violet-950/20 px-4 py-3 text-sm text-zinc-200">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-violet-300">
                    Novel question · auto-drafted FAQ entry
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-zinc-300">
                    {t.state.kb_entry_draft}
                  </pre>
                </div>
              )}

              {t.error && (
                <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-red-900/50 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
                  Pipeline error: <span className="font-mono text-xs">{t.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about engraving, materials, servicing, or anything else…"
              rows={2}
              disabled={!!pendingStage}
              className="flex-1 resize-none rounded-md border border-[var(--border)] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || !!pendingStage}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingStage ? "…" : "Send"}
            </button>
          </div>
          <div className="mt-1.5 text-[10px] text-[var(--muted)]">
            Enter to send · Shift+Enter for newline
          </div>
        </div>
      </div>

      {/* REASONING COLUMN */}
      <ReasoningPanel turn={focusedTurn} pendingStage={pendingStage} isActive={focusedTurn?.id === activeTurnId} />
    </div>
  );
}

function ReasoningPanel({
  turn,
  pendingStage,
  isActive,
}: {
  turn?: Turn;
  pendingStage: Stage | null;
  isActive: boolean;
}) {
  const STAGES: { key: Stage; label: string }[] = [
    { key: "classify", label: "Classify" },
    { key: "search", label: "KB search" },
    { key: "route", label: "Route" },
    { key: "draft", label: "Draft" },
    { key: "learn", label: "Learn" },
  ];

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
            Each turn runs classify → KB search → route → draft (or flag-gap + auto-draft KB). The trace updates here
            as it executes.
          </div>
        )}

        {turn && (
          <>
            {/* Stage progression */}
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
                    <span className={active ? "text-amber-300" : done ? "text-zinc-300" : "text-[var(--muted)]"}>
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
                  <Pill>
                    conf {(state.classification_confidence ?? 0).toFixed(2)}
                  </Pill>
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
                        {state.gap_theme ?? "new theme"} logged with question, date, theme, persona, and staff-answer
                        trigger.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill color="emerald">KB drafts sheet</Pill>
                      <span>When staff provide the answer, n8n routes it to Claude for a Boldr-format KB draft.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill color="amber">campaign signal</Pill>
                      <span>{state.buyer_persona ?? "persona"} demand is added to marketing intelligence.</span>
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
                      <span>{state.buyer_persona ?? "persona"} demand updates theme and campaign counts.</span>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--muted)]">{title}</div>
      {children}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { RouteBadge } from "@/components/ui";
import type { PipelineResult } from "@/api/types";
import { ReasoningPanel, type Stage, STAGE_LABELS } from "./ReasoningPanel";

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

type Turn = {
  id: string;
  user: string;
  channel: string;
  agent?: string;
  state?: PipelineResult;
  error?: string;
};

function stripGreeting(text: string): string {
  return text.replace(/^Hi\s+[^,]+,\s*thanks for reaching out!?\s*/i, "").trimStart();
}

// Static prefix of the user-bubble button class (kept off the JSX line for the 110 limit).
const BUBBLE_BASE =
  "ml-auto block max-w-[80%] rounded-2xl rounded-br-md border px-4 py-2.5 text-left text-sm transition-colors";

export function ChatInterface() {
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

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const focusedTurn = turns.find((t) => t.id === activeTurnId) ?? turns[turns.length - 1];

  async function send(text: string) {
    if (!text.trim() || pendingStage) return;
    const turnId = `T${Date.now()}`;
    const turnIndex = turns.length;
    setTurns((ts) => [...ts, { id: turnId, user: text.trim(), channel }]);
    setActiveTurnId(turnId);
    setInput("");
    setPendingStage("classify");

    timersRef.current.forEach(clearTimeout);
    const timers = [
      setTimeout(() => setPendingStage("search"), 2400),
      setTimeout(() => setPendingStage("route"), 2900),
      setTimeout(() => setPendingStage("draft"), 3200),
      setTimeout(() => setPendingStage("learn"), 3800),
    ];
    timersRef.current = timers;

    try {
      const state = await api.runPipeline({
        channel,
        subject: text.split(/[.!?\n]/)[0].slice(0, 80) || "Customer inquiry",
        message_body: text,
      });
      timers.forEach(clearTimeout);
      const reply = turnIndex === 0 ? state.reply_draft || "" : stripGreeting(state.reply_draft || "");
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
                  Type a customer question — the agent classifies it, searches the KB, decides whether to
                  auto-reply or escalate, then drafts a brand-voice response.
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
                className={`${BUBBLE_BASE} ${
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
                      <span
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                        style={{ animationDelay: "300ms" }}
                      />
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

      <ReasoningPanel
        turn={focusedTurn}
        pendingStage={pendingStage}
        isActive={focusedTurn?.id === activeTurnId}
      />
    </div>
  );
}
